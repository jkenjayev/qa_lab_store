# QA Lab apps

Two web apps for new QA engineers, in Uzbek (Latin script), each with a backend API, data stored in Notion, seeded defects
and a Postman collection. They belong to the Notion workspace "QA Simulation Lab" (features, acceptance criteria, designs).

| App | Port | Folder | Postman collection |
|---|---|---|---|
| FreshCart (online grocery) | 3201 | `freshcart/` | `postman/FreshCart.postman_collection.json` |
| ClinicBook (clinic booking) | 3202 | `clinicbook/` | `postman/ClinicBook.postman_collection.json` |

## Run
1. Create an internal Notion integration and share the page "App Data (written by FreshCart and ClinicBook)" with it.
2. In each app folder copy `.env.example` to `.env.local` and fill `NOTION_TOKEN` (and, for ClinicBook, `TRAINING_PASSWORD`) yourself.
   Never commit or share these files.
3. In each app folder: `npm install`, `npm run notion:verify`, `npm run notion:seed`, `npm start`.
   Without a token the apps run in memory mode (no persistence) and print a warning.
4. Import the two collections and their environment files into Postman by hand
   (`ClinicBook` needs `staffPassword` filled in the environment).

## Facilitator notes
- `SEEDED_DEFECTS=off` starts the reference build with no defects (FreshCart: `npm run start:reference`).
- The defect answer key is the Notion database "Seeded Defects (Facilitator Answer Key)". Each app README maps defect ids to files.
- `GET /api/config` and the `Facilitator tools` folders in Postman reveal defect flags: keep them from trainees.
- Do not enter real personal data: records are stored in Notion.
- See `CONVENTIONS.md`, `NOTION_STORAGE.md` and `postman/README.md` for the design.

## Checks
`npm run check` in `freshcart/` (272 tests), `clinicbook/` (177 tests) and `postman/` (27 tests). Plain JavaScript, Node 26.
