# Reglas Firebase (Firestore + Storage) — sync de presentaciones

La app escribe en:

- **Firestore**: `users/{userId}/presentations/{presentationId}`
- **Storage**: `users/{userId}/presentations/{presentationId}/...`

Solo el usuario autenticado debe acceder a su propio prefijo `users/{userId}/`.

## Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/presentations/{presId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/presentations/{presId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Publica estas reglas en Firebase Console (Firestore → Reglas, Storage → Reglas). Sin ellas, las operaciones de sincronización fallarán con permiso denegado.

## Si ves `FirebaseError: Missing or insufficient permissions`

1. **Firestore y Storage por separado** — Hace falta publicar reglas en **las dos** pestañas. Publicar solo Firestore deja fallidos los `uploadBytes` / `deleteObject` en Storage.
2. **Reglas por defecto** — En proyectos nuevos, Firestore y Storage suelen estar en modo restrictivo hasta que sustituyes las reglas por las de arriba.
3. **Mismo proyecto** — `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET` y el proyecto donde publicas reglas deben ser el mismo.
4. **Sesión** — Debes estar logueado (Google); el `uid` de Auth debe ser quien escribe en `users/{uid}/...`.

## Conflictos entre dispositivos

Cada documento de presentación incluye un campo entero **`revision`** que incrementa en cada subida exitosa (vía transacción Firestore). La app guarda en SQLite la última revisión conocida; si al subir la revisión en la nube no coincide, se detecta **conflicto** (otro dispositivo subió antes). El usuario puede elegir traer la versión remota o forzar la subida local.

Documentos creados antes de esta lógica pueden tener `revision` ausente (se trata como `0`).
