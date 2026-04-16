# Reglas Firebase (Firestore + Storage) — sync y compartir presentaciones

La app escribe en:

- **Firestore**: presentaciones y personajes bajo `users/{userId}/…`, **`users/{userId}/presentationShareGrants/{grantId}`** (un documento por invitado UID o correo), e **`sharedPresentationIndex/{email}/refs/...`** (solo para listar compartidas por correo con reglas seguras).
- **Storage**: `users/{userId}/presentations/...` y `users/{userId}/characters/{characterId}/ref.*`

**Gestión de compartidos:** la fuente operativa es `presentationShareGrants` (fácil de listar por `cloudId` como dueño). Los campos **`sharedWith`** y **`shareInviteEmails`** en el documento de la presentación se mantienen **en sincronía** para las reglas de Storage y compatibilidad. El listado “compartidas conmigo” usa `collectionGroup("presentationShareGrants")` con `where("recipientUid", "==", uid)` y, si hay email en sesión, también `where("recipientEmailNorm", "==", emailNorm)`; además **`sharedPresentationIndex/{email}/refs`** para el mismo listado por correo con reglas que comparan el segmento de ruta con el token.

Los índices de **collection group** para compartidas están en `firestore.indexes.json` (`fieldOverrides` en `presentationShareGrants/recipientUid`, `presentationShareGrants/recipientEmailNorm` y `presentations/sharedWith`). Despliega con `firebase deploy --only firestore:indexes` (o el enlace “Create index” de la consola del navegador).

## Firestore

El contenido canónico está en `firestore.rules`. Resumen de rutas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function userPresentation(ownerUid, cloudId) {
      return /databases/$(database)/documents/users/$(ownerUid)/presentations/$(cloudId);
    }

    function shareInviteEmailsForPresentation(ownerUid, cloudId) {
      return get(userPresentation(ownerUid, cloudId)).data.get('shareInviteEmails', []);
    }

    match /users/{ownerUid}/presentationShareGrants/{grantId} { /* read/create/update/delete */ }
    match /{path=**}/presentationShareGrants/{grantId} {
      allow list: if request.auth != null && (
        resource.data.recipientUid == request.auth.uid ||
        (request.auth.token.email != null &&
          resource.data.recipientEmailNorm is string &&
          request.auth.token.email.lower() == resource.data.recipientEmailNorm)
      );
    }

    match /sharedPresentationIndex/{emailKey}/refs/{refId} { /* … */ }

    match /{path=**}/presentations/{presId} {
      allow list: if request.auth != null
        && resource.data.sharedWith is list
        && request.auth.uid in resource.data.sharedWith;
      allow get: if /* dueño, sharedWith o shareInviteEmails */;
    }
    match /users/{userId}/presentations/{presId} { /* … */ 
      match /slides/{slideId} { /* hereda permisos del padre; write solo dueño */ }
    }
    match /users/{userId}/characters/{charId} { /* … */ }
  }
}
```

Copia el archivo **`firestore.rules`** completo en la consola o despliega con la CLI; el bloque anterior es solo guía.

**Collection group:** además de `presentationShareGrants` + `recipientUid`, se mantiene el listado **legacy** con `presentations` + `sharedWith` para datos antiguos sin grants.

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
