mod assets;

#[cfg(feature = "isolated-storage-test")]
fn write_isolated_diagnostic(message: &str) {
    use std::io::Write as _;

    let data_directory =
        std::env::var_os("MEMENTO_ISOLATED_DATA_DIR").map(std::path::PathBuf::from);
    let fallback_directory = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|root| root.join("output").join("tauri-isolated"));
    let log_directory = data_directory
        .as_ref()
        .and_then(|path| path.parent())
        .and_then(std::path::Path::parent)
        .map(std::path::Path::to_path_buf)
        .or(fallback_directory);
    let Some(log_path) = log_directory.map(|directory| directory.join("tauri-runtime.log")) else {
        return;
    };
    if let Ok(mut log) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(
            log,
            "pid={} data_dir={:?} {message}",
            std::process::id(),
            data_directory
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "isolated-storage-test")]
    write_isolated_diagnostic("run");

    let builder = tauri::Builder::default();

    #[cfg(not(feature = "isolated-storage-test-no-sql"))]
    let builder = builder.plugin(tauri_plugin_sql::Builder::default().build());

    let builder = builder.invoke_handler(tauri::generate_handler![
        assets::memento_database_url,
        assets::memento_store_asset_bytes,
        assets::memento_read_asset_bytes,
        assets::memento_remove_asset_file,
        assets::memento_list_asset_ids,
    ]);

    #[cfg(feature = "isolated-storage-test")]
    let builder = builder.setup(|_app| {
        write_isolated_diagnostic("setup");
        Ok(())
    });

    #[cfg(feature = "isolated-storage-test")]
    let builder = builder.on_page_load(|webview, payload| {
        write_isolated_diagnostic(&format!(
            "{:?}\t{}\t{}",
            payload.event(),
            payload.url(),
            webview.label()
        ));
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
