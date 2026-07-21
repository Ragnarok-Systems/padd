# PADD

**Personal Access Display Device** — a lightweight desktop Markdown viewer and editor built with [Tauri 2](https://v2.tauri.app/).

![PADD screenshot](padd-screenshot.jpg)

PADD opens `.md` / `.markdown` files, renders them with GitHub-flavored Markdown, syntax highlighting, and Mermaid diagrams, and lets you edit and save them from a frameless, tabbed window.

## Features

- **View & edit** — toggle between a rendered view and a plain-text editor for the same file.
- **GitHub-flavored Markdown** rendering via [marked](https://marked.js.org/).
- **Syntax highlighting** for fenced code blocks via [highlight.js](https://highlightjs.org/).
- **Mermaid diagrams** rendered inline via [mermaid](https://mermaid.js.org/).
- **Formatting toolbar** in edit mode: bold, italic, strikethrough, H1–H3, bullet / numbered / task lists, blockquote, inline code, code block, link, image, horizontal rule, and Mermaid block. Each action is a single undo step (`Ctrl+Z`).
- **Tabs** — open multiple files at once and cycle them with `Ctrl+Tab`.
- **Light / dark theme** toggle.
- **Zoom** — `Ctrl`+mousewheel (toward the cursor) or the toolbar zoom controls.
- **Multiple ways to open a file** — the Open button / `Ctrl+O` file dialog, drag-and-drop onto the window, a path passed on the command line, or OS file association (`.md` / `.markdown` files open in PADD).
- **Live reload** — PADD watches the open files on disk (polled every ~1.5s) and prompts to reload when they change outside the app.
- **Single instance** — launching PADD again focuses the existing window and opens the new file there instead of starting a second process.
- **Frameless window** with a custom title bar (minimize / maximize / close).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save file |
| `Ctrl+B` | Bold (edit mode) |
| `Ctrl+I` | Italic (edit mode) |
| `Ctrl+K` | Link (edit mode) |
| `Ctrl+Z` | Undo (edit mode) |
| `Ctrl+Tab` | Cycle tabs |
| `Ctrl`+wheel | Zoom (view mode) |

## Architecture

```
padd/
├── frontend/            # UI (no build step — plain HTML/CSS/JS)
│   ├── index.html       # Entire app: markup, styles, and logic
│   ├── lib/             # Vendored marked, highlight.js, mermaid, hljs themes
│   └── assets/          # App icon
├── src-tauri/           # Rust backend (Tauri 2)
│   ├── src/main.rs      # Tauri commands + app setup
│   ├── capabilities/    # Tauri permission set
│   ├── tauri.conf.json  # Window, bundle, and file-association config
│   └── Cargo.toml
├── tests/               # Node-based frontend tests (JSDOM)
└── package.json         # npm scripts + Tauri CLI
```

The frontend is a single self-contained `index.html` served from `frontend/` — there is no bundler or frontend build step. The Rust backend (`src-tauri/src/main.rs`) exposes the following Tauri commands to the frontend via `invoke`:

- `get_initial_file` — returns the file passed on the command line at launch (if any).
- `read_file` — read a Markdown file and return its content, resolved path, directory URL, name, and mtime.
- `save_file` — write content back to a path.
- `get_mtime` — return a file's last-modified time (used by the live-reload watcher).
- `open_file_dialog` — show a native Markdown file picker.
- `minimize_window` / `maximize_window` / `close_window` — custom title-bar controls.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable) and Cargo.
- [Node.js](https://nodejs.org/) (used for the Tauri CLI and the test suite; CI uses Node 20).
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

This runs `cargo run` inside `src-tauri`. You can also open a file directly by passing its path to the built binary, e.g. `padd path/to/notes.md`.

## Build

Produce a release build:

```sh
npm run build
```

This runs `cargo build --release` inside `src-tauri`. To produce platform installers/bundles, use the Tauri CLI:

```sh
npm run tauri build
```

## Test

The test suite drives `frontend/index.html` in [jsdom](https://github.com/jsdom/jsdom) and exercises the pure formatting transforms, the Open-button reentrancy guard, and the single-undo-step behavior:

```sh
npm test
```

This runs the three Node test files in `tests/`.

## Releases

The `Build and Release` GitHub Actions workflow (`.github/workflows/release.yml`) builds Windows (NSIS) and macOS (universal `dmg`/`app`) bundles on pushed `v*` tags (or manual dispatch) and uploads them to Azure Blob Storage. macOS builds target 10.15+.
