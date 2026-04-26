//! SQLite storage for presentations. Tables: presentations, slides, slide_images.
//! Images stored as BLOB in slide_images to keep list/load metadata fast.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

/// Ámbito local para sesión sin cuenta (Firebase). Las presentaciones/personajes con otro valor pertenecen a ese `uid`.
pub const ACCOUNT_SCOPE_GUEST: &str = "__guest__";

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

CREATE TABLE IF NOT EXISTS generated_resources (
    account_scope TEXT NOT NULL,
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    prompt TEXT,
    source TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (account_scope, id)
);

CREATE INDEX IF NOT EXISTS idx_generated_resources_scope_time
    ON generated_resources (account_scope, created_at DESC);
";

/// Vista 3D persistida (OrbitControls): posición de cámara + target en espacio mundo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presenter3dViewStateDto {
    pub position: [f64; 3],
    pub target: [f64; 3],
}

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
    pub isometric_flow_data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "presenter3dDeviceId")]
    pub presenter_3d_device_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "presenter3dScreenMedia")]
    pub presenter_3d_screen_media: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "presenter3dViewState")]
    pub presenter_3d_view_state: Option<Presenter3dViewStateDto>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "editorTitleWidthPercent")]
    pub editor_title_width_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "editorTitleMinHeightPx")]
    pub editor_title_min_height_px: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "editorContentWidthPercent")]
    pub editor_content_width_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "editorContentMinHeightPx")]
    pub editor_content_min_height_px: Option<f64>,
    /// Tabla/matriz (JSON) cuando `slide_type == "matrix"`.
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "matrixData")]
    pub matrix_data: Option<serde_json::Value>,
    /// Lienzo 2D (JSON) con posiciones de bloques en % del slide.
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "canvasScene")]
    pub canvas_scene: Option<serde_json::Value>,
}

/// Frontend-compatible presentation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Presentation {
    pub topic: String,
    pub slides: Vec<Slide>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deckVisualTheme")]
    pub deck_visual_theme: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deckNarrativePresetId")]
    pub deck_narrative_preset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "narrativeNotes")]
    pub narrative_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "presentationReadme")]
    pub presentation_readme: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none", rename = "deckVisualTheme")]
    pub deck_visual_theme: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "deckNarrativePresetId")]
    pub deck_narrative_preset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "narrativeNotes")]
    pub narrative_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "presentationReadme")]
    pub presentation_readme: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none", rename = "cloudSyncedAt")]
    pub cloud_synced_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "cloudRevision")]
    pub cloud_revision: Option<i64>,
}

