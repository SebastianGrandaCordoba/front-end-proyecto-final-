# Habilitar el inicio de sesión docente

El frontend usa Firebase Authentication con Google. Los valores `VITE_FIREBASE_*` son la configuración web pública de Firebase; no pegues aquí una clave Gemini ni credenciales privadas.

## Firebase

1. Crea un proyecto en Firebase y agrega una aplicación web.
2. En **Authentication → Sign-in method**, habilita **Google**.
3. En **Authentication → Settings → Authorized domains**, agrega `front-end-proyecto-final.onrender.com` y `localhost` para desarrollo.
4. Copia desde la configuración de la aplicación web `apiKey`, `authDomain`, `projectId` y `appId`.

## Render

En el Static Site del frontend agrega las cuatro variables como variables de entorno, con prefijo `VITE_`:

| Key | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` de la app web de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` de Firebase |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` de Firebase |
| `VITE_FIREBASE_APP_ID` | `appId` de la app web |

En el Web Service del backend agrega:

| Key | Value |
|---|---|
| `AUTH_REQUIRED` | `true` |
| `FIREBASE_PROJECT_ID` | El mismo `projectId` |
| `FAIRTEAM_ALLOWED_TEACHER_EMAILS` | Correos Google docentes autorizados, separados por coma |

Configura estas variables en ambos servicios antes de habilitar el inicio. Render vuelve a compilar el frontend al cambiar variables `VITE_*`. En el backend, activar `AUTH_REQUIRED=true` sin `FIREBASE_PROJECT_ID` o sin una lista de docentes impedirá el acceso a las APIs. Usa solo correos institucionales cuyo propietario haya aprobado el acceso.

El navegador envía el ID token de Firebase en `Authorization: Bearer …`. Java comprueba firma, emisor, audiencia del proyecto, vencimiento, correo verificado y la lista permitida. El endpoint `GET /api/auth/me` permite al frontend confirmar que el backend reconoce la sesión.

## Desarrollo local

Copia `.env.example` a `.env.local`, llena la configuración pública de Firebase, habilita `localhost` como dominio autorizado y usa el mismo proyecto/configuración en el backend. Sin Firebase, el frontend local abre vista previa para facilitar desarrollo; en producción, la aplicación no abre datos sin configuración de Firebase.
