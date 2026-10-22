# Shared studies architecture

Both entries render `features/studies/StudyWorkspace.tsx`:

```
BrowserApp -> browserStudyPlatform -> StudyWorkspace
Desktop /studies -> desktop platform -> StudyWorkspace
```

## Board and editor

`BoardSurface` owns the native Chessground instance, its updates, click-vs-drag
handling, teardown and rejected-edit rollback. The existing desktop `Chessground`
wrapper supplies preferences and interactive mirroring. `StudyBoard` supplies
legal destinations and promotion selection to the shared study workspace.
`PositionEditor` provides the palette, material limits, turn/castling controls,
eraser and empty/initial toggle. Desktop passes its draggable palette rendering.

## Model and PGN

`model.ts` is independent of React and platform APIs. `Study` and `StudyNode` keep
stable IDs, revisions, full starting FEN, branching moves, comments, NAGs and PGN
headers. Browser IndexedDB records retain their previous schema and database name.

`pgn.ts` uses chessops for parsing and writing. The advanced desktop tree still
has its existing state, reports, shapes and repertoire metadata. `tokenizePgn`
bridges the common parser to that tree's existing parser, replacing the Rust lexer
call. `desktopTree.ts` converts explicitly through PGN; it does not rewrite any
existing file or persisted desktop session. Its tests cover custom starting
positions, Black to move, nested alternatives, comments, clocks, evaluations,
arrows, glyphs and custom headers.

## Engines

`EngineClient` exposes `analyze`, `stop`, and `dispose`; factories publish the same
`EngineState` to the common `AnalysisPanel`. Lines contain UCI moves, depth,
MultiPV index and scores in White's perspective.

The web adapter retains the existing single-thread Stockfish Worker and waits
for `bestmove` before starting another search. The native adapter uses an installed
local Stockfish from Engines. Every search has its own native session identity,
so delayed output cannot be assigned to a new position. Cancellation releases
the native process, including cancellation while it is still starting. This
adapter is for Studies; the existing desktop multi-engine analysis panel keeps
its advanced engine configuration, previews, reports and other controls.

## Platform boundary

`StudyPlatform` injects a `StudyRepository`, engine factory, file export, URL PGN
download, confirmation, persistence request and presentation-window opener.
Offline installation is optional. The shared screen handles studies and editing;
it does not select between Tauri commands and IndexedDB internally.

The desktop repository uses one validated JSON file per study, serializes changes,
checks the expected revision and atomically renames a temporary file on save.
Deleted studies retain a `.deleted-*` file excluded from the library; corrupt data
or a failed replacement does not cause automatic replacement with an empty study.
Only the main desktop window accesses this repository. These checks serialize
writes in that window; they are not a cross-process filesystem locking mechanism.

**Import Lichess** is implemented in the shared workspace. Its URL resolver uses
Lichess's `/api/study/{id}.pgn` and `/api/study/{id}/{chapter}.pgn` exports, explicitly
including comments, variations, clocks and orientation tags. Download bounds and
timeout use the existing PGN downloader. The browser requests public exports over
CORS; desktop uses its native HTTP adapter for lichess.org, with the existing
host permission. No account credentials or access tokens are requested/stored.
The API contract is documented at [Lichess Studies](https://lichess.org/api#tag/Studies).

The shared screen is available from **Studies** in the desktop sidebar. The
original desktop Board, Files, Databases, puzzles and repertoire workflows remain
available. The two applications do not automatically synchronize libraries;
PGN export/import remains the transfer mechanism.

## Verification

- `pnpm test`: common model/PGN, native repository failure/revision checks,
  native engine cancellation and stale-event filtering, shared workspace with
  injected services, existing desktop and browser unit tests.
- `pnpm build:web` and `pnpm test:web`: production build and Chromium end-to-end
  tests, including a real WASM search, offline reload, position editing and
  rollback, palette colors, presentation synchronization and board resizing.
- `pnpm build`: complete native Tauri application build.

A successful native build and mocked adapter tests do not replace manual testing
of filesystem dialogs, the native process protocol and multiple WKWebView windows
on each desktop platform.
