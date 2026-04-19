//! Cliente HTTP para la API de Meshy (texto / imagen → GLB).
//! @see https://docs.meshy.ai/en/api/text-to-3d
//! @see https://docs.meshy.ai/en/api/image-to-3d

use crate::api_keys;
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue, USER_AGENT};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const APP_USER_AGENT: &str = "Slaim/0.1 (https://slaim.app; Tauri; Meshy)";
const MESHY_API: &str = "https://api.meshy.ai";
const POLL_MS: u64 = 3000;
const POLL_MAX: u32 = 400;

/// Evento IPC para que el frontend muestre avance (Meshy puede tardar minutos).
pub const MESHY_TASK_PROGRESS_EVENT: &str = "meshy-task-progress";

fn http_client() -> Result<Client, String> {
    Client::builder()
        .no_zstd()
        .no_brotli()
        .no_gzip()
        .timeout(Duration::from_secs(180))
        .connect_timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())
}

fn emit_progress(app: &AppHandle, phase: &str, status: &str, progress: u64) {
    let _ = app.emit(
        MESHY_TASK_PROGRESS_EVENT,
        json!({
            "phase": phase,
            "status": status,
            "progress": progress,
        }),
    );
}

fn bearer_headers(api_key: &str) -> Result<HeaderMap, String> {
    let mut h = HeaderMap::new();
    let auth = HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
        .map_err(|e| format!("API key inválida: {}", e))?;
    h.insert(AUTHORIZATION, auth);
    h.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    h.insert(
        USER_AGENT,
        HeaderValue::from_static(APP_USER_AGENT),
    );
    Ok(h)
}

fn meshy_api_key() -> Result<String, String> {
    api_keys::get_meshy_api_key()?
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            "Configura tu API key de Meshy en Configuración de IA.".to_string()
        })
}

fn read_task_id(body: &Value) -> Result<String, String> {
    body.get("result")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| format!("Respuesta Meshy sin task id: {}", body))
}

