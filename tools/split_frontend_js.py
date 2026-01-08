#!/usr/bin/env python3
"""
Splits the large `app.js` and `dev.js` into smaller component scripts while preserving evaluation order.

This script is intended to be run from the repo root.
It writes:
- `js/app/*.js`
- `js/dev/*.js`
and replaces `app.js` / `dev.js` with small sequential loaders.

It also creates backups:
- `app.monolith.js`
- `dev.monolith.js`
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SliceSpec:
    out_path: Path
    start_marker: bytes | None
    end_marker: bytes | None


def find_line_index(lines: list[bytes], marker: bytes) -> int:
    for i, line in enumerate(lines):
        if marker in line:
            return i
    raise RuntimeError(f"Marker not found: {marker!r}")


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def slice_by_markers(in_path: Path, slices: list[SliceSpec]) -> None:
    raw = in_path.read_bytes()
    lines = raw.splitlines(keepends=True)

    def idx_for(marker: bytes | None, default: int) -> int:
        if marker is None:
            return default
        return find_line_index(lines, marker)

    for spec in slices:
        start = idx_for(spec.start_marker, 0)
        end = idx_for(spec.end_marker, len(lines))
        if end < start:
            raise RuntimeError(f"Invalid slice for {spec.out_path}: end < start")
        chunk = b"".join(lines[start:end])
        write_bytes(spec.out_path, chunk)


def make_loader(app_parts: list[str], global_ready_name: str) -> str:
    parts_js = ",\n        ".join(f"'{p}'" for p in app_parts)
    return f"""// Auto-generated loader (see tools/split_frontend_js.py)
(function() {{
    window.BMEFind = window.BMEFind || {{}};

    function loadScriptSequentially(srcs) {{
        let p = Promise.resolve();
        for (const src of srcs) {{
            p = p.then(() => new Promise((resolve, reject) => {{
                const el = document.createElement('script');
                el.src = src;
                el.async = false;
                el.onload = () => resolve();
                el.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(el);
            }}));
        }}
        return p;
    }}

    const parts = [
        {parts_js}
    ];

    window.BMEFind['{global_ready_name}'] = loadScriptSequentially(parts)
        .catch((err) => {{
            console.error(err);
            throw err;
        }});
}})();
"""


def make_dev_loader(dev_parts: list[str]) -> str:
    parts_js = ",\n        ".join(f"'{p}'" for p in dev_parts)
    return f"""// Auto-generated loader (see tools/split_frontend_js.py)
(function() {{
    window.BMEFind = window.BMEFind || {{}};

    function loadScriptSequentially(srcs) {{
        let p = Promise.resolve();
        for (const src of srcs) {{
            p = p.then(() => new Promise((resolve, reject) => {{
                const el = document.createElement('script');
                el.src = src;
                el.async = false;
                el.onload = () => resolve();
                el.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(el);
            }}));
        }}
        return p;
    }}

    const waitForApp = window.BMEFind.appReady || Promise.resolve();
    const parts = [
        {parts_js}
    ];

    waitForApp
        .then(() => loadScriptSequentially(parts))
        .catch((err) => {{
            console.error(err);
            throw err;
        }});
}})();
"""


def main() -> int:
    root = Path(".")
    app_in = root / "app.js"
    dev_in = root / "dev.js"

    if not app_in.exists() or not dev_in.exists():
        raise RuntimeError("Run from repo root: expected app.js and dev.js")

    # Backup originals once.
    app_backup = root / "app.monolith.js"
    dev_backup = root / "dev.monolith.js"
    if not app_backup.exists():
        app_backup.write_bytes(app_in.read_bytes())
    if not dev_backup.exists():
        dev_backup.write_bytes(dev_in.read_bytes())

    # --- app.js slices ---
    app_slices = [
        SliceSpec(Path("js/app/01-dom.js"), None, b"const imageCache = new Map()"),
        SliceSpec(Path("js/app/02-state-and-data.js"), b"const imageCache = new Map()", b"function applyModalSearchFilter"),
        SliceSpec(Path("js/app/03-floor-ui.js"), b"function applyModalSearchFilter", b"function drawImage"),
        SliceSpec(Path("js/app/04-map-and-navigation.js"), b"function drawImage", b"function createVirtualList"),
        SliceSpec(Path("js/app/05-room-search.js"), b"function createVirtualList", b"// Button event listeners"),
        SliceSpec(Path("js/app/06-runtime.js"), b"// Button event listeners", None),
    ]
    slice_by_markers(app_in, app_slices)

    # --- dev.js slices ---
    dev_slices = [
        SliceSpec(Path("js/dev/01-auth-and-ui.js"), None, b"// Canvas click event listener"),
        SliceSpec(Path("js/dev/02-editor.js"), b"// Canvas click event listener", b"// Export CSV Modal functionality"),
        SliceSpec(Path("js/dev/03-export-and-save.js"), b"// Export CSV Modal functionality", None),
    ]
    slice_by_markers(dev_in, dev_slices)

    # Replace entrypoints with loaders.
    app_loader = make_loader(
        [
            "js/app/01-dom.js",
            "js/app/02-state-and-data.js",
            "js/app/03-floor-ui.js",
            "js/app/04-map-and-navigation.js",
            "js/app/05-room-search.js",
            "js/app/06-runtime.js",
        ],
        "appReady",
    )
    dev_loader = make_dev_loader(
        [
            "js/dev/01-auth-and-ui.js",
            "js/dev/02-editor.js",
            "js/dev/03-export-and-save.js",
        ]
    )

    app_in.write_text(app_loader, encoding="utf-8", newline="\n")
    dev_in.write_text(dev_loader, encoding="utf-8", newline="\n")

    print("Split complete.")
    print("- Backups: app.monolith.js, dev.monolith.js")
    print("- New: js/app/*.js, js/dev/*.js")
    print("- Updated: app.js, dev.js (loaders)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

