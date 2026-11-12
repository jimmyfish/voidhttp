//! Local persistence. Plain JSON files in the app data dir — no account,
//! no cloud sync, no telemetry. The frontend owns the schema; Rust only
//! reads/writes the documents atomically.

use std::path::PathBuf;

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

/// Only these document names may be read or written.
const DOCS: &[&str] = &["workspace", "history", "session"];

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir)
}

fn doc_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if !DOCS.contains(&name) {
        return Err(format!("unknown document: {name}"));
    }
    Ok(data_dir(app)?.join(format!("{name}.json")))
}

/// Returns `{ workspace, history, session }`, each `null` when absent or corrupt.
#[tauri::command]
pub async fn load_state(app: AppHandle) -> Result<Value, String> {
    let mut out = Map::new();
    for name in DOCS {
        let path = doc_path(&app, name)?;
        let value = match tokio::fs::read(&path).await {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|e| {
                // Keep the corrupt file for manual recovery instead of overwriting it.
                let _ = std::fs::rename(&path, path.with_extension("json.corrupt"));
                eprintln!("voidHTTP: {name}.json is corrupt ({e}); moved aside");
                Value::Null
            }),
            Err(_) => Value::Null,
        };
        out.insert((*name).to_string(), value);
    }
    Ok(Value::Object(out))
}

/// Writes atomically: temp file + rename, so a crash never leaves a half file.
#[tauri::command]
pub async fn save_state(app: AppHandle, name: String, data: Value) -> Result<(), String> {
    let path = doc_path(&app, &name)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?;
    tokio::fs::write(&tmp, bytes)
        .await
        .map_err(|e| format!("write {tmp:?}: {e}"))?;
    tokio::fs::rename(&tmp, &path)
        .await
        .map_err(|e| format!("rename {tmp:?}: {e}"))?;
    Ok(())
}
