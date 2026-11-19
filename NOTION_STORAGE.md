# Notion storage and Postman: shared spec for both apps

Data of both apps is stored in Notion. The Notion side already exists: page
"App Data (written by FreshCart and ClinicBook)" (id `41d2b9c9-59ab-81b3-ba6f-eda97451cd66`, not a secret)
holding 10 databases, all with the same three columns: `Key` (title), `Summary` (rich text), `Data` (rich text).

| App | Databases (title) |
|---|---|
| FreshCart | `FC Products`, `FC Promo Codes`, `FC Carts`, `FC Orders` |
| ClinicBook | `CB Doctors`, `CB Schedules`, `CB Appointments`, `CB Patients`, `CB Staff`, `CB Emails` |

## Runtime
- Env: `NOTION_TOKEN` (secret, set by the user in `.env.local`; never print, log, commit or ask for it),
  `NOTION_PARENT_PAGE_ID` (default the id above), `STORAGE=notion|memory`.
  Default: `notion` when `NOTION_TOKEN` is set, else `memory` with one clear warning line at startup.
- Load `.env.local` with `process.loadEnvFile` (Node 26), no extra dependency except `@notionhq/client` (v5, API
  version 2025-09-03: databases have data sources; query with `dataSources.query`, create pages with parent
  `{ type: 'data_source_id', data_source_id }`). Read the installed package's type definitions to use the exact calls.
- Discover each database by title among the child databases of the parent page; resolve its data source id once
  at startup. A missing database gives a clear error naming the title and the page.
- Row model: `Key` = record id, `Summary` = one readable line, `Data` = the whole record as JSON, split into chunks of at most
  2000 characters (one rich text item per chunk, at most 100 items). `Data` is the single source of truth when reading.
- Pattern: **write-through cache**. At startup load every row of the app's databases into the existing in-memory
  repositories (their synchronous interfaces stay). Every mutation updates memory first, then is queued for Notion.
- Write queue: strictly serial, at least 350 ms between calls (Notion allows about 3 requests per second), retry with
  backoff on 429 and 5xx (up to 5 tries, honour `Retry-After`), a failed write is recorded and never crashes the server.
  `GET /api/dev/storage` returns `{ mode, pending, lastError, lastSyncAt }`.
- Security: never write sessions, login attempts or the shared staff password (hash) to Notion. Staff rows hold
  email, name and role only; their password hash is computed at boot from `TRAINING_PASSWORD`. Patient password hashes
  (salted scrypt, already used) are stored.
- Reset (`POST /api/dev/reset` where it exists): memory is restored at once; a queued sync makes Notion match the seed
  (upsert all seed rows, archive rows that are not in the seed).
- Scripts in each app: `npm run notion:seed` (idempotent upsert of the seed data into the databases),
  `npm run notion:verify` (creates, reads and archives one temporary row in the first database and prints OK or the error;
  this is for the user to run with their token).

## Tests
- No network. A fake gateway (in-memory) implements the same small `NotionGateway` interface the real adapter does.
  Test: chunking and unchunking of `Data`, load, upsert, archive, queue ordering and retry, write-through for each
  repository, seed idempotence, reset sync, `STORAGE=memory` fallback, startup error messages.
- Existing tests stay green (they use the in-memory mode). Coverage stays above 80% lines.
- `.env.example` lists names only. `.env.local` is gitignored.

## Postman (one collection per app, in `qa-lab-apps/postman/`)
- Files: `<App>.postman_collection.json` (schema v2.1.0) and `<App>.postman_environment.json`. The user imports them by hand.
- Variables: `baseUrl` (FreshCart `http://localhost:3201`, ClinicBook `http://localhost:3202`). ClinicBook also
  `staffPassword`, left empty with type `secret` for the user to fill. Never put a password in the files.
- Structure: top-level description (Uzbek, Latin script) explaining the API, cookies, error format and how to use the
  collection; one folder per Notion feature (same naming as the Notion features, e.g. `F1.1 Product listing page`),
  inside it the requests that exercise that feature, including negative cases (invalid input, missing auth).
- Each request: clear name (`GET /api/products - list products`), description in Uzbek with the acceptance criteria that apply,
  realistic example query/body, and a basic test script: status code, `Content-Type` JSON, and the presence and type of key
  fields. Do NOT assert acceptance-criteria behavior (that is the trainee's exercise). Where a response id is needed later
  (cart id, booking reference), save it into a collection variable in the test script.
- Order requests inside a folder so the folder can run top to bottom. Login requests rely on Postman's cookie jar.
- Also write `qa-lab-apps/postman/tools/run-collection.mjs` (no dependencies): a tiny executor that loads a collection,
  resolves `{{variables}}`, keeps cookies, runs every request in order against a running server and checks the status code that the
  request's test script expects (parse `pm.response.to.have.status(N)`). It exists to prove every request works. Add tests for its parsing logic.
