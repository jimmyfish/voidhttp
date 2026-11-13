//! Plain text files for import and export: read a file the person picked or dropped
//! (and files an OpenAPI `$ref` points to beside it), write the export where they chose to save it.

use std::path::Path;

/// Larger files are refused before they are read: a HAR with bodies can be big, but not this big.
const MAX_READ: u64 = 64 * 1024 * 1024;

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("cannot read {path}: {e}"))?;
    if !meta.is_file() {
        return Err(format!("{path} is not a file"));
    }
    if meta.len() > MAX_READ {
        return Err(format!("{path} is larger than 64 MB"));
    }
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("cannot read {path}: {e}"))?;
    String::from_utf8(bytes).map_err(|_| format!("{path} is not UTF-8 text"))
}

/// Writes next to the target first, then renames, so a failed write never leaves half a file.
#[tauri::command]
pub async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let target = Path::new(&path);
    let name = target
        .file_name()
        .ok_or_else(|| format!("{path} is not a file path"))?
        .to_string_lossy()
        .into_owned();
    let tmp = target.with_file_name(format!(".{name}.tmp"));
    tokio::fs::write(&tmp, contents.as_bytes())
        .await
        .map_err(|e| format!("cannot write {path}: {e}"))?;
    if let Err(e) = tokio::fs::rename(&tmp, target).await {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err(format!("cannot write {path}: {e}"));
    }
    Ok(())
}
