# DocGen Frontend

React + Vite single-page application for generating customer-ready specification documents from Azure DevOps ALM data.

## Overview

DocGen connects to an Azure DevOps organization with a Personal Access Token (PAT), lets you compose document requests from live project data, and sends them to the DocGen backend for Word/PDF generation. It ships with ready-made experiences for SRS, STD, STR, SVD and other engineering documents, plus tools for maintaining the document templates stored in object storage.

## Feature Highlights

- Azure DevOps aware sign-in: validates an organization URL + PAT, keeps credentials in secure cookies, and auto-recovers when they expire.
- Document workspace: switch between document types, configure content controls (queries, test plans, trace tables, change logs, STR/SRS layouts), and send the request with one click.
- Template automation: pull templates from shared and project-scoped MinIO buckets, auto-pick sensible defaults, upload/download custom templates, and guard shared templates from accidental deletion.
- Favorites & formatting: store reusable document presets (personal or shared), tweak whitespace trimming, and enable Void List post-processing for Excel exports.
- Document library: browse project outputs with filtering, highlighting, and quick download links (remember to archive locally—retention is 2 days).
- Developer toolkit: craft new content controls, toggle debug-only document types, and inspect request payloads without touching backend code.
- Modern UI stack: responsive layout built with Material UI + Ant Design on a unified theme, toast notifications, and MobX for observable state.

## Architecture at a Glance

- `src/store/DataStore.jsx` – MobX store orchestrating Azure DevOps calls, MinIO interactions, favorites, templates, and document generation requests.
- `src/store/actions/AzureDevopsRestApi.jsx` – axios wrapper for the DocGen backend's Azure DevOps proxy endpoints (projects, queries, tests, git, pipelines, releases).
- `src/store/data/docManagerApi.jsx` – object storage + document generator helpers (MinIO buckets, favorites CRUD, `sendDocumentToGenerator`).
- `src/components/` – feature-focused React components (document forms, dialogs, selectors, tabs, layout, guides).
- `src/theme/AppThemeProvider.jsx` – shared theme tokens bridging Material UI and Ant Design.
- `src/utils/` – logging (`logger.jsx`), client storage helpers, query validation utilities, smart autocomplete helpers.

_A high-level layout:_

```
src/
  App.jsx
  main.jsx
  components/
    common/      # selectors, guides, shared widgets
    dialogs/     # favorites, template picker, formatting settings
    forms/       # document, templates, developer, documents tabs
    layout/      # action bar, app shell
    tabs/        # top-level tab navigation
  store/
    actions/     # Azure DevOps REST client
    data/        # Doc manager API helpers & options
    DataStore.jsx
    constants.jsx
  theme/
    AppThemeProvider.jsx
    tokens.js
  utils/
    logger.jsx
    storage.jsx
```

## Prerequisites

- **Node.js** 18+ (Vite 7 and React 19 require modern Node). LTS 20 is recommended.
- **npm** (ships with Node) or compatible package manager.
- **DocGen backend** reachable from the browser. By default the UI calls `http://localhost:30001` or `http://<host>:30001` in non-local deployments.
- **Object storage** (MinIO/S3 compatible) buckets expected by the backend: `document-forms`, `templates`, and project buckets for generated artifacts.
- **Azure DevOps PAT** with scopes that cover Projects & Teams, Work Items (read), Test Management, Build (read), Release (read), Git (read). PATs are stored client-side in cookies—treat this environment as trusted.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the dev server (defaults to `http://localhost:5173`):
   ```bash
   npm run dev
   ```
3. Start or connect to the DocGen backend (`npm run dev` only serves the SPA).
4. Open the app in a browser, enter your Azure DevOps organization URL (including protocol) and PAT, and complete the login.

### Available Scripts

- `npm run dev` – Vite dev server with hot module replacement.
- `npm run build` – production bundle under `dist/`.
- `npm run preview` – serve the production build locally.
- `npm run lint` – run ESLint over the project.

## Backend Configuration

- `src/store/constants.jsx` defines `jsonDocument_url`. In development it points to `http://localhost:30001`; in production it resolves to `http://<current-host>:30001`. Adjust this file if your backend lives elsewhere.
- Container deployments can inject the backend URL by exporting `BACKEND-URL-PLACEHOLDER-ContentControl` before running `src/deployment/env-uri-init.sh`; the script rewrites static assets and starts nginx.
- All Azure DevOps calls are proxied by the backend. Ensure custom headers `X-Ado-Org-Url` and `X-Ado-PAT` are forwarded as expected.

