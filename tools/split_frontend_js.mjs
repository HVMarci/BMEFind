#!/usr/bin/env node
/**
 * Splits the large `app.js` and `dev.js` into smaller component scripts while preserving evaluation order.
 *
 * Writes:
 * - `js/app/*.js`
 * - `js/dev/*.js`
 * Replaces entrypoints:
 * - `app.js` / `dev.js` become sequential loaders.
 *
 * Creates backups (only if missing):
 * - `app.monolith.js`
 * - `dev.monolith.js`
 */

import fs from 'node:fs';
import path from 'node:path';

function mkdirp(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function readBytes(filePath) {
    return fs.readFileSync(filePath);
}

function writeBytes(filePath, data) {
    mkdirp(path.dirname(filePath));
    fs.writeFileSync(filePath, data);
}

function fileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

function splitLinesKeepEnds(buf) {
    const lines = [];
    let start = 0;
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0A) { // \n
            lines.push(buf.subarray(start, i + 1));
            start = i + 1;
        }
    }
    if (start < buf.length) lines.push(buf.subarray(start));
    return lines;
}

function findLineIndex(lines, markerBuf) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(markerBuf)) return i;
    }
    throw new Error(`Marker not found: ${markerBuf.toString('utf8')}`);
}

function sliceByMarkers(inPath, slices) {
    const raw = readBytes(inPath);
    const lines = splitLinesKeepEnds(raw);

    const indexFor = (marker, defaultIndex) => {
        if (marker == null) return defaultIndex;
        return findLineIndex(lines, Buffer.from(marker, 'utf8'));
    };

    for (const spec of slices) {
        const start = indexFor(spec.startMarker, 0);
        const end = indexFor(spec.endMarker, lines.length);
        if (end < start) throw new Error(`Invalid slice for ${spec.outPath}: end < start`);
        const chunk = Buffer.concat(lines.slice(start, end));
        writeBytes(spec.outPath, chunk);
    }
}

function makeAppLoader(parts, readyName) {
    const partsJs = parts.map(p => `        '${p}'`).join(',\n');
    return `// Auto-generated loader (see tools/split_frontend_js.mjs)
(function() {
    window.BMEFind = window.BMEFind || {};

    function loadScriptSequentially(srcs) {
        let p = Promise.resolve();
        for (const src of srcs) {
            p = p.then(() => new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = src;
                el.async = false;
                el.onload = () => resolve();
                el.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(el);
            }));
        }
        return p;
    }

    const parts = [
${partsJs}
    ];

    window.BMEFind['${readyName}'] = loadScriptSequentially(parts)
        .catch((err) => {
            console.error(err);
            throw err;
        });
})();
`;
}

function makeDevLoader(parts) {
    const partsJs = parts.map(p => `        '${p}'`).join(',\n');
    return `// Auto-generated loader (see tools/split_frontend_js.mjs)
(function() {
    window.BMEFind = window.BMEFind || {};

    function loadScriptSequentially(srcs) {
        let p = Promise.resolve();
        for (const src of srcs) {
            p = p.then(() => new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = src;
                el.async = false;
                el.onload = () => resolve();
                el.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(el);
            }));
        }
        return p;
    }

    const waitForApp = window.BMEFind.appReady || Promise.resolve();
    const parts = [
${partsJs}
    ];

    waitForApp
        .then(() => loadScriptSequentially(parts))
        .catch((err) => {
            console.error(err);
            throw err;
        });
})();
`;
}

function main() {
    const repoRoot = process.cwd();
    const appIn = path.join(repoRoot, 'app.js');
    const devIn = path.join(repoRoot, 'dev.js');

    if (!fileExists(appIn) || !fileExists(devIn)) {
        throw new Error('Run from repo root: expected app.js and dev.js');
    }

    const appBackup = path.join(repoRoot, 'app.monolith.js');
    const devBackup = path.join(repoRoot, 'dev.monolith.js');
    if (!fileExists(appBackup)) writeBytes(appBackup, readBytes(appIn));
    if (!fileExists(devBackup)) writeBytes(devBackup, readBytes(devIn));

    // app.js slices
    sliceByMarkers(appIn, [
        { outPath: path.join(repoRoot, 'js/app/01-dom.js'), startMarker: null, endMarker: 'const imageCache = new Map()' },
        { outPath: path.join(repoRoot, 'js/app/02-state-and-data.js'), startMarker: 'const imageCache = new Map()', endMarker: 'function applyModalSearchFilter' },
        { outPath: path.join(repoRoot, 'js/app/03-floor-ui.js'), startMarker: 'function applyModalSearchFilter', endMarker: 'function drawImage' },
        { outPath: path.join(repoRoot, 'js/app/04-map-and-navigation.js'), startMarker: 'function drawImage', endMarker: 'function createVirtualList' },
        { outPath: path.join(repoRoot, 'js/app/05-room-search.js'), startMarker: 'function createVirtualList', endMarker: '// Button event listeners' },
        { outPath: path.join(repoRoot, 'js/app/06-runtime.js'), startMarker: '// Button event listeners', endMarker: null },
    ]);

    // dev.js slices
    sliceByMarkers(devIn, [
        { outPath: path.join(repoRoot, 'js/dev/01-auth-and-ui.js'), startMarker: null, endMarker: '// Canvas click event listener' },
        { outPath: path.join(repoRoot, 'js/dev/02-editor.js'), startMarker: '// Canvas click event listener', endMarker: '// Export CSV Modal functionality' },
        { outPath: path.join(repoRoot, 'js/dev/03-export-and-save.js'), startMarker: '// Export CSV Modal functionality', endMarker: null },
    ]);

    const appLoader = makeAppLoader(
        [
            'js/app/01-dom.js',
            'js/app/02-state-and-data.js',
            'js/app/03-floor-ui.js',
            'js/app/04-map-and-navigation.js',
            'js/app/05-room-search.js',
            'js/app/06-runtime.js',
        ],
        'appReady'
    );
    const devLoader = makeDevLoader(
        [
            'js/dev/01-auth-and-ui.js',
            'js/dev/02-editor.js',
            'js/dev/03-export-and-save.js',
        ]
    );

    fs.writeFileSync(appIn, appLoader, { encoding: 'utf8' });
    fs.writeFileSync(devIn, devLoader, { encoding: 'utf8' });

    console.log('Split complete.');
    console.log('- Backups: app.monolith.js, dev.monolith.js');
    console.log('- New: js/app/*.js, js/dev/*.js');
    console.log('- Updated: app.js, dev.js (loaders)');
}

main();

