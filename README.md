# FairTeam · Front-end

Aplicación web para docentes: tablero del aula, directorio de estudiantes, importación de notas, propuestas de equipos equilibrados y generación de talleres con IA.

## Stack

- React + TypeScript + Vite
- CSS responsive propio
- Lucide para iconografía
- API Spring Boot existente como único backend público

## Ejecutar en local

Requiere Node.js 20.19 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

El front usa por defecto el backend desplegado en `https://backend-proyect-junz.onrender.com`. Para otro ambiente, copia `.env.example` a `.env.local` y cambia `VITE_API_BASE_URL`.

## Publicar en Render

El repositorio incluye `render.yaml`. Crea un **Static Site** desde este repositorio. Render instalará dependencias, ejecutará `pnpm build` y publicará `dist`. Configura `VITE_API_BASE_URL` con la URL del backend.

## Funciones

- Resumen de estudiantes, notas, niveles y equipos, calculado desde los datos de la API.
- Crear, editar y eliminar estudiantes.
- Importar CSV de notas por `POST /api/grades/import`.
- Proponer grupos distribuyendo estudiantes por promedio/nivel; consultar el análisis de cada grupo y guardar sus equipos e integrantes en un proyecto.
- Crear proyectos para asociar equipos.
- Subir PDF, DOCX o TXT para generar un taller mediante `POST /api/ai/workshops/generate`.
- Revisar objetivos, actividades, preguntas, respuestas y referencias; copiar o imprimir el taller.
- Guardar las últimas propuestas de talleres en el navegador actual.

## Notas de integración conocidas

- El importador CSV del backend exige las columnas `id,studentId,subjectId,grade,period`; las relaciones de estudiante y materia deben existir en la base.
- Las notas se usan para calcular niveles en pantalla: menor que 3.0 = refuerzo, de 3.0 a menos de 4.0 = en proceso, y 4.0 o más = avanzado. Si un estudiante no tiene notas, el front usa `academicLevel`.
- El backend analiza cada equipo y persiste el proyecto, el equipo y las relaciones de integrantes. La propuesta inicial se calcula en el front a partir de los promedios.
- Los talleres generados todavía no tienen persistencia en el backend; este front guarda una biblioteca local por navegador.
- La API actual no ofrece autenticación. Usa datos de demostración o aprobados para el proyecto académico, no información real sensible.

## Comprobación de build

```bash
pnpm build
```
