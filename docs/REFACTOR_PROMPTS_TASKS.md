# Refactor del sistema de prompts — Tareas verificables

Documento de tareas para ejecutar el [plan de refactor](../.cursor/plans/json_prompt_input_precisión_5ae2634d.plan.md). Marca con `[x]` al completar. Añade fecha y notas bajo cada tarea si lo necesitas.

**Objetivo:** Migrar de prompts como strings largos a arquitectura con Prompt Object Pattern, reglas reutilizables, schemas y Prompt Engine. Comportamiento funcional debe mantenerse.

---

## Cómo usar este documento

- **Estado:** `[ ]` pendiente → `[x]` completado.
- **Verificación:** Comprueba cada ítem de "Criterios de verificación" antes de marcar la tarea.
- **Actualizar:** Añade una línea `Completado: YYYY-MM-DD` o notas bajo la tarea cuando la termines.

---

## Tarea 1 — Crear reglas reutilizables (`promptRules/`)

**ID:** `rules`  
**Estado:** [x]

**Descripción:** Crear la carpeta `src/infrastructure/promptRules/` y los tres archivos de reglas. Cada archivo exporta reglas reutilizables (array de strings o string formateado) para que el Prompt Engine las inyecte.

**Subtareas:**

- [x] Crear `src/infrastructure/promptRules/markdown.rules.ts`
  - Contenido: encabezados `# ## ###`; una viñeta o ítem numerado por línea; no usar `* **Título:**` como subtítulo; `**` solo para énfasis en línea; markdown limpio.
  - Exportar algo tipo `markdownContentRules: string[]` o `markdownContentRulesText(): string`.
- [x] Crear `src/infrastructure/promptRules/json.rules.ts`
  - Contenido: devolver JSON válido; sin explicaciones ni texto fuera del JSON; "Responde ÚNICAMENTE...".
  - Exportar reglas para respuestas en JSON.
- [x] Crear `src/infrastructure/promptRules/image.rules.ts`
  - Contenido: no texto en la imagen; no describir estilo si ya está definido; coherencia con contexto del slide; personaje dinámico (pose/acción distinta) cuando aplique.
  - Exportar reglas reutilizables para prompts de imagen.

**Criterios de verificación:**

- [x] Existe la carpeta `promptRules/` y los tres archivos.
- [x] Cada archivo exporta al menos un identificador (array o función) que otro módulo puede importar.
- [x] El texto de las reglas refleja lo que hoy está en `PromptTemplates.ts` (sin cambiar el significado).

**Notas / Completado:** Completado. Añadido `promptRules/index.ts` para exportaciones.

---

## Tarea 2 — Definir schemas del output (`schemas/`)

**ID:** `schemas`  
**Estado:** [x]

**Descripción:** Crear `src/infrastructure/schemas/` con la estructura de salida para slides y presentación. Sirven para documentar el JSON al LLM y, opcionalmente, validar o unificar el parseo.

**Subtareas:**

- [x] Crear `src/infrastructure/schemas/slide.schema.ts`
  - Definir estructura: `id`, `type`, `title`, `content`, `imagePrompt`, `subtitle` (opcional).
  - Exportar descripción para el LLM y/o objeto/Zod para validación si se desea.
- [x] Crear `src/infrastructure/schemas/presentation.schema.ts`
  - Definir `{ slides: Slide[] }` y considerar variante array directo.
  - Pensar en reutilizar en `parseSlides` de los adaptadores (un solo punto de verdad).

**Criterios de verificación:**

- [x] Existe la carpeta `schemas/` y los dos archivos.
- [x] Los tipos/estructuras son compatibles con `Slide` en `src/domain/entities/Slide.ts`.
- [x] Se puede importar desde otros módulos sin errores.

**Notas / Completado:** Completado. Añadidos SlideSchemaItem, slideSchemaDescription, parseSlidesFromResponse, schemas/index.ts.

---

## Tarea 3 — Crear Prompt Engine (`promptEngine/`)

**ID:** `engine`  
**Estado:** [x]

**Dependencias:** Tarea 1 y 2 (para que el engine use reglas y schemas).

**Descripción:** Crear `src/infrastructure/promptEngine/` con tipos del prompt object y la función que construye el prompt final.

**Subtareas:**

- [x] Crear `src/infrastructure/promptEngine/types.ts`
  - Definir interfaz del prompt object: p. ej. `role`, `task`, `rules`, `constraints`, `outputSchema`, `inputSchema` (opcional).
  - Tipar el `input` genérico o por variantes (presentation, splitSlide, rewriteSlide, image, etc.).
