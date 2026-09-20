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

The SQL tests use an embedded PostgreSQL engine. Browser tests use installed Microsoft Edge on Windows; on other platforms install Playwright Chromium with `npx playwright install chromium`. They cover responsive layout, entry editing, overlap validation, language switching, completion/reopening, persistence and Excel export. `dist/` is the publish directory; reference images, backup HTML and server source are not published.

## Enable on Netlify

1. Connect this repository to your Netlify project. The included `netlify.toml` sets `npm run build` and `dist` as the build command and publish directory.
2. In **Project configuration → Identity**, enable Identity. Choose open registration, or invite-only if this is just for you. Keep email confirmation enabled. The app supports email/password login, signup, email confirmation, password reset and invitations.
3. In **Data & Storage → Database**, create the project's Netlify Database. This is managed PostgreSQL. Check the plan's usage and pricing in your Netlify account before provisioning.
4. Deploy a preview. Netlify applies `netlify/database/migrations/202609200001_timelogg.sql` as part of publishing and supplies the database connection to Functions. No database secret belongs in browser code or a `VITE_` environment variable.
5. Verify signup, confirmation email, login, logout and password reset on the deployed HTTPS URL. Netlify Identity cannot be fully tested with the local Vite server or `netlify dev`.
6. With two different accounts, create entries and verify each account only sees its own data. Check saving, reload, another device, and an intentional conflicting edit before publishing to production.

No Netlify project has been provisioned or deployed by this repository change. Live authentication and cloud integration require the setup above and a deployed smoke test.

Official references:
- [Netlify Identity setup](https://www.netlify.com/knowledge-base/how-to-add-user-login-to-a-netlify-site-with-identity/)
- [Netlify Database setup](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/)
- [Automatic SQL migrations](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)

## Data and ownership

- `work_days`: owner, date, target, note, completion status and revision.
- `time_entries`: relational child rows with kind, time interval, hours, comment and WBS code. Composite foreign keys keep entries attached to the same owner's day.
- `projects`: owner, WBS code and name. Historical entries retain their WBS text even without a project record.

Every API request verifies the Identity session. The owner is derived exclusively from the server-verified user; all reads, deletes, inserts and updates are scoped to that owner. Parameterized queries, same-origin mutation checks and private/no-store responses protect the API. The account header is an additional stale-tab check, never the source of authorization. Database access is server-only; do not expose these tables through a separate public data API without adding its own access controls. Site/database administrators retain infrastructure access; private accounts means other app users cannot see your records.

Day updates are transactional. Revision conflicts return HTTP 409 rather than overwrite another device's changes. The UI preserves the unsaved draft in memory, displays the error, and lets you export it before reloading. Cloud drafts are not cached in shared browser storage. Leave-page protection warns while changes are unsaved. A network failure is never labelled as a successful cloud save.

Completing a day locks editing in the interface; it can be reopened. This is a personal workflow, not manager approval or an immutable audit log. Time entries cannot overlap or cross midnight; split overnight work into separate days. Additions are tracked separately and excluded from the main work-hours total.

## Existing data

Existing blob and browser data are not deleted or silently assigned to a new account. After signing in, go to **Reports**:

- **Import previous cloud data** reads only that Identity user's old `timelogg/user_<id>` blob through the now read-only `/api/blobs` endpoint.
- **Import older browser data** reads the old `timelogg_v1` browser key only after an explicit action and confirmation. Use this only when that browser data belongs to you.
- **Import JSON** accepts previous Timelogg exports and the current day format. Existing saved days are preserved, not overwritten. Importing empty/missing dates is repeatable; a partial cloud failure can be retried with Save.
- Legacy decimal-hour entries remain manual hours; the app does not invent clock times.
- JSON exports contain projects as a backup; the day importer restores entries and their WBS codes. Standalone project names can be recreated under Projects.

JSON exports include all days and additions. Excel export produces a real `.xlsx` workbook with numeric hours; the Excel library is loaded only when exporting. Exports are explicit downloads rather than recurring background downloads.
