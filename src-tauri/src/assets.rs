use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(feature = "isolated-storage-test"))]
use tauri::Manager;
use tauri::{
    ipc::{InvokeBody, Request, Response},
    AppHandle,
};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

fn is_valid_asset_id(asset_id: &str) -> bool {
    !asset_id.is_empty()
        && asset_id.len() <= 128
        && asset_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn resolved_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature = "isolated-storage-test")]
    {
        let _ = app;
        let requested = std::env::var_os("MEMENTO_ISOLATED_DATA_DIR")
            .map(PathBuf::from)
            .ok_or_else(|| "ISOLATED_DATA_DIR_REQUIRED".to_string())?;
        let manifest_directory = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let project_root = manifest_directory
            .parent()
            .ok_or_else(|| "ISOLATED_PROJECT_ROOT_ERROR".to_string())?;
        let allowed_root =
            std::fs::canonicalize(project_root.join("output").join("tauri-isolated"))
                .map_err(|error| format!("ISOLATED_ROOT_ERROR: {error}"))?;
        let resolved = std::fs::canonicalize(&requested)
            .map_err(|error| format!("ISOLATED_DATA_DIR_ERROR: {error}"))?;
        if !resolved.starts_with(&allowed_root) {
            return Err(format!(
                "ISOLATED_DATA_DIR_OUTSIDE_OUTPUT: {}",
                resolved.display()
            ));
        }
        Ok(resolved)
    }

    #[cfg(not(feature = "isolated-storage-test"))]
    {
        app.path()
            .app_data_dir()
            .map_err(|error| format!("APP_DATA_DIR_ERROR: {error}"))
    }
}

#[tauri::command]
pub fn memento_database_url(app: AppHandle) -> Result<String, String> {
    #[cfg(feature = "isolated-storage-test")]
    {
        let data_directory = resolved_data_directory(&app)?;
        let database = data_directory.join("memento.db");
        let raw_path = database.to_string_lossy();
        let sqlite_path = raw_path.strip_prefix("\\\\?\\").unwrap_or(&raw_path);
        return Ok(format!("sqlite:{sqlite_path}"));
    }

    #[cfg(not(feature = "isolated-storage-test"))]
    {
        let _ = app;
        Ok("sqlite:memento.db".to_string())
    }
}

fn assets_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = resolved_data_directory(app)?.join("assets");
    fs::create_dir_all(&directory).map_err(|error| format!("ASSET_DIRECTORY_ERROR: {error}"))?;
    Ok(directory)
}

fn asset_path(app: &AppHandle, asset_id: &str) -> Result<PathBuf, String> {
    if !is_valid_asset_id(asset_id) {
        return Err("INVALID_ASSET_ID".into());
    }
    Ok(assets_directory(app)?.join(asset_id))
}

fn write_asset_file(final_path: &Path, asset_id: &str, bytes: &[u8]) -> Result<(), String> {
    if final_path.exists() {
        return Err("ASSET_ALREADY_EXISTS".into());
    }
    let directory = final_path
        .parent()
        .ok_or_else(|| "INVALID_ASSET_DIRECTORY".to_string())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("ASSET_CLOCK_ERROR: {error}"))?
        .as_nanos();
    let sequence = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temporary_path = directory.join(format!(".{asset_id}.{nonce}.{sequence}.tmp"));

    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(|error| format!("ASSET_TEMP_CREATE_ERROR: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("ASSET_WRITE_ERROR: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("ASSET_SYNC_ERROR: {error}"))?;
        fs::hard_link(&temporary_path, final_path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "ASSET_ALREADY_EXISTS".to_string()
            } else {
                format!("ASSET_COMMIT_ERROR: {error}")
            }
        })?;
        let _ = fs::remove_file(&temporary_path);
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }
    write_result
}

#[tauri::command]
pub fn memento_store_asset_bytes(app: AppHandle, request: Request) -> Result<(), String> {
    let asset_id = request
        .headers()
        .get("x-memento-asset-id")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "MISSING_ASSET_ID".to_string())?;
    let final_path = asset_path(&app, asset_id)?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(_) => return Err("ASSET_BODY_MUST_BE_RAW_BYTES".into()),
    };
    write_asset_file(&final_path, asset_id, bytes)
}

#[tauri::command]
pub fn memento_read_asset_bytes(app: AppHandle, asset_id: String) -> Result<Response, String> {
    let path = asset_path(&app, &asset_id)?;
    match fs::symlink_metadata(&path) {
        Ok(metadata) if !metadata.file_type().is_file() => {
            return Err("ASSET_NOT_REGULAR_FILE".into())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("ASSET_NOT_FOUND".into())
        }
        Err(error) => return Err(format!("ASSET_READ_ERROR: {error}")),
    }
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("ASSET_NOT_FOUND".into())
        }
        Err(error) => return Err(format!("ASSET_READ_ERROR: {error}")),
    };
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn memento_remove_asset_file(app: AppHandle, asset_id: String) -> Result<(), String> {
    let path = asset_path(&app, &asset_id)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("ASSET_REMOVE_ERROR: {error}")),
    }
}

#[tauri::command]
pub fn memento_list_asset_ids(app: AppHandle) -> Result<Vec<String>, String> {
    let directory = assets_directory(&app)?;
    let entries = fs::read_dir(directory).map_err(|error| format!("ASSET_LIST_ERROR: {error}"))?;
    let mut ids = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("ASSET_LIST_ERROR: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("ASSET_LIST_ERROR: {error}"))?
            .is_file()
        {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_valid_asset_id(&name) {
            ids.push(name);
        }
    }
    ids.sort();
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::thread;

    use super::{is_valid_asset_id, write_asset_file};

    static TEST_DIRECTORY_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn asset_ids_cannot_escape_the_assets_directory() {
        assert!(is_valid_asset_id("photo_1234-abcd"));
        assert!(!is_valid_asset_id("../outside"));
        assert!(!is_valid_asset_id("C:\\outside"));
        assert!(!is_valid_asset_id(""));
        assert!(!is_valid_asset_id(&"a".repeat(129)));
    }

    #[test]
    fn concurrent_asset_commit_never_replaces_an_existing_file() {
        let sequence = TEST_DIRECTORY_COUNTER.fetch_add(1, Ordering::Relaxed);
        let directory = std::env::temp_dir().join(format!(
            "memento-assets-test-{}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("create isolated test directory");
        let final_path = directory.join("shared_asset");
        let first_path = final_path.clone();
        let second_path = final_path.clone();
        let first =
            thread::spawn(move || write_asset_file(&first_path, "shared_asset", &[1, 2, 3]));
        let second =
            thread::spawn(move || write_asset_file(&second_path, "shared_asset", &[9, 8, 7]));
        let outcomes = [
            first.join().expect("first writer thread"),
            second.join().expect("second writer thread"),
        ];

        assert_eq!(outcomes.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(outcomes.iter().filter(|result| result.is_err()).count(), 1);
        let bytes = fs::read(&final_path).expect("one writer should commit");
        assert!(bytes == [1, 2, 3] || bytes == [9, 8, 7]);
        assert_eq!(
            fs::read_dir(&directory)
                .expect("read isolated directory")
                .count(),
            1
        );

        fs::remove_file(&final_path).expect("remove test asset");
        fs::remove_dir(&directory).expect("remove isolated test directory");
    }
}
