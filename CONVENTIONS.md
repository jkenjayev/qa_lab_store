# QA Lab apps: build conventions

Two runnable web apps for the Notion "QA Simulation Lab": `freshcart/` and `clinicbook/`.
Each app is built to match the acceptance criteria and designs in Notion, **except** for the
71 seeded defects, which must behave exactly as the "Actual" column of the Notion
"Seeded Defects (Facilitator Answer Key)" database and the "Recorded walkthrough" tables of the
Notion "Implementations" pages describe. Features that are Active or Blocked are only partly
built, exactly as their implementation pages say (what is under "Not built yet" is simply absent).

## Stack
- Node 26, ES modules (`"type": "module"`), plain JavaScript, **one runtime dependency: `express`**.
- Browser code: plain ES modules and vanilla JS, no framework, no build step, served from `public/`.
- Tests: Node built-in runner (`node --test`), built-in `fetch` against a server started on an
  ephemeral port. No test dependencies.
- Quality gate: `npm run check` = `node --test --experimental-test-coverage --test-coverage-lines=80`.
  It must pass before anything is committed. Do not commit; the lead commits.

## Defect flags (the core mechanism)
- `src/defects.js` exports the list of seeded defect ids (constants such as `FC_PRICE_ONE_DECIMAL`) and
  `createDefects(mode)`. Mode `on` (default) enables all; mode `off` enables none (reference-correct build).
- Env `SEEDED_DEFECTS=off` starts the correct build. The server exposes `GET /api/config` with
  `{ defects: {ID: boolean}, now: ISO string }` so browser code can apply UI-side defects too.
- Every defect is one small, clearly commented `if (defects.X)` branch next to the correct code path.
  The comment names the defect id and the Notion defect title. No other place knows about defects.
- One id per Notion defect row. FreshCart: 35 ids. ClinicBook: 36 ids. Keep a table in the app README
  mapping id -> Notion defect title -> file.

## Architecture (SOLID)
- `src/domain/*`: pure functions and classes, no I/O, receive `{ defects, clock }` by injection.
- `src/data/*`: seed data and in-memory repositories behind small interfaces.
- `src/services/*`: business rules, depend on repository interfaces and the clock.
- `src/routes/*`: thin Express routers, map service errors to JSON `{ error }` with status codes.
- `src/app.js` builds the Express app from injected services (testable); `server.js` only starts it.
- Browser: `public/index.html`, `public/css/app.css`, `public/js/*.js` small modules; pure logic
  (formatting, validation, sorting) lives in modules that tests import directly from node.
- Fixed clock: default `now` is the walkthrough clock from the Notion implementation pages
  (FreshCart 2026-11-19T15:00:00, ClinicBook 2026-11-19T13:10:00). `FIXED_NOW=off` uses the real time.

## Secrets and accounts
- No credentials in code. Staff accounts (ClinicBook) use emails from the Notion pages; the shared
  password is read from env `TRAINING_PASSWORD`; the server refuses to start with a clear message if
  it is missing. Tests set their own throwaway value inside the test file.

## Tests
- Every module is tested. For each seeded defect: one test with defects `on` asserting the seeded
  (wrong) behavior, and one with defects `off` asserting the acceptance criterion. Name tests with the
  defect id.
- Walkthrough tables in the Notion implementation pages are the oracle for the seeded behavior; the
  acceptance criteria and designs are the oracle for the correct behavior.

## Ports
FreshCart 3201, ClinicBook 3202 (env `PORT` overrides).
