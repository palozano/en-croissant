# Browser / WASM edition

Work is on the `wasm` branch. The web edition runs on a static server, with no
Tauri runtime, application backend, accounts, or server-side engine processes.
The desktop build remains available with its existing commands.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

Open the URL printed by Vite (normally `http://localhost:1420`). The web entry
also opens automatically when the app is visited outside Tauri. Use `dev:web`
to ensure the WASM engine assets have been prepared.

## Build and serve

```sh
pnpm build:web
pnpm preview:web
```

The complete static site is in `dist-web/`. Serve it at a domain's root, over
HTTPS. `preview:web` listens on `http://127.0.0.1:4173` for local review.
`deploy/web.nginx.conf` provides a server configuration. Ensure the host serves
`.wasm` with `application/wasm` and JavaScript with a JavaScript MIME type.
Service workers require HTTPS, except on localhost/loopback.

A static Nginx container is also provided:

```sh
docker build -f Dockerfile.web -t schaak-web .
docker run --rm -p 8080:80 schaak-web
```

Use an HTTPS reverse proxy for public hosting. The application currently expects
root hosting, rather than a URL subdirectory. Browser downloads from third-party
sites require those sites to permit CORS; the application does not proxy requests.

## Implemented

- Responsive chessboard; legal moves by click or drag; castling, en passant and
  promotion selection; board orientation and position navigation.
- Presentation popup: **Present board** opens a read-only board for another screen,
  synchronized with the active position, orientation and drawn arrows. Includes a
  fullscreen button; keep the source window open and allow pop-ups for the site.
- Multiple studies, variations, comments and preserved PGN annotations/headers.
- Move notation pairs White/Black moves by turn, with collapsible side lines at
  their branching move, separate comments, and a current-variation breadcrumb.
  The active branch opens automatically and the current move stays in view.
  Left/right step through moves; down/up enter and leave variations. The same
  notation layout is the default in desktop, with its move menus and annotations.
- Automatic IndexedDB saves. Stale edits from another tab fail rather than
  silently overwriting that tab's saved version.
- PGN file import, URL download/import, per-study export and an all-studies PGN
  backup. Imports/downloads are limited to 16 MB, and individual lines to 512 ply.
- **Import Lichess** accepts a public study/chapter link and imports all chapters
  or just the linked chapter. Each chapter is a separate local study, preserving
  PGN headers, comments, variations, glyphs, clocks and source chapter links.
  The same action is available in desktop **Studies**. Private/unlisted studies
  and studies with restricted downloads require exporting a PGN from Lichess and
  using **Upload PGN**; this importer does not authenticate with a Lichess account.
- Position editor with palette, eraser, off-board drag deletion, empty/initial
  toggle, turn and castling controls, FEN input, material and position validation.
  The editor can save in the current study or create a separate study. Replacing
  the starting position removes existing moves/variations after confirmation;
  creating a separate study preserves the original. The FEN field appears only
  once, in the right-hand panel, and becomes editable in position editing mode.
- Stockfish **19 Lite, single-threaded**, compiled upstream to WebAssembly,
  running in a Web Worker. MultiPV 3, hash 32 MB, search depth 18. Analysis scores
  use White's perspective. Interrupted searches cannot leak into the next position.
- Offline application and engine after the service worker finishes installation.
  The **Save studies in browser** button opens the storage details and offline status. Development mode does not install a worker.
- Optional browser storage persistence request. This is not a backup: users can
  still delete site data. Studies are specific to the browser profile and origin.

## Architecture and current boundaries

`src/index.tsx` selects the browser entry without starting desktop initialization.
The study screen is shared with the desktop **Studies** sidebar entry:

- `src/features/board/`: Chessground lifecycle, study board, position editor and
  presentation synchronization. The existing advanced desktop board also uses
  the common surface and editor, keeping its preferences and palette dragging.
- `src/features/studies/`: Study model, PGN parser, notation and study workspace.
  Desktop PGN loading now uses the same TypeScript parser. A compatibility
  adapter preserves its rich tree and PGN annotations without migrating files.
