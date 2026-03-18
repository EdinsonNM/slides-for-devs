//! SQLite storage for presentations. Tables: presentations, slides, slide_images.
//! Images stored as BLOB in slide_images to keep list/load metadata fast.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS presentations (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    saved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slides (
    presentation_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL,
    image_prompt TEXT,
    code TEXT,
    language TEXT,
    font_size INTEGER,
    video_url TEXT,
    content_type TEXT,
    image_width_percent INTEGER,
    content_layout TEXT,
    panel_height_percent INTEGER,
    presenter_notes TEXT,
    speech TEXT,
    excalidraw_data TEXT,
    PRIMARY KEY (presentation_id, ordinal),
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS slide_images (
    presentation_id TEXT NOT NULL,
    slide_ordinal INTEGER NOT NULL,
    image_data BLOB NOT NULL,
    PRIMARY KEY (presentation_id, slide_ordinal),
    FOREIGN KEY (presentation_id, slide_ordinal) REFERENCES slides(presentation_id, ordinal) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id);

CREATE TABLE IF NOT EXISTS saved_characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL
);
";

/// Frontend-compatible slide (snake_case for serde with TS).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    pub id: String,
    #[serde(rename = "type")]
    pub slide_type: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub image_prompt: Option<String>,
    pub code: Option<String>,
    pub language: Option<String>,
    /// Acepta float desde el frontend (p. ej. 50.83); se redondea al guardar en DB.
    pub font_size: Option<f64>,
    pub video_url: Option<String>,
    pub content_type: Option<String>,
    /// Acepta float desde el frontend (p. ej. 50.83); se redondea al guardar en DB.
    pub image_width_percent: Option<f64>,
    /// "split" | "full" | "panel-full"
    pub content_layout: Option<String>,
    /// Porcentaje de altura del panel en layout panel-full (0-100).
    pub panel_height_percent: Option<f64>,
    pub presenter_notes: Option<String>,
    pub speech: Option<String>,
    pub excalidraw_data: Option<String>,
}

/// Frontend-compatible presentation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presentation {
    pub topic: String,
    pub slides: Vec<Slide>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_id: Option<String>,
}

/// Saved presentation with id and saved_at (for load response).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPresentation {
    pub id: String,
    pub topic: String,
    pub saved_at: String,
    pub slides: Vec<Slide>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_id: Option<String>,
}

/// Saved character for consistent image generation across slides.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedCharacter {
    pub id: String,
    pub name: String,
    pub description: String,
    /// Data URL of the reference image (matches TS referenceImageDataUrl).
    #[serde(skip_serializing_if = "Option::is_none", rename = "referenceImageDataUrl")]
    pub reference_image_data_url: Option<String>,
}

/// Metadata for list (no slides, no images).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPresentationMeta {
    pub id: String,
    pub topic: String,
    pub saved_at: String,
    pub slide_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cloud_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cloud_synced_at: Option<String>,
    /// Revisión conocida en Firestore (control de concurrencia entre dispositivos).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cloud_revision: Option<i64>,
}

/// Creates the database file and tables if they don't exist.
pub fn init_db(db_path: &Path) -> Result<(), rusqlite::Error> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    }
    let conn = Connection::open(db_path)?;
    conn.execute_batch(SCHEMA)?;
    // Migration: add character_id to presentations if missing (existing DBs).
    let has_col: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='character_id'",
        [],
        |r| r.get(0),
    )?;
    if has_col == 0 {
        conn.execute("ALTER TABLE presentations ADD COLUMN character_id TEXT", [])?;
    }
    // Migration: add reference_image_url to saved_characters if missing.
    let has_ref: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('saved_characters') WHERE name='reference_image_url'",
        [],
        |r| r.get(0),
    )?;
    if has_ref == 0 {
        conn.execute("ALTER TABLE saved_characters ADD COLUMN reference_image_url TEXT", [])?;
    }
    // Migration: add excalidraw_data to slides if missing.
    let has_excal: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='excalidraw_data'",
        [],
        |r| r.get(0),
    )?;
    if has_excal == 0 {
        conn.execute("ALTER TABLE slides ADD COLUMN excalidraw_data TEXT", [])?;
    }
    // Migration: add content_layout and panel_height_percent to slides if missing.
    let has_content_layout: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='content_layout'",
        [],
        |r| r.get(0),
    )?;
    if has_content_layout == 0 {
        conn.execute("ALTER TABLE slides ADD COLUMN content_layout TEXT", [])?;
        conn.execute("ALTER TABLE slides ADD COLUMN panel_height_percent INTEGER", [])?;
    }
    // Migration: cloud sync metadata
    let has_cloud_id: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='cloud_id'",
        [],
        |r| r.get(0),
    )?;
    if has_cloud_id == 0 {
        conn.execute("ALTER TABLE presentations ADD COLUMN cloud_id TEXT", [])?;
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN cloud_synced_at TEXT",
            [],
        )?;
    }
    let has_cloud_rev: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='cloud_revision'",
        [],
        |r| r.get(0),
    )?;
    if has_cloud_rev == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN cloud_revision INTEGER",
            [],
        )?;
    }
    Ok(())
}

