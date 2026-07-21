# Tauri command reference

The Rust backend (`src-tauri/src/main.rs`) exposes the following commands to the
frontend via Tauri's `invoke`. All are registered in the `generate_handler!` list.

| Command | Arguments | Returns | Purpose |
| --- | --- | --- | --- |
| `get_initial_file` | — | `FileData \| null` | The file passed on the command line at launch, if any (consumed once). |
| `read_file` | `filePath: string` | `FileData` | Read a Markdown file and return its structured data. |
| `save_file` | `filePath: string`, `content: string` | `void` | Write `content` back to `filePath`. |
| `get_mtime` | `filePath: string` | `number` (ms) | A file's last-modified time; used by the live-reload watcher. |
| `open_file_dialog` | — | `FileData \| null` | Show a native Markdown file picker (`md`, `markdown`); `null` if cancelled. |
| `minimize_window` | — | `void` | Custom title-bar control. |
| `maximize_window` | — | `void` | Toggle maximize / unmaximize. |
| `close_window` | — | `void` | Close the window. |

## `FileData`

`read_file`, `open_file_dialog`, and `get_initial_file` return a `FileData` object
(serialized with the JSON field names below):

| Field | Type | Description |
| --- | --- | --- |
| `content` | string | Full file contents. |
| `filePath` | string | Canonicalized absolute path. |
| `dirUrl` | string | `file://` URL of the containing directory (used to resolve relative images). |
| `name` | string | File name. |
| `mtime` | number | Last-modified time in milliseconds since the Unix epoch. |

Commands that can fail (`read_file`, `save_file`, `get_mtime`, `open_file_dialog`)
return a Rust `Result`; on error the `invoke` promise rejects with a descriptive string.

## Events

The backend also emits a Tauri event:

- `file-opened` — emitted by the single-instance handler with a `FileData` payload when
  a second launch requests a file. The frontend listens for this to open the file in the
  running window.
