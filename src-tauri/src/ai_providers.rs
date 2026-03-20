use crate::api_keys;
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct ProviderChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub response_format_json: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProviderTextResponse {
    pub text: String,
}

const APP_USER_AGENT: &str = "Slaim/0.1 (https://slaim.app; Tauri)";

/// Cliente sin compresiones problemáticas: zstd/brotli (y gzip) desactivados para que el
/// servidor suela responder sin comprimir y evitar fallos de reqwest al leer el cuerpo
/// (`error decoding response body` con CDNs / HTTP2).
fn http_client() -> Result<Client, String> {
    Client::builder()
        .no_zstd()
        .no_brotli()
        .no_gzip()
        .build()
        .map_err(|e| e.to_string())
}

fn auth_header_for_provider(provider: &str) -> Result<String, String> {
    let key = match provider {
        "groq" => api_keys::get_groq_api_key()?,
        "cerebras" => api_keys::get_cerebras_api_key()?,
        "openrouter" => api_keys::get_openrouter_api_key()?,
        "openai" => api_keys::get_openai_api_key()?,
        _ => None,
    };
    key.map(|k| format!("Bearer {}", k.trim()))
        .ok_or_else(|| format!("No hay API key de {} configurada.", provider))
}

fn json_error_message(body: &serde_json::Value) -> Option<String> {
    let err = body.get("error")?;
    if let Some(s) = err.as_str() {
        return Some(s.to_string());
    }
    let msg = err
        .get("message")
        .and_then(|m| m.as_str())
        .unwrap_or("")
        .to_string();
    if msg.is_empty() {
        return body
            .get("message")
            .and_then(|m| m.as_str())
            .map(|s| s.to_string());
    }
    let code = err.get("code").and_then(|c| c.as_u64()).map(|c| format!(" (código {})", c));
    let provider = err
        .get("metadata")
        .and_then(|m| m.get("provider_name"))
        .and_then(|p| p.as_str())
        .map(|p| format!(" [proveedor upstream: {}]", p));
    Some(format!(
        "{}{}{}",
        msg,
        code.unwrap_or_default(),
        provider.unwrap_or_default()
    ))
}

fn error_code_from_body(body: &serde_json::Value) -> Option<u64> {
    let from_err = |e: &serde_json::Value| e.get("code").and_then(|c| c.as_u64());
    body.get("error")
        .and_then(from_err)
        .or_else(|| {
            body.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("error"))
                .and_then(from_err)
        })
}

/// Mensaje claro para cupo / rate limit (muy frecuente con `openrouter/free` → Venice u otros upstream).
fn rate_limit_user_message(provider: &str, upstream: Option<&str>) -> String {
    let upstream_note = upstream
        .filter(|s| !s.is_empty())
        .map(|s| format!(" Proveedor upstream: {}.", s))
        .unwrap_or_default();
    format!(
        "Límite de uso (429): demasiadas peticiones o cupo agotado.{upstream_note} \
         En OpenRouter, rutas gratuitas o baratas (p. ej. openrouter/free) suelen ir a proveedores como Venice con cupo muy bajo. \
         Espera varios minutos, reintenta, o elige un modelo concreto con más cupo o de pago. [canal: {provider}]",
        upstream_note = upstream_note,
        provider = provider
    )
}

fn provider_error_display(status: u16, body: &serde_json::Value, provider: &str) -> String {
    let code = error_code_from_body(body).or(if status == 429 { Some(429) } else { None });
    if code == Some(429) {
        let upstream = body
            .get("error")
            .and_then(|e| e.get("metadata"))
            .and_then(|m| m.get("provider_name"))
            .and_then(|p| p.as_str())
            .or_else(|| {
                body.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c| c.get("error"))
                    .and_then(|e| e.get("metadata"))
                    .and_then(|m| m.get("provider_name"))
                    .and_then(|p| p.as_str())
            });
        return rate_limit_user_message(provider, upstream);
    }
    json_error_message(body).unwrap_or_else(|| format!("{} API: {}", provider, status))
}

pub fn provider_chat_completion(
    provider: String,
    request: ProviderChatRequest,
) -> Result<ProviderTextResponse, String> {
    let url = match provider.as_str() {
        "groq" => "https://api.groq.com/openai/v1/chat/completions",
        "cerebras" => "https://api.cerebras.ai/v1/chat/completions",
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
        "openai" => "https://api.openai.com/v1/chat/completions",
        _ => return Err(format!("Proveedor no soportado para chat completions: {}", provider)),
    };

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(APP_USER_AGENT));
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&auth_header_for_provider(&provider)?).map_err(|e| e.to_string())?,
    );
    if provider == "openrouter" {
        headers.insert("HTTP-Referer", HeaderValue::from_static("https://slaim.app"));
        headers.insert("X-Title", HeaderValue::from_static("Slaim"));
    }

    // OpenRouter (especialmente modelos gratuitos / enrutados) a menudo fallan con
    // response_format json_object en el proveedor upstream → "Provider returned error".
    let use_json_object = request.response_format_json.unwrap_or(false) && provider != "openrouter";

    let body = json!({
        "model": request.model,
        "messages": request.messages,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
        "response_format": if use_json_object {
            Some(json!({ "type": "json_object" }))
        } else {
            None
        }
    });

    let client = http_client()?;
    let res = client
        .post(url)
        .headers(headers)
        .json(&body)
        .send()
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let raw = res.text().map_err(|e| e.to_string())?;
    let json_body: serde_json::Value = serde_json::from_str(&raw).unwrap_or_else(|_| {
        serde_json::json!({
            "message": raw.chars().take(280).collect::<String>()
        })
    });
    if !status.is_success() {
        return Err(provider_error_display(status.as_u16(), &json_body, &provider));
    }

    if json_body.get("error").is_some() {
        return Err(provider_error_display(status.as_u16(), &json_body, &provider));
    }

    let first_choice = json_body.get("choices").and_then(|c| c.get(0));
    if let Some(err) = first_choice.and_then(|c| c.get("error")) {
        let wrapped = json!({ "error": err });
        return Err(provider_error_display(200, &wrapped, &provider));
    }

    let content = first_choice
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    Ok(ProviderTextResponse { text: content })
}