/// Recurso generado por el usuario (imagen IA o modelo .glb) reutilizable desde el inspector.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedResourceEntry {
    pub id: String,
    pub kind: String,
    pub payload: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    pub created_at: String,
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
    /// Sin diapositivas en SQLite; copia sigue en la nube (`cloud_id` requerido).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub local_body_cleared: bool,
    /// Origen si se importó desde compartida: `ownerUid::cloudId`.
    #[serde(skip_serializing_if = "Option::is_none", rename = "sharedCloudSource")]
    pub shared_cloud_source: Option<String>,
    /// IDs de slides pendientes de sincronizar.
    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "dirtySlideIds")]
    pub dirty_slide_ids: Vec<String>,
    /// Estado de sincronización local para UI/reintentos.
    #[serde(skip_serializing_if = "Option::is_none", rename = "syncStatus")]
    pub sync_status: Option<String>,
    /// Última revisión cloud confirmada en local.
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastSyncedRevision")]
    pub last_synced_revision: Option<i64>,
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
    // Migration: isometric flow diagram JSON (slide_type == "isometric").
    let has_iso: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='isometric_flow_data'",
        [],
        |r| r.get(0),
    )?;
    if has_iso == 0 {
        conn.execute(
            "ALTER TABLE slides ADD COLUMN isometric_flow_data TEXT",
            [],
        )?;
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
    let ch_cloud_sync: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('saved_characters') WHERE name='cloud_synced_at'",
        [],
        |r| r.get(0),
    )?;
    if ch_cloud_sync == 0 {
        conn.execute(
            "ALTER TABLE saved_characters ADD COLUMN cloud_synced_at TEXT",
            [],
        )?;
        conn.execute(
            "ALTER TABLE saved_characters ADD COLUMN cloud_revision INTEGER",
            [],
        )?;
    }
    // Migration: account_scope on presentations (guest vs Firebase uid).
    let has_pres_scope: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='account_scope'",
        [],
        |r| r.get(0),
    )?;
    if has_pres_scope == 0 {
        conn.execute("ALTER TABLE presentations ADD COLUMN account_scope TEXT", [])?;
        conn.execute(
            "UPDATE presentations SET account_scope = ?1 WHERE account_scope IS NULL OR TRIM(account_scope) = ''",
            params![ACCOUNT_SCOPE_GUEST],
        )?;
    }
    // Migration: saved_characters composite PK (account_scope, id) for per-account isolation.
    let has_ch_scope: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('saved_characters') WHERE name='account_scope'",
        [],
        |r| r.get(0),
    )?;
    if has_ch_scope == 0 {
        conn.execute_batch(&format!(
            r#"
            CREATE TABLE saved_characters_new (
                account_scope TEXT NOT NULL,
                id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                reference_image_url TEXT,
                cloud_synced_at TEXT,
                cloud_revision INTEGER,
                PRIMARY KEY (account_scope, id)
            );
            INSERT INTO saved_characters_new (account_scope, id, name, description, reference_image_url, cloud_synced_at, cloud_revision)
            SELECT '{guest}', id, name, description, reference_image_url, cloud_synced_at, cloud_revision FROM saved_characters;
            DROP TABLE saved_characters;
            ALTER TABLE saved_characters_new RENAME TO saved_characters;
            "#,
            guest = ACCOUNT_SCOPE_GUEST
        ))?;
    }
    // Migration: presenter 3D panel fields on slides
    let has_p3d: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='presenter_3d_device_id'",
        [],
        |r| r.get(0),
    )?;
    if has_p3d == 0 {
        conn.execute(
            "ALTER TABLE slides ADD COLUMN presenter_3d_device_id TEXT",
            [],
        )?;
        conn.execute(
            "ALTER TABLE slides ADD COLUMN presenter_3d_screen_media TEXT",
            [],
        )?;
    }
    let has_p3d_scale: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='presenter_3d_model_scale'",
        [],
        |r| r.get(0),
    )?;
    if has_p3d_scale == 0 {
        conn.execute(
            "ALTER TABLE slides ADD COLUMN presenter_3d_model_scale REAL",
            [],
        )?;
    }
    let has_p3d_view: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='presenter_3d_view_state'",
        [],
        |r| r.get(0),
    )?;
    if has_p3d_view == 0 {
        conn.execute(
            "ALTER TABLE slides ADD COLUMN presenter_3d_view_state TEXT",
            [],
        )?;
    }
    // Migration: editor text frame layout (title/content width & min height in editor)
    let has_etw: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='editor_title_width_percent'",
        [],
        |r| r.get(0),
    )?;
    if has_etw == 0 {
        conn.execute(
            "ALTER TABLE slides ADD COLUMN editor_title_width_percent INTEGER",
            [],
        )?;
        conn.execute(
            "ALTER TABLE slides ADD COLUMN editor_title_min_height_px INTEGER",
            [],
        )?;
        conn.execute(
            "ALTER TABLE slides ADD COLUMN editor_content_width_percent INTEGER",
            [],
        )?;
        conn.execute(
            "ALTER TABLE slides ADD COLUMN editor_content_min_height_px INTEGER",
            [],
        )?;
    }
    // Migration: local_body_cleared — sin diapositivas locales pero vínculo cloud (stub).
    let has_lbc: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='local_body_cleared'",
        [],
        |r| r.get(0),
    )?;
    if has_lbc == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN local_body_cleared INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    // Migration: shared_cloud_source — deduplicar tarjetas compartidas tras import local.
    let has_scs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='shared_cloud_source'",
        [],
        |r| r.get(0),
    )?;
    if has_scs == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN shared_cloud_source TEXT",
            [],
        )?;
    }
    // Migration: sync metadata (dirty slides + estado local de sincronización).
    let has_dirty_ids: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='dirty_slide_ids'",
        [],
        |r| r.get(0),
    )?;
    if has_dirty_ids == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN dirty_slide_ids TEXT",
            [],
        )?;
    }
    let has_sync_status: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='sync_status'",
        [],
        |r| r.get(0),
    )?;
    if has_sync_status == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN sync_status TEXT",
            [],
        )?;
    }
    let has_last_synced_revision: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='last_synced_revision'",
        [],
        |r| r.get(0),
    )?;
    if has_last_synced_revision == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN last_synced_revision INTEGER",
            [],
        )?;
    }
    // Migration: matrix_data — tablas en slides tipo matrix.
    let has_matrix: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='matrix_data'",
        [],
        |r| r.get(0),
    )?;
    if has_matrix == 0 {
        conn.execute("ALTER TABLE slides ADD COLUMN matrix_data TEXT", [])?;
    }
    let has_canvas_scene: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('slides') WHERE name='canvas_scene'",
        [],
        |r| r.get(0),
    )?;
    if has_canvas_scene == 0 {
        conn.execute("ALTER TABLE slides ADD COLUMN canvas_scene TEXT", [])?;
    }
    // Migration: deck_visual_theme — JSON del tema visual del deck (fondos, tono de texto).
    let has_deck_theme: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='deck_visual_theme'",
        [],
        |r| r.get(0),
    )?;
    if has_deck_theme == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN deck_visual_theme TEXT",
            [],
        )?;
    }
    let has_narrative_preset: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='deck_narrative_preset_id'",
        [],
        |r| r.get(0),
    )?;
    if has_narrative_preset == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN deck_narrative_preset_id TEXT",
            [],
        )?;
    }
    let has_narrative_notes: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='narrative_notes'",
        [],
        |r| r.get(0),
    )?;
    if has_narrative_notes == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN narrative_notes TEXT",
            [],
        )?;
    }
    let has_presentation_readme: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('presentations') WHERE name='presentation_readme'",
        [],
        |r| r.get(0),
    )?;
    if has_presentation_readme == 0 {
        conn.execute(
            "ALTER TABLE presentations ADD COLUMN presentation_readme TEXT",
            [],
        )?;
    }
    Ok(())
}

