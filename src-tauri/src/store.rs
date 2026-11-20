//! Local persistence. Plain JSON files — no account, no cloud sync, no telemetry.
//! The frontend owns the schema; Rust only reads/writes the documents atomically.
//!
//! Two folders:
//! - the vault, `$XDG_CONFIG_HOME/voidhttp` or `~/.config/voidhttp`: workspace, history and
//!   stored responses. Copy this one folder to move everything to another device.
//! - the app data dir (`~/Library/Application Support/dev.voidhttp.app` on macOS): per-device
//!   session state (open tabs, layout) and write-only backups.
//!
//! Debug builds (`bun tauri dev`) keep their own copy of both, so development never touches real
//! data: the vault is `~/.config/voidHTTP_dev` and the local folder is `dev/` inside the app data dir.

use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

/// Portable documents, kept in the vault.
const VAULT_DOCS: &[&str] = &["workspace", "history"];
/// Per-device documents, kept in the app data dir.
const LOCAL_DOCS: &[&str] = &["session"];
/// Write-only documents (never loaded back): the v1 data kept once before the projects migration.
const WRITE_ONLY: &[&str] = &["backup-v1"];
/// Written to the app data dir once the old data was copied into the vault (or found nothing to copy).
const MIGRATED_MARKER: &str = ".vault-migrated";
/// The vault's folder name inside the config dir.
const VAULT_NAME: &str = if cfg!(debug_assertions) { "voidHTTP_dev" } else { "voidhttp" };

fn local_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut dir = app_data_dir(app)?;
    if cfg!(debug_assertions) {
        dir = dir.join("dev");
    }
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
    Ok(dir)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))
}

pub(crate) fn vault_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let config = match std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from) {
        Some(p) if p.is_absolute() => p,
        _ => app
            .path()
            .home_dir()
            .map_err(|e| format!("cannot resolve home dir: {e}"))?
            .join(".config"),
    };
    let dir = config.join(VAULT_NAME);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {dir:?}: {e}"))?;
        // Requests and variables can hold tokens: keep the folder private to the user.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
        }
    }
    Ok(dir)
}

fn doc_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = if VAULT_DOCS.contains(&name) {
        vault_dir(app)?
    } else if LOCAL_DOCS.contains(&name) || WRITE_ONLY.contains(&name) {
        local_dir(app)?
    } else {
        return Err(format!("unknown document: {name}"));
    };
    Ok(dir.join(format!("{name}.json")))
}

/// Copies `from` to `to` through a temp file, so a crash never leaves a half file.
fn copy_atomic(from: &Path, to: &Path) -> Result<(), String> {
    let tmp = to.with_extension("json.tmp");
    std::fs::copy(from, &tmp).map_err(|e| format!("copy {from:?}: {e}"))?;
    std::fs::rename(&tmp, to).map_err(|e| format!("rename {tmp:?}: {e}"))
}

/// One time: copies workspace, history and responses from the app data dir into the vault.
/// The originals stay where they were, as a backup. Only fills what the vault is missing,
/// and never touches a vault that already has a workspace (brought from another device).
fn migrate_to_vault(app: &AppHandle) -> Result<(), String> {
    let local = local_dir(app)?;
    let marker = local.join(MIGRATED_MARKER);
    if marker.exists() {
        return Ok(());
    }
    let vault = vault_dir(app)?;
    if !vault.join("workspace.json").exists() {
        let old_responses = local.join("responses");
        if old_responses.is_dir() {
            let new_responses = vault.join("responses");
            std::fs::create_dir_all(&new_responses).map_err(|e| format!("cannot create {new_responses:?}: {e}"))?;
            for entry in std::fs::read_dir(&old_responses).map_err(|e| format!("read {old_responses:?}: {e}"))? {
                let entry = entry.map_err(|e| e.to_string())?;
                let name = entry.file_name();
                let to = new_responses.join(&name);
                if name.to_string_lossy().ends_with(".json") && !to.exists() {
                    copy_atomic(&entry.path(), &to)?;
                }
            }
        }
        // workspace last: its presence is what marks the vault as filled.
        for name in ["history.json", "workspace.json"] {
            let (from, to) = (local.join(name), vault.join(name));
            if from.exists() && !to.exists() {
                copy_atomic(&from, &to)?;
            }
        }
    }
    std::fs::write(&marker, vault.to_string_lossy().as_bytes()).map_err(|e| format!("write {marker:?}: {e}"))
}

/// Returns `{ workspace, history, session }`, each `null` when absent or corrupt.
/// Fails when a file exists but cannot be read (permissions, a cloud-offloaded file), so the
/// frontend never mistakes real data for a fresh install and saves an empty state over it.
#[tauri::command]
pub async fn load_state(app: AppHandle) -> Result<Value, String> {
    migrate_to_vault(&app)?;
    let mut out = Map::new();
    for name in VAULT_DOCS.iter().chain(LOCAL_DOCS) {
        let path = doc_path(&app, name)?;
        let value = match tokio::fs::read(&path).await {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|e| {
                // Keep the corrupt file for manual recovery instead of overwriting it.
                let _ = std::fs::rename(&path, path.with_extension("json.corrupt"));
                eprintln!("voidHTTP: {name}.json is corrupt ({e}); moved aside");
                Value::Null
            }),
            Err(e) if e.kind() == ErrorKind::NotFound => Value::Null,
            Err(e) => return Err(format!("cannot read {path:?}: {e}")),
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
    let dir = vault_dir(app)?.join("responses");
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
