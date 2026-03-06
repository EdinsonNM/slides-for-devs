# Estructura de componentes

Organización por **feature** y componentes reutilizables para facilitar mantenimiento y legibilidad.

## Carpetas

| Carpeta | Uso |
|--------|-----|
| **shared/** | Componentes reutilizables entre editor, preview y presentador (SlideMarkdown, CodeDisplay). |
| **layout/** | Header y barra lateral de diapositivas. |
| **home/** | Pantalla inicial: HomeScreen, PromptInput, SavedCarousel. |
| **editor/** | Edición de slides: SlideEditor, contenidos (Default/Chapter), panel derecho, CodeBlock, etc. |
| **modals/** | Modales (BaseModal, ApiConfig, SavedList, Image/Code generation, Video, Split, Rewrite, Speech). |
| **preview/** | Vista previa: PreviewOverlay, PreviewToolbar, PreviewSlideContent. |
| **presenter/** | Modo presentador: PresenterView, PresenterHeader, PresenterSlideSummary, PresenterChat. |

## Convenciones

- Cada feature tiene sus subcomponentes en la misma carpeta.
- **shared/** solo contiene componentes sin dependencia de `usePresentation()`; reciben datos por props.
- Los barrels (`index.ts`) exportan solo lo que se usa desde `App`; los subcomponentes se importan desde su carpeta cuando hace falta.
