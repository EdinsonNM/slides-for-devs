mod api_keys;
mod db;

use std::path::PathBuf;
use tauri::Manager;

/// Path to the SQLite database file (AppData/presentations.db).
struct DbPath(PathBuf);

#[tauri::command]
fn save_presentation(
    db_path: tauri::State<DbPath>,
    presentation: db::Presentation,
) -> Result<String, String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::save_presentation(&conn, &presentation).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_presentation(
    db_path: tauri::State<DbPath>,
    id: String,
    presentation: db::Presentation,
) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::update_presentation(&conn, &id, &presentation).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_presentation(
    db_path: tauri::State<DbPath>,
    id: String,
) -> Result<db::SavedPresentation, String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::load_presentation(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_presentations(
    db_path: tauri::State<DbPath>,
) -> Result<Vec<db::SavedPresentationMeta>, String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::list_presentations(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_presentation(db_path: tauri::State<DbPath>, id: String) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::delete_presentation(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_characters(db_path: tauri::State<DbPath>) -> Result<Vec<db::SavedCharacter>, String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::list_characters(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_character(
    db_path: tauri::State<DbPath>,
    character: db::SavedCharacter,
) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::save_character(&conn, &character).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_character(db_path: tauri::State<DbPath>, id: String) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::delete_character(&conn, &id).map_err(|e| e.to_string())
}

// --- API keys (keychain seguro) ---

#[tauri::command]
fn get_gemini_api_key() -> Result<Option<String>, String> {
    api_keys::get_gemini_api_key()
}

#[tauri::command]
fn set_gemini_api_key(key: String) -> Result<(), String> {
    api_keys::set_gemini_api_key(&key)
}

#[tauri::command]
fn get_openai_api_key() -> Result<Option<String>, String> {
    api_keys::get_openai_api_key()
}

#[tauri::command]
fn set_openai_api_key(key: String) -> Result<(), String> {
    api_keys::set_openai_api_key(&key)
}

#[tauri::command]
fn get_xai_api_key() -> Result<Option<String>, String> {
    api_keys::get_xai_api_key()
}

#[tauri::command]
fn set_xai_api_key(key: String) -> Result<(), String> {
    api_keys::set_xai_api_key(&key)
}

#[tauri::command]
fn has_any_api_configured() -> Result<bool, String> {
    api_keys::has_any_api_configured()
}

// --- Presentaciones ---

/// Migrates existing JSON presentation files (AppData/presentations/*.json) into SQLite.
/// Call once on startup or via a button. Deletes each JSON file after successful import.
#[tauri::command]
fn migrate_json_presentations(
    app: tauri::AppHandle,
    db_path: tauri::State<DbPath>,
) -> Result<u32, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let presentations_dir = app_data_dir.join("presentations");
    if !presentations_dir.is_dir() {
        return Ok(0);
    }
    let mut count = 0u32;
    let conn =
        rusqlite::Connection::open(&db_path.0).map_err(|e| e.to_string())?;
    let entries = std::fs::read_dir(&presentations_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "json") {
            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
                    log::warn!("migrate: could not read {:?}: {}", path, e);
                    continue;
                }
            };
            let saved: db::SavedPresentation = match serde_json::from_str(&content) {
                Ok(s) => s,
                Err(e) => {
                    log::warn!("migrate: invalid JSON {:?}: {}", path, e);
                    continue;
                }
            };
            if saved.topic.is_empty() || saved.slides.is_empty() {
                continue;
            }
            if db::import_presentation(&conn, &saved).is_err() {
                continue;
            }
            let _ = std::fs::remove_file(&path);
            count += 1;
        }
    }
    Ok(count)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn desktop_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn desktop_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_fs::init());
    let builder = desktop_plugins(builder);
    builder
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?;
            let db_path = app_data_dir.join("presentations.db");
            db::init_db(&db_path).map_err(|e| e.to_string())?;
            app.manage(DbPath(db_path));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_gemini_api_key,
            set_gemini_api_key,
            get_openai_api_key,
            set_openai_api_key,
            get_xai_api_key,
            set_xai_api_key,
            has_any_api_configured,
            save_presentation,
            update_presentation,
            load_presentation,
            list_presentations,
            delete_presentation,
            migrate_json_presentations,
            list_characters,
            save_character,
            delete_character,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
