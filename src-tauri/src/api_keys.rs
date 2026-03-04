//! Almacenamiento seguro de API keys en el keychain del sistema
//! (macOS Keychain, Windows Credential Manager, Linux keyutils).

use keyring::Entry;

const SERVICE: &str = "Slaim";
const GEMINI_ACCOUNT: &str = "gemini_api_key";
const OPENAI_ACCOUNT: &str = "openai_api_key";

fn gemini_entry() -> Result<Entry, keyring::Error> {
    Entry::new(SERVICE, GEMINI_ACCOUNT)
}

fn openai_entry() -> Result<Entry, keyring::Error> {
    Entry::new(SERVICE, OPENAI_ACCOUNT)
}

/// Devuelve la API key de Gemini si está configurada.
pub fn get_gemini_api_key() -> Result<Option<String>, String> {
    let entry = gemini_entry().map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s.trim().to_string()).filter(|s| !s.is_empty())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Elimina la credencial de Gemini del keychain (para set con string vacío).
fn delete_gemini_if_empty() -> Result<(), String> {
    let entry = gemini_entry().map_err(|e| e.to_string())?;
    let _ = entry.delete_password();
    Ok(())
}

/// Guarda la API key de Gemini en el keychain del sistema.
pub fn set_gemini_api_key(key: &str) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        delete_gemini_if_empty()
    } else {
        let entry = gemini_entry().map_err(|e| e.to_string())?;
        entry.set_password(key).map_err(|e| e.to_string())
    }
}

/// Devuelve la API key de OpenAI si está configurada.
pub fn get_openai_api_key() -> Result<Option<String>, String> {
    let entry = openai_entry().map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s.trim().to_string()).filter(|s| !s.is_empty())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Guarda la API key de OpenAI en el keychain del sistema.
pub fn set_openai_api_key(key: &str) -> Result<(), String> {
    let key = key.trim();
    let entry = openai_entry().map_err(|e| e.to_string())?;
    if key.is_empty() {
        let _ = entry.delete_password();
        Ok(())
    } else {
        entry.set_password(key).map_err(|e| e.to_string())
    }
}

/// True si hay al menos una API key guardada.
pub fn has_any_api_configured() -> Result<bool, String> {
    let gemini = get_gemini_api_key()?.is_some();
    let openai = get_openai_api_key()?.is_some();
    Ok(gemini || openai)
}
