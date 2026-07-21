# Architecture

PADD is a [Tauri 2](https://v2.tauri.app/) desktop app: a Rust backend that owns the
window, the filesystem, and OS integration, driving a single self-contained HTML/CSS/JS
frontend. There is **no bundler or frontend build step** — the UI ships as-is.

## Repository layout

```
padd/
├── frontend/            # UI (no build step — plain HTML/CSS/JS)
│   ├── index.html       # Entire app: markup, styles, and logic
│   ├── lib/             # Vendored marked, highlight.js, mermaid, hljs themes
│   └── assets/          # App icon
├── src-tauri/           # Rust backend (Tauri 2)
│   ├── src/main.rs      # Tauri commands + app setup
│   ├── capabilities/    # Tauri permission set (default.json)
│   ├── tauri.conf.json  # Window, bundle, and file-association config
│   ├── build.rs
│   └── Cargo.toml
├── tests/               # Node-based frontend tests (JSDOM)
├── .github/workflows/   # release.yml — build + publish pipeline
└── package.json         # npm scripts + Tauri CLI
```

## Frontend

The entire app is one self-contained `frontend/index.html` — markup, styles, and logic
in a single file — served from `frontend/`. Third-party libraries are **vendored** under
`frontend/lib/` rather than fetched at runtime:

- [marked](https://marked.js.org/) — GitHub-flavored Markdown rendering.
- [highlight.js](https://highlightjs.org/) — syntax highlighting for fenced code blocks,
  with the `github` / `github-dark` themes.
- [mermaid](https://mermaid.js.org/) — inline diagram rendering.

The frontend talks to the Rust backend exclusively through Tauri's `invoke` bridge
(`withGlobalTauri` is enabled in `tauri.conf.json`). See the
[Tauri command reference](../reference/tauri-commands.md) for the full command surface.

## Backend

`src-tauri/src/main.rs` sets up the Tauri application and exposes the command handlers.
Beyond the commands, the backend wires up a few behaviors:

- **CLI file open** — on launch, `main` scans `argv` for the first non-flag argument
  ending in `.md` / `.markdown` and stashes it in `AppState`; the frontend pulls it via
  `get_initial_file`.
- **Single instance** — the `tauri-plugin-single-instance` plugin focuses the existing
  window on a second launch and emits a `file-opened` event with the newly requested
  file instead of starting a second process.
- **Native file dialog** — `open_file_dialog` uses `tauri-plugin-dialog` with a Markdown
  filter (`md`, `markdown`).
- **Frameless window** — `decorations` is `false` in `tauri.conf.json`; the custom title
  bar drives `minimize_window` / `maximize_window` / `close_window`.

## Live reload

The frontend polls the open files on disk every ~1.5s (a 1500 ms `setInterval`) by
calling the `get_mtime` command and comparing modification times. When a file changes on
disk outside the app, PADD prompts to reload it.

## OS integration

`tauri.conf.json` registers a file association for `.md` / `.markdown` (MIME
`text/markdown`) so those files can open in PADD from the OS. The window opens at
1100×800 (min 500×400), frameless, with drag-and-drop enabled.
