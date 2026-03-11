# Prompts (Prompt Object Pattern)

Cada flujo tiene un archivo `*.prompt.ts` que exporta un objeto compatible con `PromptDefinition<TInput>` del Prompt Engine.

## Versionado

Para soportar varias versiones del mismo prompt:

- **Convención:** archivos con sufijo de versión, por ejemplo:
  - `generatePresentation.prompt.ts` → versión por defecto (actual).
  - `generatePresentation.v2.prompt.ts` → alternativa; exportar `generatePresentationPromptV2`.

- **Uso:** el use case o el adaptador elige qué definición usar. Por defecto se usa la versión actual (import directo de `generatePresentation.prompt.ts`). Para probar v2, cambiar el import a `generatePresentation.v2.prompt.ts` y usar `buildPrompt(generatePresentationPromptV2, input)`.

- **Ejemplo:** crear `generatePresentation.v2.prompt.ts` con el mismo tipo `GeneratePresentationInput` y exportar `generatePresentationPromptV2`. En el adaptador, se puede usar una variable de entorno o config para elegir entre `generatePresentationPrompt` y `generatePresentationPromptV2`.

No es obligatorio tener v2 desde el primer refactor; la estructura permite añadirlo cuando se quiera iterar.
