# Slaim (slides-for-devs)

Aplicación de escritorio para crear presentaciones orientadas a desarrolladores. Genera slides con IA (Gemini u OpenAI), edita contenido en Markdown, añade bloques de código, imágenes generadas por IA y vídeos, y presenta con vista de presentador y notas.

## Características

- **Generación con IA**: Crea una presentación completa a partir de un tema usando Gemini (Google AI) u OpenAI.
- **Editor de slides**: Diapositivas de contenido y de capítulo, con soporte para Markdown, bloques de código con syntax highlighting, imágenes y vídeos embebidos.
- **Imágenes con IA**: Genera imágenes para slides con Gemini (modelos de imagen).
- **Código con IA**: Genera o reescribe fragmentos de código desde el editor.
- **Notas del presentador**: Notas por slide y guiones sugeridos (speech) para cada diapositiva.
- **Vista presentador**: Ventana secundaria con slide actual, siguiente, notas y chat.
- **Guardar y cargar**: Presentaciones guardadas en local (SQLite en Tauri, almacenamiento en web).
- **Actualizador**: Comprueba y aplica actualizaciones desde GitHub Releases.

## Requisitos

- **Node.js** (LTS recomendado)
- **Rust** (solo para ejecutar o compilar la app Tauri)
- **pnpm** (recomendado) o npm

Para compilar Tauri en Linux se necesitan dependencias GTK/WebKit; en Ubuntu/Debian:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/EdinsonNM/slides-for-devs.git
cd slides-for-devs

# Instalar dependencias
pnpm install
# o: npm install
```

## Ejecución

### Modo web (solo frontend)

```bash
pnpm run dev
```

Abre `http://localhost:3000`. Las API keys se configuran en la pantalla de inicio (no se usan variables de entorno para las claves).

### Modo escritorio (Tauri)

```bash
pnpm run tauri:dev
```

Se levanta el servidor Vite y se abre la ventana de la app. La primera vez que abras la app, configura al menos una API key (Gemini u OpenAI) en la pantalla de inicio.

## API keys

Las claves de **Gemini** (Google AI) y **OpenAI** se configuran dentro de la aplicación en la pantalla de inicio o desde el menú de configuración. No es necesario usar `.env` para las API keys.

- **Gemini**: [Google AI Studio](https://aistudio.google.com/apikey)
- **OpenAI**: [API Keys](https://platform.openai.com/api-keys)

## Scripts

| Comando            | Descripción                    |
|--------------------|--------------------------------|
| `pnpm run dev`     | Servidor de desarrollo (Vite) |
| `pnpm run build`   | Build del frontend             |
| `pnpm run preview` | Vista previa del build         |
| `pnpm run tauri:dev`   | App de escritorio en modo desarrollo |
| `pnpm run tauri:build` | Build de la app Tauri para distribución |
| `pnpm run lint`    | Comprobación de tipos (TypeScript) |

## Tecnologías

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Motion
- **Desktop**: Tauri 2 (Rust)
- **IA**: Google Gemini (`@google/genai`), OpenAI (API REST)
- **Contenido**: Markdown (react-markdown), react-syntax-highlighter

## Releases

Los binarios se publican en [GitHub Releases](https://github.com/EdinsonNM/slides-for-devs/releases) para:

- Windows (x86_64)
- macOS (x86_64 y aarch64)
- Linux (x86_64)

El flujo de release se dispara con push a la rama `release` o con un tag `v*`. La app incluye actualizador automático que consulta `latest.json` en los releases.

## Licencia

Este proyecto está bajo la [licencia MIT](LICENSE): uso libre (uso, copia, modificación, distribución) manteniendo el aviso de copyright y de la licencia. Los derechos del autor se conservan.
