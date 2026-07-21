# PADD documentation

Documentation for PADD (Personal Access Display Device), a Tauri 2 desktop Markdown
viewer/editor. Start at the [root README](../README.md) for the overview and quickstart.

## Architecture

How PADD is built today.

- [overview.md](architecture/overview.md) — system architecture: repo layout, the
  single-file frontend, the Rust backend, live reload, and OS integration.

## Guides

How to do things.

- [building-and-releasing.md](guides/building-and-releasing.md) — prerequisites, local
  develop/build/test, and the GitHub Actions release + Azure publish pipeline.

## Reference

The surface that exists today.

- [tauri-commands.md](reference/tauri-commands.md) — the `invoke` command surface, the
  `FileData` shape, and backend events.
- [keyboard-shortcuts.md](reference/keyboard-shortcuts.md) — all keyboard shortcuts.
