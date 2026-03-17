//! Flujo OAuth 2.0 para desktop: abre el navegador del sistema y recibe el callback
//! en un servidor loopback (127.0.0.1). Compatible con Google (PKCE, sin client_secret).

use base64::Engine;
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

const LOOPBACK_PORT: u16 = 8765;
const REDIRECT_URI: &str = "http://127.0.0.1:8765/callback";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPES: &str = "openid email profile";

#[derive(Deserialize)]
struct OAuthConfig {
    #[serde(alias = "googleOauthClientId", alias = "google_oauth_client_id")]
    google_oauth_client_id: Option<String>,
    #[serde(alias = "googleOauthClientSecret", alias = "google_oauth_client_secret")]
    google_oauth_client_secret: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    id_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

fn base64url_encode(data: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(data)
}

fn generate_code_verifier() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64url_encode(&bytes)
}

fn code_challenge_from_verifier(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    base64url_encode(&hash)
}

/// Escucha una sola petición GET en /callback y devuelve el parámetro `code`.
fn listen_for_code(timeout_secs: u64) -> Result<String, String> {
    let listener = TcpListener::bind(("127.0.0.1", LOOPBACK_PORT)).map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel();

    let _handle = thread::spawn(move || {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                let code = request
                    .lines()
                    .next()
                    .and_then(|line| {
                        let line = line.trim();
                        let path = line.split_whitespace().nth(1)?;
                        // Aceptar GET /callback?... (Web) o GET /?... (Desktop app loopback)
                        let query = path
                            .strip_prefix("/callback?")
                            .or_else(|| path.strip_prefix("/?"))?;
                        for part in query.split('&') {
                            let (k, v) = part.split_once('=')?;
                            if k == "code" {
                                let decoded =
                                    urlencoding::decode(v).unwrap_or(std::borrow::Cow::Borrowed(v));
                                return Some(decoded.into_owned());
                            }
                        }
                        None
                    })
                    .unwrap_or_default();

                let body = r#"<!DOCTYPE html><html><head><meta charset="utf-8"><title>Slaim</title></head><body><p>Inicio de sesión correcto. Puedes cerrar esta ventana.</p></body></html>"#;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                let _ = stream.flush();
                let _ = tx.send(Ok(code));
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
        }
    });

    match rx.recv_timeout(Duration::from_secs(timeout_secs + 2)) {
        Ok(Ok(code)) if !code.is_empty() => Ok(code),
        Ok(Ok(_)) => Err("No se recibió el código de autorización".to_string()),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("Tiempo de espera agotado. Vuelve a intentar.".to_string()),
    }
}

/// Abre la URL en el navegador por defecto del sistema.
fn open_browser(url: &str) -> Result<(), String> {
    opener::open_browser(url).map_err(|e| e.to_string())
}

/// Intercambia el código por tokens (id_token). Con client_secret si es cliente Web.
fn exchange_code_for_tokens(
    client_id: &str,
    client_secret: Option<&str>,
    code: &str,
    code_verifier: &str,
) -> Result<String, String> {
    let mut params: Vec<(&str, &str)> = vec![
        ("client_id", client_id),
        ("code", code),
        ("code_verifier", code_verifier),
        ("grant_type", "authorization_code"),
        ("redirect_uri", REDIRECT_URI),
    ];
    if let Some(secret) = client_secret {
        if !secret.is_empty() {
            params.push(("client_secret", secret));
        }
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client
        .post(TOKEN_URL)
        .form(&params)
        .send()
        .map_err(|e| e.to_string())?;
    let body: TokenResponse = res.json().map_err(|e| e.to_string())?;
    if let Some(err) = body.error {
        let desc = body.error_description.unwrap_or_default();
        return Err(format!("{}: {}", err, desc));
    }
    body.id_token
        .ok_or_else(|| "No se recibió id_token".to_string())
}

/// Ejecuta el flujo OAuth: abre navegador, recibe callback en 127.0.0.1:8765, intercambia code por id_token.
pub fn sign_in_with_external_browser(config_json: &str) -> Result<String, String> {
    let config: OAuthConfig =
        serde_json::from_str(config_json).map_err(|e| format!("Config inválida: {}", e))?;
    let client_id = config
        .google_oauth_client_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "Añade 'googleOauthClientId' a firebase_config.json (mismo Client ID de la consola Google)"
                .to_string()
        })?;

    let code_verifier = generate_code_verifier();
    let code_challenge = code_challenge_from_verifier(&code_verifier);
    let state: String = uuid::Uuid::new_v4().to_string();

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&code_challenge={}&code_challenge_method=S256&access_type=offline&prompt=consent",
        AUTH_URL,
        urlencoding::encode(client_id),
        urlencoding::encode(REDIRECT_URI),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge),
    );

    let code = thread::scope(|s| {
        let handle = s.spawn(|| listen_for_code(120));
        open_browser(&auth_url).map_err(|e| e.to_string())?;
        match handle.join() {
            Ok(Ok(c)) => Ok(c),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Error en el hilo de escucha".to_string()),
        }
    })?;

    let client_secret = config
        .google_oauth_client_secret
        .as_deref()
        .filter(|s| !s.is_empty());
    exchange_code_for_tokens(client_id, client_secret, &code, &code_verifier)
}
