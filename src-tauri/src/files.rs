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

/// A file named by an OpenAPI `$ref`: read only when it resolves, symlinks followed, to the spec's
/// folder or below it. The webview's own check compares paths as text, which a symlink gets past.
/// Only spec files (.json, .yaml, .yml) outside hidden folders and outside voidHTTP's own data are read:
/// a spec saved in Downloads or the home folder must not reach a HAR capture, `.config`, or the vault.
#[tauri::command]
pub async fn read_ref_file(app: tauri::AppHandle, spec: String, path: String) -> Result<String, String> {
    use tauri::Manager;
    let mut own = vec![];
    if let Ok(d) = crate::store::vault_dir(&app) {
        own.push(d);
    }
    if let Ok(d) = app.path().app_data_dir() {
        own.push(d);
    }
    read_ref(&spec, &path, &own).await
}

async fn read_ref(spec: &str, path: &str, own: &[std::path::PathBuf]) -> Result<String, String> {
    let dir = Path::new(spec)
        .parent()
        .ok_or_else(|| format!("{spec} has no folder"))?;
    let dir = tokio::fs::canonicalize(dir)
        .await
        .map_err(|e| format!("cannot read {path}: {e}"))?;
    let real = tokio::fs::canonicalize(path)
        .await
        .map_err(|e| format!("cannot read {path}: {e}"))?;
    let Ok(inside) = real.strip_prefix(&dir) else {
        return Err(format!("{path} is outside the spec's folder"));
    };
    if inside.components().any(|c| c.as_os_str().to_string_lossy().starts_with('.')) {
        return Err(format!("{path} is in a hidden folder"));
    }
    let ext = real.extension().map(|e| e.to_string_lossy().to_lowercase());
    if !matches!(ext.as_deref(), Some("json" | "yaml" | "yml")) {
        return Err(format!("{path} is not a .json, .yaml or .yml file"));
    }
    for d in own {
        if tokio::fs::canonicalize(d).await.is_ok_and(|d| real.starts_with(d)) {
            return Err(format!("{path} is voidHTTP's own data"));
        }
    }
    read_text_file(real.to_string_lossy().into_owned()).await
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
    // a fresh, unguessable name, created only if nothing is there: a symlink planted at a predictable
    // temp name (from a cloned repo or an unzipped download) would otherwise send the write elsewhere
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = target.with_file_name(format!(".{name}.{}-{nonce:x}.tmp", std::process::id()));
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp)
        .await
        .map_err(|e| format!("cannot write {path}: {e}"))?;
    let written = async {
        use tokio::io::AsyncWriteExt;
        file.write_all(contents.as_bytes()).await?;
        file.flush().await
    }
    .await;
    drop(file);
    if let Err(e) = written {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err(format!("cannot write {path}: {e}"));
    }
    if let Err(e) = tokio::fs::rename(&tmp, target).await {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err(format!("cannot write {path}: {e}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{read_ref, write_text_file};
    use std::fs;

    #[test]
    fn ref_files_stay_in_the_spec_folder_through_symlinks() {
        let home = std::env::temp_dir().join(format!("voidhttp-ref-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        let repo = home.join("code").join("vendor-api");
        fs::create_dir_all(repo.join("schemas")).unwrap();
        fs::create_dir_all(home.join(".config").join("voidhttp")).unwrap();
        fs::write(home.join(".config/voidhttp/workspace.json"), "CANARY-SECRET").unwrap();
        fs::write(repo.join("schemas/pet.yaml"), "type: object").unwrap();
        std::os::unix::fs::symlink("../../../.config/voidhttp/workspace.json", repo.join("schemas/common.json")).unwrap();
        let spec = repo.join("openapi.yaml").to_string_lossy().into_owned();
        let read = |p: &str| tauri::async_runtime::block_on(read_ref(&spec, &repo.join(p).to_string_lossy(), &[]));

        assert_eq!(read("schemas/pet.yaml").unwrap(), "type: object");
        let err = read("schemas/common.json").unwrap_err();
        assert!(err.contains("outside the spec's folder"), "{err}");
        assert!(read("../../.config/voidhttp/workspace.json").is_err());
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn a_spec_in_the_home_folder_reaches_no_secrets_beside_it() {
        let home = std::env::temp_dir().join(format!("voidhttp-home-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        let vault = home.join("vault");
        fs::create_dir_all(home.join(".config/voidhttp")).unwrap();
        fs::create_dir_all(&vault).unwrap();
        fs::write(home.join(".config/voidhttp/workspace.json"), "CANARY-VAULT").unwrap();
        fs::write(vault.join("workspace.json"), "CANARY-OWN").unwrap();
        fs::write(home.join("app.vendor.com.har"), "CANARY-HAR").unwrap();
        fs::write(home.join("schema.yml"), "type: string").unwrap();
        let spec = home.join("openapi.yaml").to_string_lossy().into_owned();
        let own = [vault.clone()];
        let read = |p: &str| tauri::async_runtime::block_on(read_ref(&spec, &home.join(p).to_string_lossy(), &own));

        assert_eq!(read("schema.yml").unwrap(), "type: string");
        assert!(read(".config/voidhttp/workspace.json").unwrap_err().contains("hidden folder"));
        assert!(read("app.vendor.com.har").unwrap_err().contains(".json, .yaml or .yml"));
        assert!(read("vault/workspace.json").unwrap_err().contains("own data"));
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn an_export_does_not_follow_a_planted_temp_symlink() {
        let dir = std::env::temp_dir().join(format!("voidhttp-write-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("repo")).unwrap();
        fs::write(dir.join("zshrc"), "ORIGINAL").unwrap();
        // the old predictable temp name, pointing out of the folder
        std::os::unix::fs::symlink("../zshrc", dir.join("repo/.export.json.tmp")).unwrap();
        let target = dir.join("repo/export.json").to_string_lossy().into_owned();
        tauri::async_runtime::block_on(write_text_file(target.clone(), "{\"a\":1}".into())).unwrap();
        assert_eq!(fs::read_to_string(dir.join("zshrc")).unwrap(), "ORIGINAL");
        assert_eq!(fs::read_to_string(&target).unwrap(), "{\"a\":1}");
        assert!(!fs::symlink_metadata(&target).unwrap().file_type().is_symlink());
        let _ = fs::remove_dir_all(&dir);
    }
}