/// Extract raw bytes from a raster data URL (PNG, JPEG, WebP). Returns None if not a supported image data URL.
/// El frontend optimiza slides a WebP (`imageOptimize.ts`); sin WebP aquí las imágenes no se guardaban en `slide_images`.
fn data_url_to_bytes(data_url: &str) -> Option<Vec<u8>> {
    let s = data_url.trim();
    let lower = s.to_ascii_lowercase();
    if !lower.starts_with("data:image/") {
        return None;
    }
    let sep = ";base64,";
    let idx = lower.find(sep)?;
    let subtype = &lower["data:image/".len()..idx];
    let allowed = matches!(subtype, "png" | "jpeg" | "jpg" | "webp" | "gif");
    if !allowed {
        return None;
    }
    let b64_start = idx + sep.len();
    let b64: String = s[b64_start..].chars().filter(|c| !c.is_whitespace()).collect();
    BASE64.decode(b64.as_bytes()).ok()
}

/// Build data URL from stored BLOB bytes (mime por firma mágica).
fn bytes_to_data_url(data: &[u8]) -> String {
    let mime = if data.len() >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
        "image/jpeg"
    } else if data.len() >= 4
        && data[0] == 0x89
        && data[1] == 0x50
        && data[2] == 0x4E
        && data[3] == 0x47
    {
        "image/png"
    } else if data.len() >= 6
        && data[0] == 0x47
        && data[1] == 0x49
        && data[2] == 0x46
        && data[3] == 0x38
        && (data[4] == 0x37 || data[4] == 0x39)
        && data[5] == 0x61
    {
        "image/gif"
    } else if data.len() >= 12
        && data[0] == 0x52
        && data[1] == 0x49
        && data[2] == 0x46
        && data[3] == 0x46
        && &data[8..12] == b"WEBP"
    {
        "image/webp"
    } else {
        "image/png"
    };
    let b64 = BASE64.encode(data);
    format!("data:{mime};base64,{b64}")
}

