# FairTeam · Frontend

Aplicación docente para revisar notas y progreso, identificar estudiantes que podrían necesitar apoyo y crear propuestas de refuerzo a partir del material de clase.

## Stack

- React, TypeScript y Vite.
- API REST Spring Boot como punto de entrada a los datos.
- Servicio Gemini separado para generar talleres bajo solicitud.

## Desarrollo local

Requiere Node.js 20.19 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

Usa el backend de Render por defecto. Para cambiarlo, crea `.env.local` con:

```env
VITE_API_BASE_URL=http://localhost:8080
```

En Render crea un Static Site de este repositorio con build `pnpm install --frozen-lockfile && pnpm build`, directorio publicado `dist` y `VITE_API_BASE_URL` apuntando al backend.

## Flujos principales

- Registro abierto e inicio de sesión con cuenta FairTeam; los datos académicos se aíslan por cuenta en PostgreSQL.
- Panel de curso con conteos y alertas rápidas calculadas desde las notas existentes.
- Listado de estudiantes, filtros, edición e importación de notas CSV.
- Alertas con su promedio y una explicación del criterio usado.
- Generación explícita de talleres desde PDF, DOCX o TXT usando el backend y Gemini.
- Revisión, copia e impresión de talleres; la biblioteca se guarda localmente y se separa por cuenta.

El análisis de alertas no espera a Gemini. La IA solo se consulta al pedir un taller; si la generación se demora, el backend devuelve un error controlado con tiempo límite para permitir reintentar.

## Contrato de datos

El CSV de notas requiere `id,studentId,subjectId,grade,period`; estudiante y asignatura deben existir. Los niveles actuales se calculan como promedio menor de 3.0 (refuerzo), de 3.0 a menos de 4.0 (seguimiento) y 4.0 o más (progreso adecuado). Sin notas, la interfaz marca que faltan datos en vez de inferir un riesgo basado en un promedio inventado.

La API separa los datos por cuenta mediante Row Level Security de PostgreSQL. Los datos que ya existían se asignan a la primera cuenta que se registre después de instalar las migraciones.
