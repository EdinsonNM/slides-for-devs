# Modelos 3D (`public/models`)

Coloca aquí archivos **`.glb`** y decláralos en `catalog.json` para que aparezcan en el panel **Escena 3D** del editor.

## `catalog.json`

Formato:

```json
{
  "version": 1,
  "entries": [
    { "id": "robot", "label": "Robot demo", "url": "/models/robot.glb" }
  ]
}
```

- `url`: ruta pública (desde la raíz del sitio), p. ej. `/models/mi-archivo.glb`.
- Tras añadir archivos, reinicia Vite si no ves cambios.

Si `entries` está vacío, el panel solo ofrece **formas básicas**, **Recursos** y **cargar tu propio .glb**.