pub fn save_presentation(
    conn: &Connection,
    presentation: &Presentation,
    account_scope: &str,
) -> Result<String, rusqlite::Error> {
    let id = Uuid::new_v4().to_string();
    let saved_at = chrono::Utc::now().to_rfc3339();
    let deck_json: Option<String> = presentation
        .deck_visual_theme
        .as_ref()
        .and_then(|v| serde_json::to_string(v).ok());

    conn.execute(
        "INSERT INTO presentations (id, topic, saved_at, character_id, account_scope, deck_visual_theme, deck_narrative_preset_id, narrative_notes, presentation_readme) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            presentation.topic,
            saved_at,
            presentation.character_id,
            account_scope,
            deck_json,
            presentation.deck_narrative_preset_id,
            presentation.narrative_notes,
            presentation.presentation_readme
        ],
    )?;

    for (ordinal, slide) in presentation.slides.iter().enumerate() {
        let ord = ordinal as i32;
        let presenter_3d_view_json: Option<String> = slide
            .presenter_3d_view_state
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let matrix_json: Option<String> = slide
            .matrix_data
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let canvas_scene_json: Option<String> = slide
            .canvas_scene
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data,
                isometric_flow_data,
                presenter_3d_device_id, presenter_3d_screen_media, presenter_3d_model_scale, presenter_3d_view_state,
                editor_title_width_percent, editor_title_min_height_px, editor_content_width_percent, editor_content_min_height_px,
                matrix_data, canvas_scene
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
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
                slide.isometric_flow_data,
                slide.presenter_3d_device_id,
                slide.presenter_3d_screen_media,
                None::<f64>,
                presenter_3d_view_json,
                slide
                    .editor_title_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_title_min_height_px
                    .map(|n| n.round().clamp(24., 2000.) as i32),
                slide
                    .editor_content_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_content_min_height_px
                    .map(|n| n.round().clamp(40., 2000.) as i32),
                matrix_json,
                canvas_scene_json,
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
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let deck_json: Option<String> = saved
        .deck_visual_theme
        .as_ref()
        .and_then(|v| serde_json::to_string(v).ok());
    conn.execute(
        "INSERT OR REPLACE INTO presentations (id, topic, saved_at, character_id, account_scope, deck_visual_theme, deck_narrative_preset_id, narrative_notes, presentation_readme) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            saved.id,
            saved.topic,
            saved.saved_at,
            saved.character_id,
            account_scope,
            deck_json,
            saved.deck_narrative_preset_id,
            saved.narrative_notes,
            saved.presentation_readme
        ],
    )?;

    conn.execute("DELETE FROM slide_images WHERE presentation_id = ?1", params![saved.id])?;
    conn.execute("DELETE FROM slides WHERE presentation_id = ?1", params![saved.id])?;

    for (ordinal, slide) in saved.slides.iter().enumerate() {
        let ord = ordinal as i32;
        let presenter_3d_view_json: Option<String> = slide
            .presenter_3d_view_state
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let matrix_json: Option<String> = slide
            .matrix_data
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let canvas_scene_json: Option<String> = slide
            .canvas_scene
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data,
                isometric_flow_data,
                presenter_3d_device_id, presenter_3d_screen_media, presenter_3d_model_scale, presenter_3d_view_state,
                editor_title_width_percent, editor_title_min_height_px, editor_content_width_percent, editor_content_min_height_px,
                matrix_data, canvas_scene
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
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
                slide.isometric_flow_data,
                slide.presenter_3d_device_id,
                slide.presenter_3d_screen_media,
                None::<f64>,
                presenter_3d_view_json,
                slide
                    .editor_title_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_title_min_height_px
                    .map(|n| n.round().clamp(24., 2000.) as i32),
                slide
                    .editor_content_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_content_min_height_px
                    .map(|n| n.round().clamp(40., 2000.) as i32),
                matrix_json,
                canvas_scene_json,
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
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let saved_at = chrono::Utc::now().to_rfc3339();
    let deck_json: Option<String> = presentation
        .deck_visual_theme
        .as_ref()
        .and_then(|v| serde_json::to_string(v).ok());

    conn.execute(
        "UPDATE presentations SET topic = ?1, saved_at = ?2, character_id = ?3, deck_visual_theme = ?4, deck_narrative_preset_id = ?5, narrative_notes = ?6, presentation_readme = ?7, local_body_cleared = 0 WHERE id = ?8 AND account_scope = ?9",
        params![
            presentation.topic,
            saved_at,
            presentation.character_id,
            deck_json,
            presentation.deck_narrative_preset_id,
            presentation.narrative_notes,
            presentation.presentation_readme,
            id,
            account_scope
        ],
    )?;
    if conn.changes() == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    conn.execute("DELETE FROM slide_images WHERE presentation_id = ?1", params![id])?;
    conn.execute("DELETE FROM slides WHERE presentation_id = ?1", params![id])?;

    for (ordinal, slide) in presentation.slides.iter().enumerate() {
        let ord = ordinal as i32;
        let presenter_3d_view_json: Option<String> = slide
            .presenter_3d_view_state
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let matrix_json: Option<String> = slide
            .matrix_data
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let canvas_scene_json: Option<String> = slide
            .canvas_scene
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        conn.execute(
            r#"
            INSERT INTO slides (
                presentation_id, ordinal, id, type, title, subtitle, content,
                image_prompt, code, language, font_size, video_url, content_type,
                image_width_percent, content_layout, panel_height_percent, presenter_notes, speech, excalidraw_data,
                isometric_flow_data,
                presenter_3d_device_id, presenter_3d_screen_media, presenter_3d_model_scale, presenter_3d_view_state,
                editor_title_width_percent, editor_title_min_height_px, editor_content_width_percent, editor_content_min_height_px,
                matrix_data, canvas_scene
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30)
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
                slide.isometric_flow_data,
                slide.presenter_3d_device_id,
                slide.presenter_3d_screen_media,
                None::<f64>,
                presenter_3d_view_json,
                slide
                    .editor_title_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_title_min_height_px
                    .map(|n| n.round().clamp(24., 2000.) as i32),
                slide
                    .editor_content_width_percent
                    .map(|n| n.round().clamp(0., 100.) as i32),
                slide
                    .editor_content_min_height_px
                    .map(|n| n.round().clamp(40., 2000.) as i32),
                matrix_json,
                canvas_scene_json,
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

pub fn load_presentation(
    conn: &Connection,
    id: &str,
    account_scope: &str,
) -> Result<SavedPresentation, rusqlite::Error> {
    let (topic, saved_at, character_id, deck_theme_raw, deck_narrative_preset_id, narrative_notes, presentation_readme): (
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = conn.query_row(
        "SELECT topic, saved_at, character_id, deck_visual_theme, deck_narrative_preset_id, narrative_notes, presentation_readme FROM presentations WHERE id = ?1 AND account_scope = ?2",
        params![id, account_scope],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?)),
    )?;
    let deck_visual_theme = deck_theme_raw
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .and_then(|s| serde_json::from_str(s).ok());

    let mut slides: Vec<Slide> = Vec::new();
    let mut stmt = conn.prepare(
        r#"
        SELECT ordinal, id, type, title, subtitle, content, image_prompt, code, language,
               font_size, video_url, content_type, image_width_percent, content_layout, panel_height_percent,
               presenter_notes, speech, excalidraw_data, isometric_flow_data, presenter_3d_device_id, presenter_3d_screen_media,
               presenter_3d_model_scale, presenter_3d_view_state,
               editor_title_width_percent, editor_title_min_height_px, editor_content_width_percent, editor_content_min_height_px,
               matrix_data, canvas_scene
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
            row.get::<_, Option<String>>(18)?,
            row.get::<_, Option<String>>(19)?,
            row.get::<_, Option<String>>(20)?,
            row.get::<_, Option<f64>>(21)?,
            row.get::<_, Option<String>>(22)?,
            row.get::<_, Option<i32>>(23)?,
            row.get::<_, Option<i32>>(24)?,
            row.get::<_, Option<i32>>(25)?,
            row.get::<_, Option<i32>>(26)?,
            row.get::<_, Option<String>>(27)?,
            row.get::<_, Option<String>>(28)?,
        ))
    })?;

    for row in rows {
        let (
            ordinal,
            slide_id,
            slide_type,
            title,
            subtitle,
            content,
            image_prompt,
            code,
            language,
            font_size,
            video_url,
            content_type,
            image_width_percent,
            content_layout,
            panel_height_percent,
            presenter_notes,
            speech,
            excalidraw_data,
            isometric_flow_data,
            presenter_3d_device_id,
            presenter_3d_screen_media,
            _presenter_3d_model_scale_legacy,
            presenter_3d_view_json,
            editor_title_width_percent,
            editor_title_min_height_px,
            editor_content_width_percent,
            editor_content_min_height_px,
            matrix_data_raw,
            canvas_scene_raw,
        ) = row?;

        let presenter_3d_view_state: Option<Presenter3dViewStateDto> = presenter_3d_view_json
            .and_then(|s| serde_json::from_str(&s).ok());

        let matrix_data: Option<serde_json::Value> = matrix_data_raw
            .as_ref()
            .filter(|s| !s.is_empty())
            .and_then(|s| serde_json::from_str(s).ok());

        let canvas_scene: Option<serde_json::Value> = canvas_scene_raw
            .as_ref()
            .filter(|s| !s.is_empty())
            .and_then(|s| serde_json::from_str(s).ok());

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
            isometric_flow_data,
            presenter_3d_device_id,
            presenter_3d_screen_media,
            presenter_3d_view_state,
            editor_title_width_percent: editor_title_width_percent.map(|n| n as f64),
            editor_title_min_height_px: editor_title_min_height_px.map(|n| n as f64),
            editor_content_width_percent: editor_content_width_percent.map(|n| n as f64),
            editor_content_min_height_px: editor_content_min_height_px.map(|n| n as f64),
            matrix_data,
            canvas_scene,
        });
    }

    Ok(SavedPresentation {
        id: id.to_string(),
        topic,
        saved_at,
        slides,
        character_id,
        deck_visual_theme,
        deck_narrative_preset_id,
        narrative_notes,
        presentation_readme,
    })
}