## Using the App

- **Sign in** – Provide the organization URL and PAT. Successful validation persists them in cookies and records the last org URL in `localStorage` for autofill.
- **Select a project** – Use the project dropdown in the action bar. This drives template scope, documents bucket, and Azure DevOps contexts.
- **Choose a document type** – Tabs are derived from `document-forms` metadata. The UI auto-selects the first available type (SRS/STD/STR/SVD, etc.). Enable "Show debug doc types" from the Developer tab for hidden workflows.
- **Configure content controls** – Each document type renders bespoke selectors:
  - Test content (plans, suites, reporter exports)
  - Work item queries (paragraphs/tables)
  - Traceability matrices and change tables
  - SVD change logs with optional Task-to-parent replacement, where Task work items can be replaced by their immediate Requirement or Change Request parent (other or missing parents are omitted)
  - STR/SRS composite builders with guide drawers
  - Attachments, wiki URLs, and validation helpers
    The footer highlights missing required selections and blocks submission until validation passes.
- **Pick templates** – Templates come from shared and project buckets. The app auto-picks a best guess and remembers your last choice. Use the template dialog to browse, upload, or switch files.
- **Formatting settings** – Open the gear icon to trim whitespace or enable Void List processing (parses `#VL-XX {content}#` patterns and produces Excel + validation reports).
- **Favorites** – Save the current configuration (with template) for yourself or the team. Load or delete favorites from the dialog; shared favorites require confirmation.
- **Send request** – Click "Send Request" to post to `/jsonDocument/create`. A success toast confirms the backend accepted the job. Errors bubble up with toast notifications and console logs.
- **Documents tab** – Lists generated files from the project bucket with search, highlighting, and sort controls. An info banner reminds you about the two-day retention policy.
- **Templates tab** – Download or remove project-specific templates. Shared templates are protected from deletion.
- **Developer tab** – Assemble custom content controls, switch to debug doc types, and experiment with request payloads without impacting production forms.

## Persistence & Debugging Tips

- Credentials live in cookies `azureDevopsUrl` and `azureDevopsPat`; clear them to sign out. Last-used org URLs and template picks are cached in `localStorage` via namespaced keys (`docgen:*`).
- Logging uses `src/utils/logger.jsx`. Set the level by running in DevTools:
  ```js
  localStorage.setItem('docgen:log-level', 'debug');
  ```
  Reload to apply. Levels fall back to `info` in production builds.
- MobX logging can be enabled through `mobx-log` if needed; see `DataStore.jsx` for configuration hooks.

## Production Build & Deployment

1. Produce the static build:
   ```bash
   npm run build
   ```
2. Serve the contents of `dist/` with your preferred static host (nginx, Azure Static Web Apps, etc.).
3. If the backend URL differs, run `src/deployment/env-uri-init.sh` during container start to rewrite `BACKEND-URL-PLACEHOLDER-ContentControl` in the compiled JS bundle. The script requires `BACKEND-URL-PLACEHOLDER-ContentControl` to be set and exits otherwise.
4. Ensure the backend is reachable via HTTPS if the frontend is served securely; update `jsonDocument_url` or the runtime placeholder accordingly.

## Troubleshooting

- **401 errors** – PAT is invalid or expired. Clear cookies and sign in with a fresh token.
- **Document types missing** – Backend cannot reach the `document-forms` bucket or metadata lacks `tabIndex`. Verify MinIO connectivity and folder contents.
- **Template list empty** – Check `templates` bucket permissions and that the project name aligns with the bucket path sanitizer (lowercase, non-alphanumeric replaced with `-`).
- **Request succeeds but no file appears** – Confirm the project bucket exists or let the frontend create it (requires backend support for `createIfBucketDoesNotExist`).
- **CORS/network errors** – Make sure both DocGen API and MinIO endpoints are reachable from the browser and expose the necessary CORS headers.

## Contributing

The repository currently focuses on application code; tests are not yet provisioned. When extending the UI:

- Favor MobX actions for state mutations and respect the established loading flags.
- Keep selectors and dialogs self-contained; reusable logic lives under `src/utils/` or `components/common/`.
- Run `npm run lint` before submitting changes.

Happy documenting! 🚀