- `src/features/analysis/`: analysis state/client contract and shared panel.
- `src/web/platform.ts`: IndexedDB, browser downloads/confirmations, persistence,
  offline installation, and Stockfish WASM Worker.
- `src/platform/desktop/`: native Stockfish adapter and a file repository under
  the app data directory (`studies-v1`). Writes replace each study atomically,
  reject stale revisions and retain a recovery file on deletion.

The shared feature modules do not invoke Tauri or browser storage. Their platform
services are injected. CSS is scoped to the study workspace so opening Studies
cannot restyle the rest of the desktop interface. Native Tauri commands are not
stubbed to pretend they work. See [shared-studies.md](shared-studies.md) for the
contracts and validation.

The current WASM module is **Stockfish**, not the entire Rust/Tauri backend. The
browser uses the existing TypeScript chess libraries for rules and PGN. Large
native SQLite databases/search indexes, compressed database catalogs, puzzle
sessions, native UCI engines, desktop filesystem integration, and interactive desktop window
mirroring have not been ported to the browser. The existing advanced desktop
analysis interface remains available alongside the shared Studies screen.
Desktop and web libraries use separate storage; export/import PGN to transfer studies. Cloud sharing/synchronization is
not implemented. The web interface uses English, independent of browser language preferences.

Future Rust extraction can target pure PGN/indexing algorithms in a separate
WASM crate. Tauri process/filesystem/window APIs must retain browser-specific
adapters; compiling the desktop binary unchanged is not supported.

## Engine distribution

`stockfish@19.0.1` is pinned. `scripts/prepare-web.mjs` copies only the unmodified
Lite single-threaded engine and its GPLv3 license/source references into generated
`public/stockfish/`. Those files are not checked into Git; builds reproduce them
from the lockfile. See the in-app source link and `/stockfish/SOURCES.txt`.
Upstream source/build scripts: <https://github.com/nmrugg/stockfish.js/tree/v19.0.1>.
The Lite network is smaller and weaker than the full Stockfish network. The
single-threaded build does not require cross-origin isolation headers.

`scripts/finish-web.mjs` creates a content-versioned offline cache manifest from
the built assets. Redeploy the complete `dist-web/` directory together; do not
cache HTML or `sw.js` indefinitely. Saved studies are outside this cache and
remain intact across app upgrades.

## Validation

```sh
pnpm test
pnpm build:web
pnpm exec playwright install chromium
pnpm test:web
pnpm build-vite
```

Browser tests use the production build and a real Chromium WASM Worker, including
an offline reload with network disabled. They cover IndexedDB reloads, PGN export
and import, variations/comments, moves, editor deletion/placement and mobile layout.
The container configuration is supplied for deployment but is not itself exercised
by the browser suite. A local image build was attempted and canceled after Docker
Hub base-image metadata requests stalled; the container image is not yet verified.

## Production: chess.carola.work

Deployed to `blue`, served by host Nginx from
`/var/www/chess.carola.work/current`. HTTP redirects to HTTPS. Let's Encrypt
certificates are managed by Certbot and the enabled `certbot-renew.timer`.
The site configuration is `/etc/nginx/conf.d/chess.carola.work.conf`; a copy
is kept in `deploy/chess.carola.work.conf`.

To deploy a new build without removing older hashed assets still in use:

```sh
make deploy
```

This builds the web edition before uploading, preserves older hashed assets,
and restores the server's read permissions and SELinux contexts. It requires
SSH access to `blue` and local `rsync`. To target a different host or directory,
use `make deploy DEPLOY_HOST=host DEPLOY_DIR=/var/www/site/current`.

The equivalent commands are:

```sh
pnpm build:web
rsync -az dist-web/ blue:/var/www/chess.carola.work/current/
ssh blue 'chmod -R a+rX /var/www/chess.carola.work/current && restorecon -RF /var/www/chess.carola.work/current'
```

A normal content update does not require reloading Nginx. For configuration
changes, validate with `nginx -t` before reloading. Do not change the existing
`carola.work` site configuration when updating the chess site.
