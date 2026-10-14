# Timelogg

A responsive, private time tracker inspired by the desktop and mobile references in `examples/`. Norwegian is the default; change between Norwegian and English on the login screen or under Settings. The preference is remembered in this browser.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the displayed URL and choose **Utforsk en demo / Explore a demo**. Demo data is stored separately in this browser and is never uploaded into an account. The production app does not seed accounts with example data.

```sh
npm test
npm run test:ui
npm run build
```

The API tests run against an in-memory Blobs store and, for the disabled SQL storage, an embedded PostgreSQL engine. Browser tests use installed Microsoft Edge on Windows; on other platforms install Playwright Chromium with `npx playwright install chromium`. They cover responsive layout, entry editing, overlap validation, language switching, completion/reopening, persistence and Excel export. `dist/` is the publish directory; reference images, backup HTML and server source are not published.

## Enable on Netlify

1. Connect this repository to your Netlify project. The included `netlify.toml` sets `npm run build` and `dist` as the build command and publish directory.
2. In **Project configuration → Identity**, enable Identity. Choose open registration, or invite-only if this is just for you. Keep email confirmation enabled. The app supports email/password login, signup, email confirmation, password reset and invitations.
3. Netlify Blobs needs no setup: the `timelogg-data` store is created on first write and Functions get access automatically.
4. Deploy a preview. No storage secret belongs in browser code or a `VITE_` environment variable.
5. Verify signup, confirmation email, login, logout and password reset on the deployed HTTPS URL. Netlify Identity cannot be fully tested with the local Vite server or `netlify dev`.
6. With two different accounts, create entries and verify each account only sees its own data. Check saving, reload, another device, and an intentional conflicting edit before publishing to production.

No Netlify project has been provisioned or deployed by this repository change. Live authentication and cloud integration require the setup above and a deployed smoke test.

Official references:
- [Netlify Identity setup](https://www.netlify.com/knowledge-base/how-to-add-user-login-to-a-netlify-site-with-identity/)
- [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

## Data and ownership

Data is stored in Netlify Blobs (store `timelogg-data`), by `netlify/functions/lib/blob-repository.mjs`:

- `users/<identity id>/months/YYYY-MM`: `{days: {date: {target, note, status, revision, entries}}}` for one month.
- `users/<identity id>/projects`: list of `{code, name}`. Historical entries retain their WBS text even without a project record.

Monthly blobs keep reads cheap (one blob per month instead of per day), which also keeps a future cross-user report feasible. Every write is an ETag compare-and-swap (`onlyIfMatch`/`onlyIfNew`), retried briefly if another save to the same month landed first.

Every API request verifies the Identity session. The owner is derived exclusively from the server-verified user; all reads, deletes, inserts and updates are scoped to that owner. Owner-scoped storage keys, same-origin mutation checks and private/no-store responses protect the API. The account header is an additional stale-tab check, never the source of authorization. Storage access is server-only; do not expose this data through a separate public data API without adding its own access controls. Site administrators retain infrastructure access; private accounts means other app users cannot see your records.

Day updates are atomic per month blob. Revision conflicts return HTTP 409 rather than overwrite another device's changes. The UI preserves the unsaved draft in memory, displays the error, and lets you export it before reloading. Cloud drafts are not cached in shared browser storage. Leave-page protection warns while changes are unsaved. A network failure is never labelled as a successful cloud save.

Completing a day locks editing in the interface; it can be reopened. This is a personal workflow, not manager approval or an immutable audit log. Time entries cannot overlap or cross midnight; split overnight work into separate days. Additions are tracked separately and excluded from the main work-hours total.

## Existing data

Existing blob and browser data are not deleted or silently assigned to a new account. After signing in, go to **Reports**:

- **Import previous cloud data** reads only that Identity user's old `timelogg/user_<id>` blob through the now read-only `/api/blobs` endpoint.
- **Import older browser data** reads the old `timelogg_v1` browser key only after an explicit action and confirmation. Use this only when that browser data belongs to you.
- **Import JSON** accepts previous Timelogg exports and the current day format. Existing saved days are preserved, not overwritten. Importing empty/missing dates is repeatable; a partial cloud failure can be retried with Save.
- Legacy decimal-hour entries remain manual hours; the app does not invent clock times.
- JSON exports contain projects as a backup; the day importer restores entries and their WBS codes. Standalone project names can be recreated under Projects.

JSON exports include all days and additions. Excel export produces a real `.xlsx` workbook with numeric hours; the Excel library is loaded only when exporting. Exports are explicit downloads rather than recurring background downloads.

## Switching back to Netlify Database

The PostgreSQL storage is disabled but kept, and still covered by `npm test`:

- `netlify/functions/lib/sql-repository.mjs`: same interface as the Blobs repository (`readData`, `writeDay`, `saveProject`).
- `disabled/database/migrations/`: the schema (`work_days`, `time_entries`, `projects`). It lives outside `netlify/` so Netlify does not try to apply it.

To re-enable: create the Netlify Database under **Data & Storage → Database**, move `disabled/database` back to `netlify/database`, and in `netlify/functions/data.mjs` use `createSqlRepository()` as the default repository. Existing Blobs data would need a one-off copy into the tables.
