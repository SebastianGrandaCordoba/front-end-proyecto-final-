# FairTeam · Frontend

Teacher application to review grades and progress, identify students who may need support and create reinforcement proposals from class material.

## Stack

- React, TypeScript and Vite.
- Spring Boot REST API as the entry point to the data.
- Separate Gemini service to generate workshops on request.

## Organization and patterns

- `src/api.ts`: HTTP adapter/gateway (token, translated errors, timeout and `warmUpBackend`, which wakes the Render backend while the teacher sees the home page).
- `src/lib/`: pure logic without React. `domain.ts` computes levels, averages and weakest topics; `assistant.ts` decides what to recommend to the teacher (course → list → grades → material → reinforcement) using real data only; `files.ts` generates downloads and printing.
- `src/app/`: session state (`useWorkspace`, with a per-course cache and parallel loads), hash routing (`#/students`, `#/workshops`…; the old Spanish routes still work) and reusable actions (import Excel, upload material).
- `src/pages/`: one screen per file, loaded on demand (`React.lazy`).
- `src/components/ui.tsx`: accessible modal, confirmations, notices and shared controls.
- `src/pages/<screen>/`: subcomponents of each screen (for example `followup/Simulator.tsx`, `workshops/WorkshopView.tsx`).
- `src/components/`: shared pieces: `Buho`, `Sidebar`, `Owl`, `Histogram`, `Heatmap`, `ErrorBoundary`, `Welcome`.
- `src/styles.css`: a single stylesheet with color tokens, Instrument Sans/Serif typography and a responsive layout.

Code, identifiers, comments and documentation are in English; everything the user sees is in Spanish. "Búho" is the assistant's brand name and stays as is.

## The Búho assistant

The computation lives in the backend (the Spring Boot `insights` module, hexagonal architecture). The frontend only shows the results, listens and speaks:

- **Búho by voice or text** (`Ctrl + K`): the question is sent to `POST /api/courses/{id}/assistant`, where a chain of handlers (Chain of Responsibility) interprets it with the course data. `src/lib/speech.ts` uses the browser's Web Speech API to dictate and read the answer; `src/lib/buho.ts` translates the actions the server returns.
- **Analysis, trends, risk and the day's summary**: `GET /api/courses/{id}/insights`, adapted in `src/lib/insights.ts`.
- **Grade simulator**: the weights of each period are saved with `PUT /api/courses/{id}/grading-scheme` and the backend recalculates what grade each student needs.
- **Feedback messages**: `GET /api/courses/{id}/students/{sid}/feedback?tone=`.
- **Course report as PDF**: printed from the browser with the analysis data (`src/lib/report.ts`).

- **Administration** (`#/admin`, `src/pages/AdminPage.tsx`): visible only to accounts with the `ADMIN` role. It lists every account with usage totals, lets an administrator activate/deactivate accounts, change roles and issue a temporary password, and shows an audit log and the system status. It never shows students' data.

## Experience

- **Own illustrations**: the FairTeam owl is drawn in SVG (`src/components/Owl.tsx`) in four poses (waving, reading, thinking, celebrating) and appears in empty states, while a workshop is generated, in the welcome and in Búho.
- **Dark mode**: light, dark or following the system (`src/lib/theme.ts`), chosen in Settings.
- **Four-step welcome** the first time each teacher signs in.
- **Keyboard shortcuts**: `Ctrl + K` opens Búho, `?` shows help and `g` + letter jumps between screens.
- **Visualizations**: distribution of averages, student × topic heat map, trends per period and grade simulator.

## Local development

Requires Node.js 20.19 or later and pnpm.

```bash
pnpm install
pnpm dev
```

It uses the Render backend by default. To change it, create `.env.local` with:

```env
VITE_API_BASE_URL=http://localhost:8080
```

On Render, create a Static Site from this repository with build `pnpm install --frozen-lockfile && pnpm build`, published directory `dist` and `VITE_API_BASE_URL` pointing to the backend.

## Tests

```bash
pnpm test     # Vitest: domain logic, backend adapters, CSV, router and theme
pnpm build    # type check and build
```

GitHub Actions runs both on every push (`.github/workflows/ci.yml`).

## Main flows

- Open registration and sign-in with a FairTeam account; academic data is isolated per account in PostgreSQL.
- Course organization per teacher (for example, Fourth semester A/B), with a course selector and a separate panel.
- Per-course listing, create/edit, filters and independent import of students and CSV grades.
- Alerts with their average and an explanation of the criterion used.
- Explicit workshop generation from PDF, DOCX or TXT using the backend and Gemini.
- Review, copy and printing of workshops; the library is stored locally and separated per account.

The alerts analysis does not wait for Gemini. The AI is only queried when a workshop is requested; if generation is slow, the backend returns a controlled error with a time limit so the teacher can retry.

## Data contract

The CSV list uses `name,email,academicLevel` (email and level optional). Grades accept `studentName` or `studentEmail`, `subject`, `grade`, `period`; subjects are created on import. The current levels are computed as an average below 3.0 (support), from 3.0 to below 4.0 (watch) and 4.0 or more (good progress). Without grades, the interface says data is missing instead of inferring a risk from an invented average.

The API separates data per account through PostgreSQL Row Level Security. Loaded grades and students are filtered by course; the migrations keep existing data in an initial course per teacher.
