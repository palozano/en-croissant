<div align="center">
  <img width="115" height="115" src="./public/knight.svg" alt="Schaak knight">
  <h3>Schaak</h3>
  <p>The Ultimate Chess Toolkit</p>
</div>

Schaak is an open-source, cross-platform chess GUI that aims to be powerful, customizable and easy to use.

## Features

- Store and analyze your games from [lichess.org](https://lichess.org) and [chess.com](https://chess.com)
- Multi-engine analysis. Supports all UCI engines
- Prepare a repertoire and train it with spaced repetition
- Simple engine and database installation and management
- Absolute or partial position search in the database

<img src="https://github.com/franciscoBSalgueiro/encroisssant-site/blob/master/public/showcase.webp" />

## Building from source

Refer to the [Tauri documentation](https://tauri.app/start/prerequisites/) for the requirements on your platform.

Schaak uses pnpm as the package manager for dependencies. Refer to the [pnpm install instructions](https://pnpm.io/installation) for how to install it on your platform.

```bash
git clone https://github.com/palozano/schaak
cd schaak
pnpm install
pnpm build
```

The built app can be found at `src-tauri/target/release`

For local development and web deployment, the root `Makefile` provides shortcuts:

```sh
make install      # Install dependencies
make gui          # Run the desktop GUI (requires Tauri prerequisites)
make web          # Run the browser edition locally
make preview-web  # Build and preview the browser edition on port 4173
make deploy       # Build and deploy the web edition to chess.carola.work via blue
make help         # List all commands
```

`gui` and `web` both use port 1420; run one at a time. Deployment requires SSH
access to `blue` and local `rsync`. See the [deployment notes](./docs/browser.md#production-chesscarolawork).

## Browser edition (WASM)

The browser edition supports local studies, PGN import/export, position editing,
and Stockfish WASM analysis without an application backend.

```sh
pnpm dev:web
# Build the static site into dist-web/:
pnpm build:web
```

See [browser setup, deployment and current feature scope](./docs/browser.md).

## Acknowledgements

Schaak is a fork of [En Croissant](https://github.com/franciscoBSalgueiro/en-croissant), created by Francisco Salgueiro and its contributors. The original project provides the engine and database catalogs used by this app.

## Contributing

For contributing to this project please refer to the [Contributing guide](./CONTRIBUTING.md).

## License

This software is licensed under GPL-3.0 License.