- [x] Crear `src/infrastructure/promptEngine/buildPrompt.ts`
  - Implementar `buildPrompt(promptDefinition, input)`: combina role + task + rules + constraints + input (texto + JSON cuando convenga) + descripción del output.
  - Devolver `{ system, user }` (o el formato que consuman los adaptadores).
  - Para `generatePresentation`, soportar input tipo `{ topic, slideCount, strictCount }` y generar frase breve + bloque `Datos:\n{ ... }` en el user message.

**Criterios de verificación:**

- [x] Existen `promptEngine/types.ts` y `promptEngine/buildPrompt.ts`.
- [x] `buildPrompt(def, input)` devuelve un objeto con al menos `system` y `user` (strings).
- [x] Con un prompt definition e input de prueba, el resultado es coherente y sin errores de tipo.

**Notas / Completado:** Completado. Añadido `buildUserMessage` opcional en la definición para construir el user message por flujo.

---

## Tarea 4 — Convertir prompts a objetos (`prompts/`)

**ID:** `prompt-objects`  
**Estado:** [x]

**Dependencias:** Tareas 1, 2 y 3 (reglas, schemas, engine).

**Descripción:** Crear la carpeta `src/infrastructure/prompts/` (o reutilizar la actual y reorganizar) y definir cada flujo como prompt object. Eliminar los `static method(): string` de `PromptTemplates` que queden sustituidos.

**Subtareas:**

- [x] `generatePresentation.prompt.ts`: role, task, rules (markdown + json), constraints (min/max/default slides), output_schema (presentation), input con topic + slideCount.
- [x] `splitSlide.prompt.ts`: role, task, rules, constraints (mantener esencia, no parafrasear), output_schema (slides array).
- [x] `rewriteSlide.prompt.ts`: role, task, rules, output_schema (title + content).
- [x] `image.prompt.ts`: variantes por sub-tarea (alternatives, generation, refine, describe); reglas desde `image.rules`.
- [x] `presenter.prompt.ts`: objetos por sub-tarea (notes, speech, refine, chat).
- [x] `code.prompt.ts`: role, task, rules, output (solo código).
- [x] Mantener en un solo lugar (p. ej. `prompts/constants.ts`) `slideCountBounds` y `parseSlideCountFromTopic`; migrar desde `PromptTemplates` si hace falta.
- [x] Dejar `PromptTemplates.ts` solo con lo que siga en uso hasta que los adaptadores migren, o eliminarlo cuando todo use el engine.

**Criterios de verificación:**

- [x] Cada archivo de prompt exporta un objeto que cumple la interfaz definida en `promptEngine/types.ts`.
- [x] No hay duplicación de texto de reglas: se importan desde `promptRules`.
- [x] Los bounds y `parseSlideCountFromTopic` están disponibles para adaptadores/use cases.

**Notas / Completado:** Completado. Añadidos constants.ts, generatePresentation, splitSlide, rewriteSlide, image, presenter, code, slideCount y prompts/index.ts. PromptTemplates.ts se mantiene hasta Tarea 6.

---

## Tarea 5 — Reducir duplicación

**ID:** `dedup`  
**Estado:** [x]

**Dependencias:** Tareas 1, 2 y 4.

**Descripción:** Asegurar que todos los prompt objects usan reglas y schemas compartidos; no copiar texto de reglas dentro de cada prompt.

**Subtareas:**

- [x] Revisar cada archivo en `prompts/`: deben importar desde `promptRules` (markdown, json, image) y desde `schemas` donde aplique.
- [x] Eliminar cualquier copia pegada de las mismas reglas en distintos prompts.

**Criterios de verificación:**

- [x] Búsqueda en el código de frases típicas (p. ej. "encabezados con # ## ###") solo aparece en `promptRules` o en el engine al ensamblar.
- [x] `slide.schema` y `presentation.schema` se usan en generatePresentation, splitSlide y donde corresponda.

**Notas / Completado:** Completado. Añadido markdownUserReminder() en markdown.rules y usado en generatePresentation, splitSlide y rewriteSlide.

---

## Tarea 6 — Usar Prompt Engine en adaptadores

**ID:** `adapters`  
**Estado:** [x]

**Dependencias:** Tareas 3 y 4.

**Descripción:** Sustituir en los tres adaptadores las llamadas a `PromptTemplates` por `buildPrompt(promptDef, input)`.

**Subtareas:**

- [x] **Gemini.adapter.ts:** En `generatePresentation`, usar `buildPrompt(generatePresentationPrompt, { topic, slideCount, strictCount })` y reemplazar llamadas a `presentationSystem()` y `presentationUser()`. Idem para splitSlide, rewriteSlide, imagen, presenter y código.
- [x] **OpenAI.adapter.ts:** Mismo cambio: obtener `{ system, user }` con `buildPrompt(...)` y usarlos en `messages`.
- [x] **Xai.adapter.ts:** Mismo cambio para los flujos que use.
- [x] Mantener `response_format` / `responseSchema` y el parseo actual de respuestas.
- [x] Unificado `parseSlidesFromResponse` en schemas; adaptadores lo usan.