/// Extract raw bytes from a data URL "data:image/png;base64,..." or return None.
fn data_url_to_bytes(data_url: &str) -> Option<Vec<u8>> {
    let prefix = "data:image/png;base64,";
    let b64 = data_url.strip_prefix(prefix).or_else(|| {
        data_url.strip_prefix("data:image/jpeg;base64,")
    })?;
    BASE64.decode(b64.as_bytes()).ok()
}

/// Build data URL from raw PNG/JPEG bytes (we store as PNG).
fn bytes_to_data_url(data: &[u8]) -> String {
    let b64 = BASE64.encode(data);
    format!("data:image/png;base64,{b64}")
}

pub fn save_presentation(conn: &Connection, presentation: &Presentation) -> Result<String, rusqlite::Error> {
    let id = Uuid::new_v4().to_string();
    let saved_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO presentations (id, topic, saved_at, character_id) VALUES (?1, ?2, ?3, ?4)",
        params![id, presentation.topic, saved_at, presentation.character_id],
    )?;

    for (ordinal, slide) in presentation.slides.iter().enumerate() {
        let ord = ordinal as i32;
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                id,
                ord,
                slide.id,
                slide.slide_type,
                slide.title,
                slide.subtitle,
                slide.content,
                slide.image_prompt,
                slide.code,
                slide.language,
                slide.font_size.map(|n| n.round().clamp(0., 255.) as i32),
                slide.video_url,
                slide.content_type,
                slide.image_width_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.content_layout,
                slide.panel_height_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.presenter_notes,
                slide.speech,
                slide.excalidraw_data,
            ],
        )?;

        if let Some(ref url) = slide.image_url {
            if let Some(blob) = data_url_to_bytes(url) {
                conn.execute(
                    "INSERT INTO slide_images (presentation_id, slide_ordinal, image_data) VALUES (?1, ?2, ?3)",
                    params![id, ord, blob],
                )?;
            }
        }
    }

    Ok(id)
}

/// Imports a presentation with an existing id and saved_at (for migration from JSON).
pub fn import_presentation(
    conn: &Connection,
    saved: &SavedPresentation,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO presentations (id, topic, saved_at, character_id) VALUES (?1, ?2, ?3, ?4)",
        params![saved.id, saved.topic, saved.saved_at, saved.character_id],
    )?;

    conn.execute("DELETE FROM slide_images WHERE presentation_id = ?1", params![saved.id])?;
    conn.execute("DELETE FROM slides WHERE presentation_id = ?1", params![saved.id])?;

    for (ordinal, slide) in saved.slides.iter().enumerate() {
        let ord = ordinal as i32;
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                saved.id,
                ord,
                slide.id,
                slide.slide_type,
                slide.title,
                slide.subtitle,
                slide.content,
                slide.image_prompt,
                slide.code,
                slide.language,
                slide.font_size.map(|n| n.round().clamp(0., 255.) as i32),
                slide.video_url,
                slide.content_type,
                slide.image_width_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.content_layout,
                slide.panel_height_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.presenter_notes,
                slide.speech,
                slide.excalidraw_data,
            ],
        )?;

        if let Some(ref url) = slide.image_url {
            if let Some(blob) = data_url_to_bytes(url) {
                conn.execute(
                    "INSERT INTO slide_images (presentation_id, slide_ordinal, image_data) VALUES (?1, ?2, ?3)",
                    params![saved.id, ord, blob],
                )?;
            }
        }
    }

    Ok(())
}

pub fn update_presentation(
    conn: &Connection,
    id: &str,
    presentation: &Presentation,
) -> Result<(), rusqlite::Error> {
    let saved_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE presentations SET topic = ?1, saved_at = ?2, character_id = ?3 WHERE id = ?4",
        params![presentation.topic, saved_at, presentation.character_id, id],
    )?;
    if conn.changes() == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    conn.execute("DELETE FROM slide_images WHERE presentation_id = ?1", params![id])?;
    conn.execute("DELETE FROM slides WHERE presentation_id = ?1", params![id])?;

    for (ordinal, slide) in presentation.slides.iter().enumerate() {
        let ord = ordinal as i32;
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                id,
                ord,
                slide.id,
                slide.slide_type,
                slide.title,
                slide.subtitle,
                slide.content,
                slide.image_prompt,
                slide.code,
                slide.language,
                slide.font_size.map(|n| n.round().clamp(0., 255.) as i32),
                slide.video_url,
                slide.content_type,
                slide.image_width_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.content_layout,
                slide.panel_height_percent.map(|n| n.round().clamp(0., 100.) as i32),
                slide.presenter_notes,
                slide.speech,
                slide.excalidraw_data,
            ],
        )?;

        if let Some(ref url) = slide.image_url {
            if let Some(blob) = data_url_to_bytes(url) {
                conn.execute(
                    "INSERT INTO slide_images (presentation_id, slide_ordinal, image_data) VALUES (?1, ?2, ?3)",
                    params![id, ord, blob],
                )?;
            }
        }
    }

    Ok(())
}

