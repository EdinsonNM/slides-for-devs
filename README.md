<div align="center">

<img src="src-tauri/icons/128x128.png" width="128" height="128" alt="Slaim logo"/>

# **Slaim**

### Presentaciones técnicas con IA, hechas para desarrolladores

[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

*Crea slides en minutos, no en horas. Markdown, código, diagramas y notas del presentador en una sola app.*

[Descargar](#-descargas) · [Características](#-características) · [Instalación](#-instalación) · [Contribuir](#-contribuir)

</div>

---

## ¿Qué es Slaim?

**Slaim** (en producción) es la evolución de este repositorio: una aplicación de escritorio para crear presentaciones técnicas con ayuda de IA. Se centra en el usuario que quiere **mostrar código, gráficos y diagramas** para explicar mejor su idea: arquitecturas, APIs, flujos o conceptos. Pensada para devs, tech leads y equipos que necesitan explicar lo técnico sin pelearse con herramientas pensadas para slides decorativos.

Puedes usarla **en local** (todo gratis, sin ataduras) o **con cuenta** para una experiencia unificada y futuras funciones en la nube. Parte del proyecto es de código abierto y la comunidad puede contribuir, usarlo y adaptarlo bajo la [licencia MIT](LICENSE).

---

## ¿Qué la hace diferente?

| Slaim | PowerPoint, Google Slides y apps de slides con diseños bonitos |
|-------|------------------------------------------------------------------|
| **IA integrada** (Gemini y OpenAI) para generar presentaciones completas desde un tema, reescribir slides y generar código o imágenes | Hay que copiar/pegar desde ChatGPT o usar plugins dispersos |
| **Markdown + código** con syntax highlighting y bloques configurables | Soporte limitado o sin resaltado de lenguajes |
| **Diagramas Excalidraw** dentro de la presentación (sketches, arquitecturas, flujos) | Diagramas en herramientas externas y luego incrustar |
| **Vista presentador** con slide actual, siguiente, notas y guiones sugeridos por IA | Notas básicas o sin guiones |
| **Export a PowerPoint** (.pptx) para compartir o presentar donde haga falta | Mismo ecosistema, sin foco en código ni diagramas técnicos |
| **App nativa con Tauri** (ligera, rápida, sin Electron) | Apps pesadas o solo web |
| **Actualizador automático** desde GitHub Releases | Actualizaciones manuales |
| **Personajes reutilizables** para que las imágenes generadas por IA mantengan la misma apariencia en todas las diapositivas | Sin control fino sobre personajes en imágenes |

A diferencia de PowerPoint, Google Slides o otras apps centradas en diseños vistosos y plantillas genéricas, Slaim está pensada para quien necesita **mostrar código, diagramas y gráficos** que expliquen mejor la idea: arquitecturas, APIs, flujos de datos o conceptos técnicos. Crear y dar esas presentaciones de principio a fin, con IA integrada y sin salir de la app.

---

## Características

- **Generación con IA**  
  Crea una presentación completa a partir de un tema usando **Gemini** (Google AI) u **OpenAI**. Elige el modelo en la barra superior.

- **Editor de slides**  
  Diapositivas de contenido y de capítulo. Markdown, bloques de código con syntax highlighting, imágenes y vídeos embebidos.

- **Imágenes con IA**  
  Genera imágenes para slides con Gemini. Crea **personajes** (avatares con descripción e imagen de referencia) y reutilízalos para mantener coherencia visual.

- **Código con IA**  
  Genera o reescribe fragmentos de código desde el editor con un clic.

- **Diagramas Excalidraw**  
  Tipo de slide «diagrama»: dibuja arquitecturas, flujos o esquemas con Excalidraw integrado.

- **Notas del presentador**  
  Notas por slide y **guiones sugeridos (speech)** por diapositiva para ensayar o presentar con confianza.

- **Vista presentador**  
  Ventana secundaria con slide actual, siguiente, notas y chat.

- **Guardar y cargar**  
  Presentaciones guardadas en local: SQLite en la app Tauri, almacenamiento en navegador en modo web.

- **Inicio de sesión opcional (Google)**  
  Inicia sesión con Google para una experiencia unificada y futuras funciones en la nube (Firebase). No es obligatorio: puedes usar Slaim 100 % en local.

- **Export a PowerPoint**  
  Exporta la presentación a `.pptx` desde el menú (en desktop se abre el diálogo para guardar el archivo).

- **Actualizador**  
  La app de escritorio comprueba y aplica actualizaciones desde GitHub Releases.

---

## Requisitos

- **Node.js** (LTS recomendado)
- **Rust** (solo para ejecutar o compilar la app Tauri)
- **pnpm** (recomendado) o npm

En Linux, para compilar Tauri hacen falta dependencias GTK/WebKit. En Ubuntu/Debian:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

---

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/EdinsonNM/slides-for-devs.git
cd slides-for-devs

# Instalar dependencias
pnpm install
# o: npm install
```

---

## Ejecución

### Modo web (solo frontend)

```bash
pnpm run dev
```

Abre `http://localhost:3000`. Las API keys se configuran en la pantalla de inicio (no hace falta usar variables de entorno para las claves).

### Modo escritorio (Tauri)

```bash
pnpm run tauri:dev
```

Se levanta el servidor Vite y se abre la ventana de la app. La primera vez, configura al menos una API key (Gemini u OpenAI) en la pantalla de inicio.

---

## API keys

Las claves de **Gemini** (Google AI) y **OpenAI** se configuran dentro de la aplicación en la pantalla de inicio o desde el menú de configuración. No es necesario usar `.env` para las API keys.

- **Gemini**: [Google AI Studio](https://aistudio.google.com/apikey)
- **OpenAI**: [API Keys](https://platform.openai.com/api-keys)

---

## Scripts

| Comando              | Descripción                          |
|----------------------|--------------------------------------|
| `pnpm run dev`       | Servidor de desarrollo (Vite)       |
| `pnpm run build`     | Build del frontend                   |
| `pnpm run preview`   | Vista previa del build               |
| `pnpm run tauri:dev` | App de escritorio en modo desarrollo |
| `pnpm run tauri:build` | Build de la app Tauri para distribución |
| `pnpm run lint`      | Comprobación de tipos (TypeScript)   |

---

## Tecnologías

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Motion
- **Desktop**: Tauri 2 (Rust)
- **IA**: Google Gemini (`@google/genai`), OpenAI (API REST)
- **Contenido**: Markdown (react-markdown), react-syntax-highlighter, Excalidraw
- **Nube (opcional)**: Firebase (Auth, Analytics). **Sincronización de presentaciones** (Firestore + Storage) desde la app de escritorio: configura reglas en Firebase Console según [docs/firebase-rules.md](docs/firebase-rules.md).

---

## Descargas

Los binarios se publican en [GitHub Releases](https://github.com/EdinsonNM/slides-for-devs/releases) para:

- **Windows** (x86_64)
- **macOS** (x86_64 y aarch64)
- **Linux** (x86_64)

El flujo de release se dispara con push a la rama `release` o con un tag `v*`. La app incluye actualizador automático que consulta los releases.

---

## Contribuir

Las contribuciones son bienvenidas. Si quieres reportar un bug, proponer una mejora o enviar un PR, revisa primero los issues abiertos y el [AGENTS.md](AGENTS.md) para convenciones y estructura del proyecto. Pequeños cambios y documentación también cuentan.

---

## Licencia

Este proyecto está bajo la [licencia MIT](LICENSE): uso libre (uso, copia, modificación, distribución) manteniendo el aviso de copyright y de la licencia.

---

<div align="center">

Hecho con cuidado para la comunidad de desarrolladores.

<img src="src-tauri/icons/32x32.png" width="24" height="24" alt="Slaim" /> **Slaim** · [slides-for-devs](https://github.com/EdinsonNM/slides-for-devs)

</div>
