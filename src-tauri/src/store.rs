//! Local persistence. Plain JSON files in the app data dir — no account,
//! no cloud sync, no telemetry. The frontend owns the schema; Rust only
//! reads/writes the documents atomically.

use std::path::PathBuf;

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

/// Only these document names may be read or written.
const DOCS: &[&str] = &["workspace", "history", "session"];
/// Write-only documents (never loaded back): the v1 data kept once before the projects migration.
const WRITE_ONLY: &[&str] = &["backup-v1"];

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir)
}

fn doc_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if !DOCS.contains(&name) && !WRITE_ONLY.contains(&name) {
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

// ---------- responses kept with history: one file per history entry ----------

fn responses_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("responses");
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir)
}

/// History entry ids are uuids (or base36 on old webviews): nothing that can leave the folder.
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn response_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("invalid response id: {id}"));
    }
    Ok(responses_dir(app)?.join(format!("{id}.json")))
}

/// Writes the response of history entry `id`, atomically like `save_state`.
#[tauri::command]
pub async fn save_response(app: AppHandle, id: String, data: Value) -> Result<(), String> {
    let path = response_path(&app, &id)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(&data).map_err(|e| e.to_string())?;
    tokio::fs::write(&tmp, bytes)
        .await
        .map_err(|e| format!("write {tmp:?}: {e}"))?;
    tokio::fs::rename(&tmp, &path)
        .await
        .map_err(|e| format!("rename {tmp:?}: {e}"))?;
    Ok(())
}

/// The stored response of history entry `id`, or `null` when there is none.
#[tauri::command]
pub async fn load_response(app: AppHandle, id: String) -> Result<Value, String> {
    let path = response_path(&app, &id)?;
    match tokio::fs::read(&path).await {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes).unwrap_or(Value::Null)),
        Err(_) => Ok(Value::Null),
    }
}

/// Deletes every stored response whose id is not in `keep` (entries that fell off the limit,
/// were deleted, or belonged to a cleared history or a deleted project). Returns how many went.
#[tauri::command]
pub async fn prune_responses(app: AppHandle, keep: Vec<String>) -> Result<u32, String> {
    let dir = responses_dir(&app)?;
    let keep: std::collections::HashSet<String> = keep.into_iter().collect();
    let mut removed = 0;
    let mut entries = tokio::fs::read_dir(&dir).await.map_err(|e| format!("read {dir:?}: {e}"))?;
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let name = entry.file_name().to_string_lossy().into_owned();
        let stale = match name.strip_suffix(".json") {
            Some(id) => !keep.contains(id),
            None => name.ends_with(".json.tmp"),
        };
        if stale && tokio::fs::remove_file(entry.path()).await.is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::valid_id;

    #[test]
    fn response_ids_cannot_escape_the_folder() {
        assert!(valid_id("3f2b9c1e-8a7d-4c1b-9f0e-1a2b3c4d5e6f"));
        assert!(valid_id("lq3k9x0abc"));
        assert!(!valid_id(""));
        assert!(!valid_id("../workspace"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id("a.json"));
        assert!(!valid_id(&"a".repeat(65)));
    }
}
