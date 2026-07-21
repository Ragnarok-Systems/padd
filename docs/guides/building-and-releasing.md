# Building and releasing

This guide covers local build/test in depth and the automated release pipeline. For the
minimal quickstart, see the [root README](../../README.md).

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable) and Cargo.
- [Node.js](https://nodejs.org/) — used for the Tauri CLI and the test suite (CI uses
  Node 20).
- Your platform's [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/).

Install the npm dev dependencies (Tauri CLI + jsdom) once:

```sh
npm install
```

## Develop

Run the app in development mode (compiles and launches the Rust binary):

```sh
npm run dev
```

This runs `cargo run` inside `src-tauri`. You can also open a file directly by passing
its path to the built binary, e.g. `padd path/to/notes.md`.

## Build

Produce a release build:

```sh
npm run build
```

This runs `cargo build --release` inside `src-tauri`. To produce platform
installers/bundles, use the Tauri CLI:

```sh
npm run tauri build
```

## Test

The test suite drives `frontend/index.html` in [jsdom](https://github.com/jsdom/jsdom)
and exercises the pure formatting transforms, the Open-button reentrancy guard, and the
single-undo-step behavior:

```sh
npm test
```

This runs the three Node test files in `tests/` (`open-button.test.js`,
`format.test.js`, `undo.test.js`).

## Release pipeline

The **Build and Release** GitHub Actions workflow (`.github/workflows/release.yml`)
runs on pushed `v*` tags or manual `workflow_dispatch`. It:

1. Builds in a matrix:
   - **Windows** (`windows-latest`) → NSIS installer (`currentUser` install mode).
   - **macOS** (`macos-latest`) → universal (`aarch64` + `x86_64`) `dmg` / `app`,
     targeting macOS 10.15+.
2. Uploads each platform's bundles as a workflow artifact.
3. In the `publish` job, downloads all artifacts and pushes the `.exe` / `.msi` / `.dmg`
   files to Azure Blob Storage (the `ragnarokidentityweb` static-web `$web` container,
   under `downloads/`), then prints the public download URLs.

Azure upload requires the `AZURE_STORAGE_SAS_TOKEN` repository secret.
