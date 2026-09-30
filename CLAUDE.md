# docgen-frontend — Repository Guidance

## Role

`docgen-frontend` is the DocGen user interface.

For cross-repository DocGen architecture and ownership, consult:

`../docs/docgen/architecture.md`

Load that document only when the task genuinely requires cross-repository context.

## Stack

- React 19
- Vite 7
- MobX
- project theme/design-token system
- virtualized rendering for large datasets

Use the current package configuration as the source of truth for exact dependencies and scripts.

## Architecture Boundaries

Frontend owns:

- user interaction
- client-side state
- Azure DevOps-facing UI flows
- document-generation requests
- frontend-facing MinIO / SharePoint integration

Keep business/domain logic out of React components.

Keep transport/data-fetching behavior separate from rendering concerns.

Do not introduce a second state-management model alongside MobX without explicit architectural justification.

## Important Entry Points

Likely routing anchors:

- `src/store/DataStore.jsx`
- `src/store/actions/AzureDevopsRestApi.jsx`
- `src/store/data/docManagerApi.jsx`
- `src/theme/tokens.js`
- `AppThemeProvider.jsx`
- `requestQueue.js`

Use targeted discovery from these areas rather than broad repository scans.

## UI and State Invariants

### Theme and tokens

Reuse the existing theme/design-token system.

Do not hardcode reusable design values in components when they belong in shared theme/tokens.

### MobX

Preserve the existing MobX state-management model.

Do not introduce Redux or parallel global-state mechanisms for local convenience.

### Large datasets

Preserve existing virtualization mechanisms such as `react-virtuoso` / `react-window` when working with large lists or datasets.

Do not replace virtualization with eager rendering without evidence that scale constraints no longer apply.

### Azure DevOps request backpressure

Use the existing `requestQueue.js` mechanism for Azure DevOps API backpressure where applicable.

Do not introduce parallel throttling/queue logic without verifying why the existing abstraction is insufficient.

### Runtime configuration

Environment-specific Azure AD configuration is injected at runtime through:

`window.APP_CONFIG`

Configuration that belongs to runtime injection should not require a frontend rebuild.

## React Boundaries

Keep:

- business/domain logic outside React components,
- side effects out of render,
- data-fetching/orchestration separate from rendering when practical,
- derived state computed rather than duplicated unless persistence is intentional.

Custom hooks should own React lifecycle/orchestration concerns, not become repositories for business logic.

## Commands

Use the current `package.json` as authority.

Typical commands:

- Development: `npm run dev`
- Build: `npm run build`
- Tests: `npm run test`
- Lint: `npm run lint`

Run the narrowest relevant validation first.

For UI changes, verify behavior in the browser when the application is runnable and the change is visually or interaction-sensitive.

## Source of Truth

Use current source/configuration as authority for:

- scripts
- dependencies
- runtime configuration
- state behavior
- UI patterns
- test configuration

Do not encode volatile test counts, bundle sizes, ports, or dependency versions in this file.