fn task_status(task: &Value) -> String {
    task.get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn task_error_message(task: &Value) -> Option<String> {
    task.pointer("/task_error/message")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn glb_url_from_task(task: &Value) -> Option<String> {
    task.pointer("/model_urls/glb")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn post_json(client: &Client, url: &str, api_key: &str, body: &Value) -> Result<Value, String> {
    let resp = client
        .post(url)
        .headers(bearer_headers(api_key)?)
        .json(body)
        .send()
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    let text = resp.text().map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&text).unwrap_or(json!({ "raw": text }));
    if !status.is_success() {
        let msg = v
            .pointer("/message")
            .and_then(|m| m.as_str())
            .or_else(|| v.get("error").and_then(|e| e.as_str()))
            .unwrap_or(&text);
        return Err(format!("Meshy HTTP {}: {}", status.as_u16(), msg));
    }
    Ok(v)
}

fn get_json(client: &Client, url: &str, api_key: &str) -> Result<Value, String> {
    let mut h = HeaderMap::new();
    let auth = HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
        .map_err(|e| format!("API key inválida: {}", e))?;
    h.insert(AUTHORIZATION, auth);
    h.insert(USER_AGENT, HeaderValue::from_static(APP_USER_AGENT));
    let resp = client
        .get(url)
        .headers(h)
        .send()
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    let text = resp.text().map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(&text).unwrap_or(json!({ "raw": text }));
    if !status.is_success() {
        let msg = v
            .pointer("/message")
            .and_then(|m| m.as_str())
            .unwrap_or(&text);
        return Err(format!("Meshy HTTP {}: {}", status.as_u16(), msg));
    }
    Ok(v)
}

fn poll_until_glb(
    app: &AppHandle,
    client: &Client,
    api_key: &str,
    poll_url: &str,
    phase: &str,
) -> Result<String, String> {
    for _ in 0..POLL_MAX {
        let task = get_json(client, poll_url, api_key)?;
        let status = task_status(&task);
        let progress = task
            .get("progress")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        emit_progress(app, phase, &status, progress);
        match status.as_str() {
            "SUCCEEDED" => {
                return glb_url_from_task(&task).ok_or_else(|| {
                    "Meshy completó la tarea pero no hay URL de modelo .glb.".to_string()
                });
            }
            "FAILED" | "CANCELED" => {
                let err = task_error_message(&task)
                    .unwrap_or_else(|| format!("Tarea Meshy {}", status.to_lowercase()));
                return Err(err);
            }
            _ => std::thread::sleep(std::time::Duration::from_millis(POLL_MS)),
        }
    }
    Err("Tiempo de espera agotado esperando a Meshy.".to_string())
}

fn normalize_ai_model(ai_model: &str) -> String {
    let t = ai_model.trim();
    if t.is_empty() {
        return "latest".to_string();
    }
    t.to_string()
}

/// Texto → GLB (preview + refine con textura, según `with_texture`).
pub fn meshy_text_to_3d_glb(
    app: &AppHandle,
    prompt: String,
    ai_model: String,
    with_texture: bool,
) -> Result<String, String> {
    let api_key = meshy_api_key()?;
    let client = http_client()?;
    let model = normalize_ai_model(&ai_model);
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("El prompt no puede estar vacío.".to_string());
    }
    if prompt.len() > 600 {
        return Err("El prompt supera los 600 caracteres permitidos por Meshy.".to_string());
    }

    emit_progress(app, "preview", "CREATING", 0);

    let preview_body = json!({
        "mode": "preview",
        "prompt": prompt,
        "ai_model": model,
        "target_formats": ["glb"]
    });
    let create = post_json(
        &client,
        &format!("{}/openapi/v2/text-to-3d", MESHY_API),
        &api_key,
        &preview_body,
    )?;
    let preview_id = read_task_id(&create)?;
    emit_progress(app, "preview", "POLLING", 0);
    let preview_url = format!("{}/openapi/v2/text-to-3d/{}", MESHY_API, preview_id);
    if !with_texture {
        return poll_until_glb(app, &client, &api_key, &preview_url, "preview");
    }
    let _preview_mesh = poll_until_glb(app, &client, &api_key, &preview_url, "preview")?;

    emit_progress(app, "refine", "CREATING_REFINE", 0);
    let refine_body = json!({
        "mode": "refine",
        "preview_task_id": preview_id,
        "ai_model": model,
        "target_formats": ["glb"]
    });
    let refine_create = post_json(
        &client,
        &format!("{}/openapi/v2/text-to-3d", MESHY_API),
        &api_key,
        &refine_body,
    )?;
    let refine_id = read_task_id(&refine_create)?;
    emit_progress(app, "refine", "POLLING", 0);
    let refine_url = format!("{}/openapi/v2/text-to-3d/{}", MESHY_API, refine_id);
    poll_until_glb(app, &client, &api_key, &refine_url, "refine")
}

/// Imagen (URL o data URI) → GLB.
pub fn meshy_image_to_3d_glb(
    app: &AppHandle,
    image_url: String,
    ai_model: String,
    should_texture: bool,
) -> Result<String, String> {
    let api_key = meshy_api_key()?;
    let client = http_client()?;
    let model = normalize_ai_model(&ai_model);
    let image_url = image_url.trim().to_string();
    if image_url.is_empty() {
        return Err("La imagen no puede estar vacía.".to_string());
    }

    emit_progress(app, "image", "CREATING", 0);

    let body = json!({
        "image_url": image_url,
        "ai_model": model,
        "should_texture": should_texture,
        "target_formats": ["glb"]
    });
    let create = post_json(
        &client,
        &format!("{}/openapi/v1/image-to-3d", MESHY_API),
        &api_key,
        &body,
    )?;
    let id = read_task_id(&create)?;
    emit_progress(app, "image", "POLLING", 0);
    let poll_url = format!("{}/openapi/v1/image-to-3d/{}", MESHY_API, id);
    poll_until_glb(app, &client, &api_key, &poll_url, "image")
}
