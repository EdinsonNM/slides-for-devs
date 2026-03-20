mod api_keys;
mod ai_providers;
mod db;
mod oauth_google;

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
fn import_saved_presentation(
    db_path: tauri::State<DbPath>,
    saved: db::SavedPresentation,
) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::import_saved_presentation(&conn, &saved).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_presentation_cloud_state(
    db_path: tauri::State<DbPath>,
    id: String,
    cloud_id: Option<String>,
    cloud_synced_at: Option<String>,
    cloud_revision: Option<i64>,
) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::set_presentation_cloud_state(
        &conn,
        &id,
        cloud_id.as_deref(),
        cloud_synced_at.as_deref(),
        cloud_revision,
    )
    .map_err(|e| e.to_string())
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

#[tauri::command]
fn set_character_cloud_state(
    db_path: tauri::State<DbPath>,
    id: String,
    cloud_synced_at: Option<String>,
    cloud_revision: Option<i64>,
) -> Result<(), String> {
    let path = &db_path.0;
    let conn = rusqlite::Connection::open(path).map_err(|e| e.to_string())?;
    db::set_character_cloud_state(
        &conn,
        &id,
        cloud_synced_at.as_deref(),
        cloud_revision,
    )
    .map_err(|e| e.to_string())
}

/// Escribe un archivo binario desde base64. Usado para exportar .pptx (el frontend abre el diálogo de guardar).
#[tauri::command]
fn write_binary_file(path: String, base64_content: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())
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
fn get_groq_api_key() -> Result<Option<String>, String> {
    api_keys::get_groq_api_key()
}

#[tauri::command]
fn set_groq_api_key(key: String) -> Result<(), String> {
    api_keys::set_groq_api_key(&key)
}

#[tauri::command]
fn get_cerebras_api_key() -> Result<Option<String>, String> {
    api_keys::get_cerebras_api_key()
}

#[tauri::command]
fn set_cerebras_api_key(key: String) -> Result<(), String> {
    api_keys::set_cerebras_api_key(&key)
}

#[tauri::command]
fn get_openrouter_api_key() -> Result<Option<String>, String> {
    api_keys::get_openrouter_api_key()
}

#[tauri::command]
fn set_openrouter_api_key(key: String) -> Result<(), String> {
    api_keys::set_openrouter_api_key(&key)
}

#[tauri::command]
fn has_any_api_configured() -> Result<bool, String> {
    api_keys::has_any_api_configured()
}

#[tauri::command]
fn provider_chat_completion(
    provider: String,
    request: ai_providers::ProviderChatRequest,
) -> Result<ai_providers::ProviderTextResponse, String> {
    ai_providers::provider_chat_completion(provider, request)
}

// --- Firebase (Slaim en la nube): config desde archivo en AppData o raíz del proyecto ---

#[derive(serde::Deserialize, serde::Serialize)]
struct FirebaseConfig {
    #[serde(alias = "apiKey")]
    api_key: String,
    #[serde(alias = "authDomain")]
    auth_domain: String,
    #[serde(alias = "projectId")]
    project_id: String,
    #[serde(alias = "storageBucket")]
    storage_bucket: String,
    #[serde(alias = "messagingSenderId")]
    messaging_sender_id: String,
    #[serde(alias = "appId")]
    app_id: String,
    #[serde(default, alias = "measurementId")]
    measurement_id: Option<String>,
}

/// Busca firebase_config.json en: AppData, resource_dir, cwd, padre del cwd (dev), o subiendo desde el exe.
fn find_firebase_config(app: &tauri::AppHandle) -> Result<Option<std::path::PathBuf>, String> {
    let filename = "firebase_config.json";

    // En dev: priorizar raíz del proyecto (donde está package.json + firebase_config.json)
    #[cfg(debug_assertions)]
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent();
        for _ in 0..8 {
            if let Some(d) = dir {
                let config = d.join(filename);
                let package = d.join("package.json");
                if config.exists() && package.exists() {
                    return Ok(Some(config));
                }
                dir = d.parent();
            } else {
                break;
            }
        }
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let in_app_data = app_data_dir.join(filename);
    if in_app_data.exists() {
        return Ok(Some(in_app_data));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let in_resource = resource_dir.join(filename);
        if in_resource.exists() {
            return Ok(Some(in_resource));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let in_cwd = cwd.join(filename);
        if in_cwd.exists() {
            return Ok(Some(in_cwd));
        }
        if let Some(parent) = cwd.parent() {
            let in_parent = parent.join(filename);
            if in_parent.exists() {
                return Ok(Some(in_parent));
            }
        }
    }
    if let Ok(exe_path) = std::env::current_exe() {
        let mut dir = exe_path.parent();
        for _ in 0..6 {
            if let Some(d) = dir {
                let candidate = d.join(filename);
                if candidate.exists() {
                    return Ok(Some(candidate));
                }
                dir = d.parent();
            } else {
                break;
            }
        }
    }
    Ok(None)
}

#[tauri::command]
fn get_firebase_config(app: tauri::AppHandle) -> Result<Option<FirebaseConfig>, String> {
    let path = match find_firebase_config(&app)? {
        Some(p) => p,
        None => return Ok(None),
    };
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: FirebaseConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(config))
}

/// Login con Google vía navegador del sistema (loopback 127.0.0.1:8765). Requiere
/// `googleOauthClientId` en firebase_config.json y esa URI en la consola Google.
#[tauri::command]
fn sign_in_google_external_browser(app: tauri::AppHandle) -> Result<String, String> {
    let path = find_firebase_config(&app)?
        .ok_or_else(|| "No se encontró firebase_config.json".to_string())?;
    #[cfg(debug_assertions)]
    eprintln!("[Slaim] Leyendo config desde: {}", path.display());
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    oauth_google::sign_in_with_external_browser(&content)
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
            get_firebase_config,
            sign_in_google_external_browser,
            get_gemini_api_key,
            set_gemini_api_key,
            get_openai_api_key,
            set_openai_api_key,
            get_xai_api_key,
            set_xai_api_key,
            get_groq_api_key,
            set_groq_api_key,
            get_cerebras_api_key,
            set_cerebras_api_key,
            get_openrouter_api_key,
            set_openrouter_api_key,
            has_any_api_configured,
            provider_chat_completion,
            save_presentation,
            update_presentation,
            load_presentation,
            list_presentations,
            delete_presentation,
            import_saved_presentation,
            set_presentation_cloud_state,
            migrate_json_presentations,
            list_characters,
            save_character,
            delete_character,
            set_character_cloud_state,
            write_binary_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
