# Postman collections of the QA Simulation Lab

| File | What it is |
|---|---|
| `ClinicBook.postman_collection.json` | ClinicBook API, Postman collection v2.1.0 (Uzbek texts) |
| `ClinicBook.postman_environment.json` | Environment `ClinicBook local`: `baseUrl`, `staffPassword` (secret, empty) |
| `tools/collection-kit.mjs` | Helpers that write collections as data (shared by every app) |
| `tools/build-clinicbook.mjs` | Generates the two ClinicBook files: `npm run build:clinicbook` |
| `tools/run-collection.mjs` | Small runner that proves every request of a collection works |

## Import (manual)
Postman, **Import**, choose `ClinicBook.postman_collection.json` and `ClinicBook.postman_environment.json`.
Select the environment `ClinicBook local`, type the shared password into `staffPassword` (the value the
facilitator set as `TRAINING_PASSWORD`), start ClinicBook, then run a folder with **Run folder**.

## What the checks are
Every request has basic checks only: status code, JSON type, key fields. Whether the behavior matches the
acceptance criteria is the trainee's work: read the criteria in the request description, send, compare,
add your own `pm.test` lines, and file a Bug under the Feature when they differ.
Requests whose result depends on a business rule accept every plausible status code on purpose.

## Prove a collection works
```bash
cd qa-lab-apps/clinicbook && TRAINING_PASSWORD='your-value' STORAGE=memory PORT=3232 node server.js
cd qa-lab-apps/postman && node tools/run-collection.mjs ClinicBook.postman_collection.json \
  --base-url http://localhost:3232 --env ClinicBook.postman_environment.json \
  --var staffPassword='your-value' --before "POST /api/dev/reset"
```
Always pass `--base-url`: without it the runner uses the address inside the collection (`http://localhost:3202`).
`--before` runs a request before the collection (here: restore the seed data). The runner understands only the
one-line checks written by `collection-kit.mjs`; it is not Postman.

## Tests
`npm test` (or `npm run check` with coverage) in this folder. No dependencies.
