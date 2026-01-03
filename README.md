# BME Find

Vanilla HTML/JS room finder + indoor navigation for the BME campus maps, backed by a small PHP + MySQL API. The app renders floorplan images on a `<canvas>`, lets users search for rooms, and guides them step-by-step along a pre-built node/edge graph.

## What's in this repo

- `index.html` - main (end-user) UI
- `app.js` - map rendering, search, routing, navigation UI logic
- `api-client.js` - browser API wrapper used by the UIs
- `api.php` - PHP backend (auth + data read/write)
- `database.sql` - MySQL schema (nodes/edges/buildings/users/permissions)
- `dev.html`, `dev.js`, `dev.css` - mapping editor UI for creating/editing nodes & edges
- `priority_queue.js` - client-side priority queue (pathfinding helper)
- `hash.php` - small helper to generate `password_hash()` values (dev-only)
- `manifest.json` - PWA metadata

## Quick start (local)

### Prerequisites

- PHP 8+ with `mysqli` enabled
- MySQL/MariaDB

### 1) Create the database

Import `database.sql` into your MySQL server:

- Windows (PowerShell):
  - `Get-Content .\\database.sql | mysql -u root -p -h 127.0.0.1 -P 3307`
- macOS/Linux (bash/zsh):
  - `mysql -u root -p < database.sql`

The schema creates a `bmefind` database and the required tables.

### 2) Configure `.env`

Create/update `.env` in the project root (it is already gitignored). Required keys:

- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_NAME`
- `DB_PORT`
- `CORS_ORIGIN` (the frontend origin; required when serving frontend and API from different origins)

### 3) Add initial data (buildings, nodes, edges)

Populate:

- `buildings` with floorplan image entries (`epulet`, `emelet`, `filename`, `x`, `y`)
- `nodes` (graph nodes)
- `edges` (connections between nodes; typically store both directions)

There are legacy exports in `backup/` (`csucsok.csv`, `elek.txt`, `epuletek.csv`) that may help when seeding data.

### 4) Run locally

You must serve the files via HTTP (opening `index.html` via `file://` won't work with `fetch('./api.php')`).

- `php -S 127.0.0.1:8000`
- Open `http://127.0.0.1:8000/index.html`

Dev editor:

- Open `http://127.0.0.1:8000/dev.html`

## Authentication and permissions (dev editor)

`dev.html` supports login/logout and saving changes back to the database:

- Users live in the `users` table.
- Building permissions live in `user_building_permissions` (per `epulet`).
- Admins (`users.is_admin = 1`) implicitly have access to all buildings.

To create a user, generate a password hash and insert it into `users.password_hash`:

- PHP CLI:
  - `php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"`
- Or (dev-only helper):
  - `http://127.0.0.1:8000/hash.php?pwd=your-password`

## Backend API (`api.php`)

The frontend calls `api.php` via query parameter routing:

- `GET ?path=buildings`
- `GET ?path=nodes[&epulet=...][&emelet=...]`
- `GET ?path=edges[&epulet=...][&emelet=...]`
- `GET ?path=checkAuth`
- `POST ?path=login`
- `POST ?path=logout`
- `POST ?path=saveNodes` (auth required; permission-filtered)
- `POST ?path=saveEdges` (auth required; permission-filtered)
- `POST ?path=applyChanges` (auth required; permission-filtered)

Sessions are cookie-based (`credentials: 'include'`), so deploy the frontend + backend on the same origin when possible. If you must use different origins, set `CORS_ORIGIN` to the exact frontend origin and ensure cookies are allowed for your deployment setup.

## Image assets

Floorplan images (e.g. `K1_300ppi.png`, `K2_300ppi.png`, `map_en.jpg`) are rendered on the canvas. The building-to-image mapping is stored in the `buildings` table (`filename` column).

## Development notes

- UI text is Hungarian. If you see “garbled” accented characters in PowerShell output, it’s typically a console/encoding display issue rather than the file contents—try `Get-Content -Encoding utf8 <file>`.
