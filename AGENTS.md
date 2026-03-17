# AGENTS.md

## Propósito del proyecto

`slides-for-devs` es una aplicación de escritorio para crear presentaciones técnicas con ayuda de IA. El frontend está hecho con `React 19 + TypeScript + Vite`, y la app de escritorio usa `Tauri 2` con backend en `Rust`. La app genera, edita, guarda y presenta slides; también maneja notas del presentador, imágenes, video y configuración de proveedores de IA.

## Stack principal

- Frontend: `React 19`, `TypeScript`, `Vite`, `Tailwind CSS`
- Desktop: `Tauri 2`
- Backend desktop: `Rust`
- Persistencia: `SQLite` vía Tauri
- IA: `Gemini` y `OpenAI`

## Comandos útiles

- `pnpm run dev`: levanta el frontend web en desarrollo
- `pnpm run build`: compila el frontend
- `pnpm run lint`: validación de tipos con TypeScript
- `pnpm run tauri:dev`: ejecuta la app Tauri en desarrollo
- `pnpm run tauri:build`: genera build de escritorio

Usa `pnpm` como opción preferida. `npm` existe, pero este repo ya incluye `pnpm-lock.yaml`.

## Estructura importante

- `src/`: aplicación frontend
- `src/components/`: componentes organizados por feature
- `src/context/PresentationContext.tsx`: estado global principal de presentaciones
- `src/hooks/`: hooks de estado y lógica UI
- `src/services/`: integración con almacenamiento, IA, updater y config
- `src/constants/`: catálogos y opciones del editor
- `src/utils/`: helpers puros
- `src-tauri/src/`: comandos Tauri, acceso a base de datos y keychain
- `scripts/`: utilidades auxiliares del proyecto
- `public/`: assets estáticos web

## Convenciones de trabajo

- Antes de editar, identifica si el cambio pertenece a `frontend`, `Tauri/Rust` o ambos.
- Mantén los componentes en la carpeta de su feature. Si algo es reutilizable entre editor, preview y presenter, colócalo en `src/components/shared/`.
- Evita meter lógica de negocio pesada directamente en componentes grandes como `src/App.tsx`; extrae a `hooks`, `services` o utilidades cuando el cambio crezca.
- Reutiliza el contexto existente (`usePresentation`) antes de introducir nuevo estado global.
- Conserva el estilo actual: componentes funcionales, TypeScript estricto, imports relativos locales, y clases utilitarias para estilos.
- Si tocas persistencia o configuración sensible, revisa también el contrato entre `src/services/*` y `src-tauri/src/*`.

## Persistencia y claves

- Las presentaciones de escritorio se guardan en SQLite desde comandos Tauri.
- Las API keys no deben añadirse en código ni hardcodearse.
- La configuración de Gemini/OpenAI se maneja dentro de la app; no cambies el proyecto para depender de claves en `.env` salvo que el usuario lo pida explícitamente.
- Trata `slides.db` como dato local de desarrollo, no como fuente de verdad para cambios de código.

## Qué archivos evitar tocar sin necesidad

- `dist/`: artefactos generados
- `node_modules/`: dependencias instaladas
- `src-tauri/target/`: artefactos de compilación de Rust
- `slides.db`: base local
- lockfiles: no modificarlos salvo que realmente cambien dependencias

## Reglas para cambios

- Haz cambios pequeños y enfocados; no mezcles refactors amplios con fixes puntuales.
- Si agregas una nueva capacidad UI, valida al menos:
  - render correcto
  - tipado TypeScript
  - que no rompa el flujo de editor, preview o presenter si aplica
- Si agregas o cambias un comando Tauri, verifica que el frontend consumidor también quede actualizado.
- Si hay lógica compartida entre modo web y modo Tauri, considera el fallback web existente antes de asumir APIs de Tauri disponibles.

## Validación mínima antes de cerrar trabajo

- Ejecuta `pnpm run lint` cuando el cambio toque TypeScript
- Ejecuta `pnpm run build` si el cambio afecta composición general, imports o bundling
- Ejecuta `pnpm run tauri:dev` solo cuando el cambio dependa de integración Tauri/Rust o almacenamiento desktop

Si no puedes correr alguna validación, deja claro qué no se verificó.

## Guía rápida por tipo de tarea

### UI / componentes

- Busca primero en `src/components/home`, `editor`, `preview`, `presenter`, `layout`, `modals`
- Mantén consistencia visual y de props

### Estado y flujo de presentación

- Revisa `src/context/PresentationContext.tsx`
- Revisa hooks en `src/hooks/`

### IA / generación de contenido

- Revisa `src/services/gemini.ts`
- Revisa `src/services/openai.ts`
- Revisa `src/services/apiConfig.ts`

### Persistencia desktop

- Revisa `src/services/storage.ts`
- Revisa `src-tauri/src/db.rs`
- Revisa `src-tauri/src/lib.rs`

### Firebase (Slaim en la nube)

- Auth y config: `src/services/firebase.ts`, `src/context/AuthContext.tsx`
- **Desarrollo (web y Tauri)**: usar un solo `.env` en la raíz con `VITE_FIREBASE_*`. Vite inyecta esas variables en el frontend; en `tauri dev` el frontend se sirve desde Vite, así que el mismo `.env` vale para ambos. No commitear `.env`.
- **Producción desktop (app empaquetada)**: La app busca `firebase_config.json` en AppData y en el bundle. Para que el instalador de GitHub use tu Firebase, añade el secreto **`FIREBASE_CONFIG_JSON`** (Settings → Secrets → Actions) con el JSON de config (formato `firebase_config.example.json`). El workflow de release lo inyecta en `src-tauri/firebase_config.bundle.json` y se empaqueta. Sin secreto se empaqueta un placeholder (modo local; login/cloud requieren config en AppData). Login: `google_oauth_client_id` y opcionalmente `google_oauth_client_secret`; el flujo usa PKCE y puede funcionar sin secret.
- **Login en desktop (Tauri)**: flujo estándar para apps instaladas: la app abre el **navegador del sistema**, escucha en **127.0.0.1:8765/callback** (loopback), usa **PKCE** (sin client_secret). Implementación: `src-tauri/src/oauth_google.rs`, comando `sign_in_google_external_browser`. En **Google Cloud Console** → Credentials → OAuth 2.0 Client ID (tipo Web) → **Authorized redirect URIs** añadir exactamente: `http://127.0.0.1:8765/callback`. Google acepta loopback para apps de escritorio. No usar `tauri.localhost` (no válido).

## Criterios de calidad

- Prioriza compatibilidad con la arquitectura existente sobre introducir nuevos patrones.
- No dupliques lógica si ya existe un servicio, modal o panel que resuelva parte del problema.
- Mantén nombres claros en inglés dentro del código, aunque la documentación del repo esté en español.
- No hagas cambios destructivos sobre datos de usuario o migraciones sin pedir confirmación explícita.