pub fn list_presentations(
    conn: &Connection,
    account_scope: &str,
) -> Result<Vec<SavedPresentationMeta>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        r#"
        SELECT p.id, p.topic, p.saved_at, p.cloud_id, p.cloud_synced_at, p.cloud_revision,
               COALESCE(p.local_body_cleared, 0) AS lbc,
               p.shared_cloud_source,
               p.dirty_slide_ids,
               p.sync_status,
               p.last_synced_revision,
               COUNT(s.ordinal) AS slide_count
        FROM presentations p
        LEFT JOIN slides s ON s.presentation_id = p.id
        WHERE p.account_scope = ?1
        GROUP BY p.id, p.topic, p.saved_at, p.cloud_id, p.cloud_synced_at, p.cloud_revision, p.local_body_cleared, p.shared_cloud_source, p.dirty_slide_ids, p.sync_status, p.last_synced_revision
        ORDER BY p.saved_at DESC
        "#,
    )?;
    let rows = stmt.query_map(params![account_scope], |row| {
        let dirty_slide_ids_raw: Option<String> = row.get(8)?;
        let dirty_slide_ids = dirty_slide_ids_raw
            .as_ref()
            .map(|raw| raw.trim())
            .filter(|raw| !raw.is_empty())
            .and_then(|raw| serde_json::from_str::<Vec<String>>(raw).ok())
            .unwrap_or_default();
        Ok(SavedPresentationMeta {
            id: row.get(0)?,
            topic: row.get(1)?,
            saved_at: row.get(2)?,
            cloud_id: row.get(3)?,
            cloud_synced_at: row.get(4)?,
            cloud_revision: row.get(5)?,
            local_body_cleared: row.get::<_, i64>(6)? != 0,
            shared_cloud_source: row.get(7)?,
            dirty_slide_ids,
            sync_status: row.get(9)?,
            last_synced_revision: row.get(10)?,
            slide_count: row.get(11)?,
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
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let n = conn.execute(
        "UPDATE presentations SET cloud_id = ?1, cloud_synced_at = ?2, cloud_revision = ?3 WHERE id = ?4 AND account_scope = ?5",
        params![cloud_id, cloud_synced_at, cloud_revision, id, account_scope],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

/// Marca el origen `ownerUid::cloudId` tras importar una presentación compartida (dedupe en UI).
pub fn set_presentation_shared_cloud_source(
    conn: &Connection,
    id: &str,
    shared_cloud_source: Option<&str>,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let n = conn.execute(
        "UPDATE presentations SET shared_cloud_source = ?1 WHERE id = ?2 AND account_scope = ?3",
        params![shared_cloud_source, id, account_scope],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

/// Actualiza metadatos de sincronización local (dirty slides, estado y última revisión confirmada).
pub fn set_presentation_sync_state(
    conn: &Connection,
    id: &str,
    dirty_slide_ids: Option<Vec<String>>,
    sync_status: Option<&str>,
    last_synced_revision: Option<i64>,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let dirty_slide_ids_json = dirty_slide_ids
        .map(|ids| ids.into_iter().filter(|id| !id.trim().is_empty()).collect::<Vec<_>>())
        .and_then(|ids| serde_json::to_string(&ids).ok());
    let n = conn.execute(
        "UPDATE presentations SET dirty_slide_ids = COALESCE(?1, dirty_slide_ids), sync_status = COALESCE(?2, sync_status), last_synced_revision = ?3 WHERE id = ?4 AND account_scope = ?5",
        params![dirty_slide_ids_json, sync_status, last_synced_revision, id, account_scope],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

/// Import a full saved presentation (e.g. from cloud). Uses `saved.id` as local row id.
pub fn import_saved_presentation(
    conn: &Connection,
    saved: &SavedPresentation,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    import_presentation(conn, saved, account_scope)
}

pub fn delete_presentation(
    conn: &Connection,
    id: &str,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM presentations WHERE id = ?1 AND account_scope = ?2",
        params![id, account_scope],
    )?;
    Ok(())
}

/// Borra diapositivas e imágenes locales y deja un stub con `cloud_id` (copia solo en la nube).
pub fn clear_presentation_local_body(
    conn: &Connection,
    id: &str,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM presentations WHERE id = ?1 AND account_scope = ?2 \
         AND cloud_id IS NOT NULL AND TRIM(cloud_id) != ''",
        params![id, account_scope],
        |r| r.get(0),
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    conn.execute(
        "DELETE FROM slide_images WHERE presentation_id = ?1",
        params![id],
    )?;
    conn.execute(
        "DELETE FROM slides WHERE presentation_id = ?1",
        params![id],
    )?;
    let updated = conn.execute(
        "UPDATE presentations SET character_id = NULL, local_body_cleared = 1 WHERE id = ?1 AND account_scope = ?2",
        params![id, account_scope],
    )?;
    if updated == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

// --- Saved characters ---

pub fn list_characters(
    conn: &Connection,
    account_scope: &str,
) -> Result<Vec<SavedCharacter>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, reference_image_url, cloud_synced_at, cloud_revision FROM saved_characters WHERE account_scope = ?1 ORDER BY name",
    )?;
    let rows = stmt.query_map(params![account_scope], |row| {
        Ok(SavedCharacter {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            reference_image_data_url: row.get(3)?,
            cloud_synced_at: row.get(4)?,
            cloud_revision: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn save_character(
    conn: &Connection,
    character: &SavedCharacter,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO saved_characters (account_scope, id, name, description, reference_image_url, cloud_synced_at, cloud_revision) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            account_scope,
            character.id,
            character.name,
            character.description,
            character.reference_image_data_url,
            character.cloud_synced_at,
            character.cloud_revision,
        ],
    )?;
    Ok(())
}

pub fn set_character_cloud_state(
    conn: &Connection,
    id: &str,
    cloud_synced_at: Option<&str>,
    cloud_revision: Option<i64>,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    let n = conn.execute(
        "UPDATE saved_characters SET cloud_synced_at = ?1, cloud_revision = ?2 WHERE id = ?3 AND account_scope = ?4",
        params![cloud_synced_at, cloud_revision, id, account_scope],
    )?;
    if n == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    Ok(())
}

pub fn delete_character(
    conn: &Connection,
    id: &str,
    account_scope: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM saved_characters WHERE id = ?1 AND account_scope = ?2",
        params![id, account_scope],
    )?;
    Ok(())
}

// --- Biblioteca de recursos generados (imágenes / modelos 3D) ---

const GENERATED_RESOURCES_LIST_CAP: i64 = 120;

pub fn add_generated_resource(
    conn: &Connection,
    account_scope: &str,
    kind: &str,
    payload: &str,
    prompt: Option<&str>,
    source: Option<&str>,
) -> Result<GeneratedResourceEntry, rusqlite::Error> {
    let id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO generated_resources (account_scope, id, kind, payload, prompt, source, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            account_scope,
            id,
            kind,
            payload,
            prompt,
            source,
            created_at,
        ],
    )?;
    Ok(GeneratedResourceEntry {
        id,
        kind: kind.to_string(),
        payload: payload.to_string(),
        prompt: prompt.map(|s| s.to_string()),
        source: source.map(|s| s.to_string()),
        created_at,
    })
}

pub fn list_generated_resources(
    conn: &Connection,
    account_scope: &str,
) -> Result<Vec<GeneratedResourceEntry>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, payload, prompt, source, created_at FROM generated_resources WHERE account_scope = ?1 ORDER BY datetime(created_at) DESC LIMIT ?2",
    )?;
    let rows = stmt.query_map(
        params![account_scope, GENERATED_RESOURCES_LIST_CAP],
        |row| {
            Ok(GeneratedResourceEntry {
                id: row.get(0)?,
                kind: row.get(1)?,
                payload: row.get(2)?,
                prompt: row.get(3)?,
                source: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )?;
    rows.collect()
}

pub fn delete_generated_resource(
    conn: &Connection,
    account_scope: &str,
    id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM generated_resources WHERE account_scope = ?1 AND id = ?2",
        params![account_scope, id],
    )?;
    Ok(())
}
