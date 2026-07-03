#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Manager, State};

#[derive(Clone, Serialize, Debug)]
struct FileData {
    content: String,
    #[serde(rename = "filePath")]
    file_path: String,
    #[serde(rename = "dirUrl")]
    dir_url: String,
    name: String,
    mtime: u64,
}

fn file_mtime_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Read a markdown file and return structured data for the frontend.
fn read_md(path_str: &str) -> Result<FileData, String> {
    let p = Path::new(path_str);
    let content =
        fs::read_to_string(p).map_err(|e| format!("Failed to read {}: {}", path_str, e))?;

    let canonical = fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let dir = canonical.parent().unwrap_or(Path::new("."));

    // Build file:// URL for the directory (for relative image resolution)
    let dir_str = dir.to_string_lossy().replace('\\', "/");
    let dir_url = if dir_str.starts_with('/') {
        format!("file://{}/", dir_str)
    } else {
        format!("file:///{}/", dir_str)
    };

    let name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled")
        .to_string();

    let abs_path = canonical.to_string_lossy().to_string();
    let mtime = file_mtime_ms(&canonical);

    Ok(FileData {
        content,
        file_path: abs_path,
        dir_url,
        name,
        mtime,
    })
}

#[tauri::command]
fn get_mtime(file_path: String) -> Result<u64, String> {
    let m = file_mtime_ms(Path::new(&file_path));
    if m == 0 {
        Err(format!("Could not stat {}", file_path))
    } else {
        Ok(m)
    }
}

fn is_markdown_file(path_str: &str) -> bool {
    Path::new(path_str)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown"))
        .unwrap_or(false)
}

/// Find a .md/.markdown file path in command-line arguments.
fn file_from_args(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-') && is_markdown_file(a))
        .cloned()
}

// -- App state: holds the file path passed via CLI args on first launch --
struct AppState {
    initial_file: Mutex<Option<String>>,
}

// -- Tauri commands (called from frontend via invoke) --

#[tauri::command]
fn get_initial_file(state: State<AppState>) -> Option<FileData> {
    let mut lock = state.initial_file.lock().unwrap();
    lock.take().and_then(|path| read_md(&path).ok())
}

#[tauri::command]
fn read_file(file_path: String) -> Result<FileData, String> {
    read_md(&file_path)
}

#[tauri::command]
fn save_file(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write {}: {}", file_path, e))
}

#[tauri::command]
fn open_file_dialog(window: tauri::Window) -> Result<Option<FileData>, String> {
    use tauri_plugin_dialog::DialogExt;

    let picked = window
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .blocking_pick_file();

    match picked {
        Some(file_path) => {
            let path_buf = file_path
                .into_path()
                .map_err(|e| format!("Invalid file path: {:?}", e))?;
            let path_str = path_buf.to_string_lossy().to_string();
            read_md(&path_str).map(Some)
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn minimize_window(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn maximize_window(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) {
    let _ = window.close();
}

fn bring_to_front(window: &tauri::WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let initial_file = file_from_args(&args);

    tauri::Builder::default()
        .manage(AppState {
            initial_file: Mutex::new(initial_file),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                bring_to_front(&window);
                if let Some(path) = file_from_args(&args) {
                    if let Ok(data) = read_md(&path) {
                        let _ = window.emit("file-opened", data);
                    }
                }
            }
        }))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                bring_to_front(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_file,
            read_file,
            save_file,
            get_mtime,
            open_file_dialog,
            minimize_window,
            maximize_window,
            close_window,
        ])
        .run(tauri::generate_context!())
        .expect("error running PADD");
}
