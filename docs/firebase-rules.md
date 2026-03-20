# Reglas Firebase (Firestore + Storage) — sync y compartir presentaciones

La app escribe en:

- **Firestore**: `users/{userId}/presentations/{presentationId}` y `users/{userId}/characters/{characterId}`
- **Storage**: `users/{userId}/presentations/...` y `users/{userId}/characters/{characterId}/ref.*`

Cada usuario es dueño de su prefijo `users/{userId}/`. Las presentaciones pueden incluir:

- **`sharedWith`**: UIDs de Firebase Auth con permiso de **lectura**.
- **`shareInviteEmails`**: correos en **minúsculas**; quien inicie sesión con ese correo (`request.auth.token.email` en las reglas) también tiene **lectura**.

Solo el dueño crea, actualiza y borra el documento y escribe en Storage.

## Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/presentations/{presId} {
      allow read: if request.auth != null && (
        request.auth.uid == userId ||
        (resource.data.sharedWith is list &&
          request.auth.uid in resource.data.sharedWith) ||
        (
          request.auth.token.email != null &&
          resource.data.shareInviteEmails is list &&
          request.auth.token.email.lower() in resource.data.shareInviteEmails
        )
      );
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/characters/{charId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Índices collection group:** “Compartidas conmigo” usa:

- `collectionGroup("presentations")` + `where("sharedWith", "array-contains", uid)`
- y, si el usuario tiene email en el token, `where("shareInviteEmails", "array-contains", emailEnMinúsculas)`

Pueden pedirse **dos** índices; Firebase suele mostrar el enlace en el error de la consola del navegador.

## Storage

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function presentationPath(ownerId, presId) {
      return /databases/(default)/documents/users/$(ownerId)/presentations/$(presId);
    }
    function presentationFirestoreData(ownerId, presId) {
      return firestore.get(presentationPath(ownerId, presId)).data;
    }
    function canReadPresentationFiles(ownerId, presId) {
      return request.auth != null && (
        request.auth.uid == ownerId ||
        (
          firestore.exists(presentationPath(ownerId, presId)) &&
          (
            (
              presentationFirestoreData(ownerId, presId).sharedWith is list &&
              request.auth.uid in presentationFirestoreData(ownerId, presId).sharedWith
            ) ||
            (
              request.auth.token.email != null &&
              presentationFirestoreData(ownerId, presId).shareInviteEmails is list &&
              request.auth.token.email.lower() in presentationFirestoreData(ownerId, presId).shareInviteEmails
            )
          )
        )
      );
    }
    match /users/{userId}/presentations/{presId}/{allPaths=**} {
      allow read: if canReadPresentationFiles(userId, presId);
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/characters/{charId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Publicar reglas

### Opción A — Consola Firebase

1. **Firestore** → Reglas → pega el bloque de *Firestore* de arriba → **Publicar**.
2. **Storage** → Reglas → pega el bloque de *Storage* de arriba → **Publicar**.

### Opción B — Firebase CLI (mismos archivos que el doc)

En la raíz del repo hay `firestore.rules`, `storage.rules` y `firebase.json` con este contenido.

1. Instala la CLI: [Firebase CLI](https://firebase.google.com/docs/cli).
2. `firebase login`
3. Copia `.firebaserc.example` a `.firebaserc` y sustituye `TU_PROJECT_ID_DE_FIREBASE` por el **Project ID** (el de `VITE_FIREBASE_PROJECT_ID`).
4. Despliega solo reglas:

```bash
firebase deploy --only firestore:rules,storage
```

### Comprobar el bucket de Storage (`.env`)

El valor de `VITE_FIREBASE_STORAGE_BUCKET` debe ser **exactamente** el del proyecto:

- Firebase Console → ⚙️ **Configuración del proyecto** → *Tus apps* → objeto `storageBucket` del `firebaseConfig`,  
  o Storage → archivo **rules** arriba a la derecha a veces muestra el bucket.

Suele ser `TU_PROJECT_ID.appspot.com` o un bucket con sufijo `.firebasestorage.app`. Si el `.env` apunta a otro proyecto, verás **permisos insuficientes** aunque las reglas estén bien.

## Si ves `FirebaseError: Missing or insufficient permissions`

1. **Firestore y Storage por separado** — Publica reglas en **ambas** pestañas.
2. **Mismo proyecto** que `VITE_FIREBASE_*`.
3. **Sesión** — El colaborador debe iniciar sesión con una cuenta cuyo **UID** esté en `sharedWith` o cuyo **correo** (minúsculas) esté en `shareInviteEmails`, coincidiendo con el email del token de Auth.

## Conflictos entre dispositivos

Campo **`revision`** en el documento; detección de conflicto al subir si no coincide con SQLite local.

## Compartir

- **Por correo:** el invitado debe usar ese mismo correo al iniciar sesión (p. ej. Google). La app guarda el email en minúsculas.
- **Por UID:** sigue disponible en el mismo modal (sección “Por UID”).
- Las copias descargadas desde “compartidas” no enlazan al `cloudId` del autor en SQLite.