pub fn load_presentation(conn: &Connection, id: &str) -> Result<SavedPresentation, rusqlite::Error> {
    let (topic, saved_at, character_id): (String, String, Option<String>) = conn.query_row(
        "SELECT topic, saved_at, character_id FROM presentations WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    let mut slides: Vec<Slide> = Vec::new();
    let mut stmt = conn.prepare(
        r#"
        SELECT ordinal, id, type, title, subtitle, content, image_prompt, code, language,
               font_size, video_url, content_type, image_width_percent, content_layout, panel_height_percent,
               presenter_notes, speech, excalidraw_data
        FROM slides WHERE presentation_id = ?1 ORDER BY ordinal
        "#,
    )?;
    let rows = stmt.query_map(params![id], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<i32>>(9)?,
            row.get::<_, Option<String>>(10)?,
            row.get::<_, Option<String>>(11)?,
            row.get::<_, Option<i32>>(12)?,
            row.get::<_, Option<String>>(13)?,
            row.get::<_, Option<i32>>(14)?,
            row.get::<_, Option<String>>(15)?,
            row.get::<_, Option<String>>(16)?,
            row.get::<_, Option<String>>(17)?,
        ))
    })?;

    for row in rows {
        let (ordinal, slide_id, slide_type, title, subtitle, content, image_prompt, code, language, font_size, video_url, content_type, image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data) = row?;

        let image_url = conn
            .query_row(
                "SELECT image_data FROM slide_images WHERE presentation_id = ?1 AND slide_ordinal = ?2",
                params![id, ordinal],
                |r| r.get::<_, Vec<u8>>(0),
            )
            .ok()
            .map(|data| bytes_to_data_url(&data));

        slides.push(Slide {
            id: slide_id,
            slide_type,
            title,
            subtitle,
            content,
            image_url,
            image_prompt,
            code,
            language,
            font_size: font_size.map(|n| n as f64),
            video_url,
            content_type,
            image_width_percent: image_width_percent.map(|n| n as f64),
            content_layout,
            panel_height_percent: panel_height_percent.map(|n| n as f64),
            presenter_notes,
            speech,
            excalidraw_data,
        });
    }

    Ok(SavedPresentation {
        id: id.to_string(),
        topic,
        saved_at,
        slides,
        character_id,
    })
}

pub fn list_presentations(conn: &Connection) -> Result<Vec<SavedPresentationMeta>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        r#"
        SELECT p.id, p.topic, p.saved_at, p.cloud_id, p.cloud_synced_at, p.cloud_revision,
               COUNT(s.ordinal) AS slide_count
        FROM presentations p
        LEFT JOIN slides s ON s.presentation_id = p.id
        GROUP BY p.id, p.topic, p.saved_at, p.cloud_id, p.cloud_synced_at, p.cloud_revision
        ORDER BY p.saved_at DESC
        "#,
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SavedPresentationMeta {
            id: row.get(0)?,
            topic: row.get(1)?,
            saved_at: row.get(2)?,
            cloud_id: row.get(3)?,
            cloud_synced_at: row.get(4)?,
            cloud_revision: row.get(5)?,
            slide_count: row.get(6)?,
        })
    })?;
    rows.collect()
}

/// Updates Firestore/cloud linkage after sync or cloud download.
pub fn set_presentation_cloud_state(
    conn: &Connection,
    id: &str,
    cloud_id: Option<&str>,
    cloud_synced_at: Option<&str>,
    cloud_revision: Option<i64>,
) -> Result<(), rusqlite::Error> {
    let n = conn.execute(
        "UPDATE presentations SET cloud_id = ?1, cloud_synced_at = ?2, cloud_revision = ?3 WHERE id = ?4",
        params![cloud_id, cloud_synced_at, cloud_revision, id],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

/// Import a full saved presentation (e.g. from cloud). Uses `saved.id` as local row id.
pub fn import_saved_presentation(conn: &Connection, saved: &SavedPresentation) -> Result<(), rusqlite::Error> {
    import_presentation(conn, saved)
}

pub fn delete_presentation(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM presentations WHERE id = ?1", params![id])?;
    Ok(())
}

// --- Saved characters ---

pub fn list_characters(conn: &Connection) -> Result<Vec<SavedCharacter>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, reference_image_url FROM saved_characters ORDER BY name",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SavedCharacter {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            reference_image_data_url: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn save_character(conn: &Connection, character: &SavedCharacter) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO saved_characters (id, name, description, reference_image_url) VALUES (?1, ?2, ?3, ?4)",
        params![
            character.id,
            character.name,
            character.description,
            character.reference_image_data_url,
        ],
    )?;
    Ok(())
}

pub fn delete_character(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM saved_characters WHERE id = ?1", params![id])?;
    Ok(())
}