**Criterios de verificación:**

- [x] No quedan llamadas a `PromptTemplates` para los flujos migrados (o solo las que se mantengan por diseño).
- [x] Generar presentación desde la app produce el mismo comportamiento (mismo número de slides, estructura, tipos).
- [x] Split slide, rewrite slide, imágenes, presenter y código siguen funcionando como antes.
- [x] Build correcto; `PromptTemplates.ts` eliminado; `gemini.ts` migrado a buildPrompt.

**Notas / Completado:** Completado. Eliminado PromptTemplates.ts. Servicio gemini.ts también migrado.

---

## Tarea 7 — Soporte de versionado (v1 / v2)

**ID:** `versioning`  
**Estado:** [x]

**Dependencias:** Tareas 3, 4 y 6.

**Descripción:** Dejar la estructura lista para usar múltiples versiones de un mismo prompt (p. ej. `generatePresentation.v1.prompt.ts`, `generatePresentation.v2.prompt.ts`).

**Subtareas:**

- [x] Decidir convención: archivos `.v1.prompt.ts` / `.v2.prompt.ts` o carpeta `prompts/v1/`, `prompts/v2/`.
- [x] El selector de versión puede vivir en config o en el use case: por defecto usar v1; el engine recibe la definición ya elegida.
- [x] Documentar en código o en este doc cómo añadir una nueva versión y cómo activarla.

**Criterios de verificación:**

- [x] Se puede añadir un `generatePresentation.v2.prompt.ts` (o equivalente) y que el flujo use v1 por defecto.
- [x] Cambiar a v2 (config o parámetro) no rompe la build ni los tipos.

**Notas / Completado:** Completado. Convención documentada en `prompts/README.md`. Por defecto se usa la versión actual; v2 se añade cuando se necesite.

---

## Tarea 8 (opcional) — Slide Outline Generation

**ID:** `outline`  
**Estado:** [ ] (opcional; no implementado en esta ejecución)

**Dependencias:** Tareas 3, 4 y 6.

**Descripción:** Añadir una etapa opcional que genera primero un esquema (outline) de la presentación y luego las diapositivas siguiendo ese esquema.

**Subtareas:**

- [ ] Crear `generateOutline.prompt.ts`: el modelo devuelve un esquema numerado de secciones/títulos (sin contenido completo).
- [ ] Definir formato de outline (p. ej. lista de títulos o JSON ligero).
- [ ] En el flujo de generación: (a) llamar a `buildPrompt(generateOutlinePrompt, { topic, slideCount })` → outline; (b) llamar a `buildPrompt(generatePresentationPrompt, { topic, slideCount, outline })` para generar slides.
- [ ] Hacer esta secuencia opcional (feature flag o parámetro) para no cambiar el comportamiento por defecto.

**Criterios de verificación:**

- [ ] Con la opción activada, se genera outline y luego presentación; la estructura sigue el outline.
- [ ] Con la opción desactivada, el flujo es el mismo que antes (sin outline).

**Notas / Completado:** Dejada pendiente por ser opcional. La arquitectura actual (prompt objects + buildPrompt) permite añadirla más adelante sin cambios de diseño.

---

## Resumen de estado

| ID         | Tarea                          | Estado |
|-----------|---------------------------------|--------|
| rules     | Crear promptRules               | [x]    |
| schemas   | Crear schemas                   | [x]    |
| engine    | Crear Prompt Engine             | [x]    |
| prompt-objects | Convertir prompts a objetos | [x]    |
| dedup     | Reducir duplicación             | [x]    |
| adapters  | Usar engine en adaptadores      | [x]    |
| versioning| Versionado v1/v2                | [x]    |
| outline   | Slide Outline (opcional)         | [ ]    |

---

## Orden sugerido de ejecución

1. **Tarea 1** (rules) y **Tarea 2** (schemas) pueden hacerse en paralelo.
2. **Tarea 3** (engine) después de 1 y 2.
3. **Tarea 4** (prompt objects) después de 3.
4. **Tarea 5** (dedup) tras revisar 4.
5. **Tarea 6** (adapters) cuando 4 esté estable.
6. **Tarea 7** (versioning) cuando 6 funcione.
7. **Tarea 8** (outline) cuando se quiera añadir la mejora.

Actualiza este documento al completar cada tarea (marca `[x]` y opcionalmente añade fecha en "Notas / Completado").
