# Repository Guidelines

## Project Structure

- `index.html`, `styles.css`, `app.js` - end-user UI (canvas-based map + room search + navigation).
- `dev.html`, `dev.js`, `dev.css` - mapping/editor UI for creating and saving nodes/edges.
- `api.php` - PHP backend (sessions, auth, read/write endpoints).
- `api-client.js`, `priority_queue.js` - shared frontend helpers (API wrapper, pathfinding utility).
- `database.sql` - MySQL schema (`nodes`, `edges`, `floors`, `users`, `user_building_permissions`).
- Image/map assets live in the repo root (e.g. `K1.svg`, `map_en.jpg`) and are referenced via the `floors.filename` column.
- `backup/` contains legacy exports (`csucsok.csv`, `elek.txt`, `epuletek.csv`) useful for seeding.

## Build, Test, and Development Commands

- Run locally (serves both frontend + `api.php`):
  - `php -S 127.0.0.1:8000`
- Import DB schema:
  - PowerShell: `Get-Content .\\database.sql | mysql -u root -p -h 127.0.0.1 -P 3307`
  - macOS/Linux: `mysql -u root -p < database.sql`
- Open UIs:
  - `http://127.0.0.1:8000/index.html` (main)
  - `http://127.0.0.1:8000/dev.html` (editor)

## Coding Style & Naming Conventions

- Use 4-space indentation in HTML/CSS/JS/PHP (match existing files).
- Prefer `const`/`let` (no implicit globals) and keep functions single-purpose.
- Keep database identifiers consistent with existing schema (`epulet`, `emelet`, `teremnev`, `tipus`).
- When adding API routes, follow the existing `?path=...` pattern in `api.php` and mirror it in `api-client.js`.
- UI/user-facing Hungarian texts should use proper accents (UTF-8), don’t drop diacritics in new strings. Make sure to use proper encoding.
- Agent communication: use English in assistant responses and new code comments/messages unless the user requests otherwise.

## Testing Guidelines

No automated test suite is currently set up. For changes, do a quick manual smoke check:

- Load `index.html`, zoom/pan, search a room, and step through navigation.
- Load `dev.html`, log in, edit a node/edge, and verify save results.

## Commit & Pull Request Guidelines

- Commits use short, single-line summaries (Hungarian and/or English), e.g. “Backend létrehozva”, “Mobile UI overhaul…”. Keep it imperative and focused.
- PRs should include: what changed, how to test (URLs + steps), and screenshots for UI changes.
- If DB or API behavior changes, include a migration note (SQL snippet) and update `README.md` accordingly.

## Security & Configuration Tips

- Never commit secrets: `.env` is intentionally gitignored.
- Treat `hash.php` as a local/dev helper only (do not expose publicly).
- If serving frontend/backend on different origins, set `CORS_ORIGIN` in `.env` and verify cookies/sessions still work.
