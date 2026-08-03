---
description: "Node.js, Hapi.js and Nunjucks coding standards for the MMO Catch Recording external web frontend: ES modules, Hapi routing/controllers, Nunjucks + GOV.UK Frontend views, convict config, Catbox sessions, project layout and progressive enhancement. Use when writing or reviewing frontend code."
applyTo: "src/**/*.js, src/**/*.njk, src/client/**/*.scss"
---

# Node.js, Hapi & Nunjucks standards

Precedence: DEFRA standards > GDS > GOV.UK Design System / community. Where DEFRA is silent, follow GDS,
the [GOV.UK Design System](https://design-system.service.gov.uk/) and idiomatic Node.js/Hapi guidance.

## Language & style

- **ES Modules** (`type: module`, Node **≥ 24**). Use `import`/`export`; no CommonJS in `src/`.
- **Import alias:** use `#/` for `src/` (e.g. `import { config } from '#/config/config.js'`). Keep the
  `.js` extension on relative/aliased imports.
- **Style:** `neostandard` (Standard-style — no semicolons, single quotes, 2-space indent). Don't fight the
  formatter (ESLint + Prettier + Stylelint GDS). Run `npm run lint` and `npm run format`.
- **Naming:** `lowerCamelCase` for variables/functions, `UpperCamelCase` for classes/constructors. Booleans
  read as assertions (`isValid`, `hasError`). Name by role; omit needless words.
- **Functions:** prefer small, pure functions; return values rather than mutating arguments. Use
  `async/await` for asynchronous work and propagate errors — do not swallow them.
- **Immutability:** prefer `const`; avoid shared mutable module state.

## Hapi server & routing

- The server is created in `src/server/server.js` and registers plugins (logging, tracing, metrics, secure
  context, pulse, session cache, Nunjucks/vision, Scooter, CSP, router). Follow that composition; register
  new cross-cutting behaviour as a plugin under `src/server/plugins/`.
- **One folder per route** under `src/server/routes/<name>/`:
  - `controller.js` — the handler(s).
  - `controller.test.js` — Vitest tests (colocated).
  - `index.js` — route definition(s) wiring path/method → controller (and `validate`).
  - `index.njk` — the page template (where the route renders a view).
- Register route modules in `src/server/router.js`. Follow the existing `home/` and `about/` examples.
- **Validate input** on routes with Hapi `validate` (Joi) for params/query/payload; keep
  `abortEarly: false`. Return correct status codes; use the shared error handling (`catchAll`) for failures.

## Controllers (thin)

- A controller builds the **view context** and returns `h.view('<template>', { pageTitle, heading, … })`,
  or returns data/redirects. Keep it thin.
- **No domain/IO logic in controllers or templates.** Put business logic, data access and external calls in
  `src/server/common/helpers/` (or a dedicated service module) and unit-test them directly.
- Use the structured logger (via `request.logger`/pino) — never `console.log`. No secrets/PII in logs.

## Nunjucks views & GOV.UK Frontend

- Templates render through `@hapi/vision`; the environment is configured in `src/config/nunjucks/`.
  **Autoescape stays on** — never use `| safe` on untrusted data.
- Build on the **GOV.UK Design System** / `govuk-frontend`. Reuse GOV.UK components (buttons, forms, error
  summary, tables, navigation) and the shared partials/components under `src/server/common/` — do **not**
  hand-roll markup a GDS component already provides.
- Keep logic out of templates. Add reusable formatting as **filters** and shared values as **globals** under
  `src/config/nunjucks/` (see `format-currency`, `format-date`) rather than inline in `.njk` files.
- Use semantic HTML and the GOV.UK page template/layout; follow the
  [accessibility instructions](accessibility.instructions.md).

## Progressive enhancement (mandatory)

- The core journey must work with **HTML alone**. Layer CSS then JavaScript on top; never require
  client-side JS for a page to function. Always keep **server-side validation** even when adding client-side
  checks. Follow GDS [progressive enhancement](https://www.gov.uk/service-manual/technology/using-progressive-enhancement).

## Configuration

- Use **convict** (`src/config/`) for all configuration; values come from the environment. **No secrets in
  source** — inject via environment/CI. Document new config keys in `src/config/` and the README.
- Respect existing config for host/port, session cache engine (Redis/memory), Nunjucks watch/cache, proxy,
  logging and feature settings.

## Sessions, caching & outbound calls

- Session/state via `@hapi/yar` and Catbox (Redis deployed, in-memory locally). Store the minimum; never
  put secrets/PII in the session.
- For outbound HTTP, use the platform **proxy dispatcher** where required (`undici` `ProxyAgent`), with
  sensible timeouts; handle failures explicitly. Never disable TLS verification.

## Client assets

- SCSS and JS under `src/client/` are bundled with **Vite** (`npm run build:frontend`). Follow GDS Sass
  patterns; Stylelint uses `stylelint-config-gds`. Keep JS additive (progressive enhancement) and small.

## Dependencies

- Prefer well-maintained, licence-compatible, minimal dependencies per DEFRA
  [choosing packages](https://defra.github.io/software-development-standards/guides/choosing_packages/). Pin
  versions. Do **not** introduce a heavyweight client framework (React/Vue/etc.) — this is a server-rendered
  Nunjucks + GOV.UK Frontend service. Run `npm run security-audit`.

## Project layout (current)

```
mmo-cr-external-frontend/
├── src/
│   ├── index.js                     # entry point
│   ├── config/
│   │   ├── config.js                # convict schema
│   │   └── nunjucks/                # env, context, filters, globals
│   ├── client/                      # SCSS + JS bundled by Vite
│   └── server/
│       ├── server.js                # Hapi server + plugin registration
│       ├── router.js                # route registration
│       ├── plugins/                 # cross-cutting Hapi plugins (CSP, logging, tracing, cache…)
│       ├── common/
│       │   ├── helpers/             # domain/IO logic, cache, errors, server bootstrap
│       │   ├── components/          # shared Nunjucks components
│       │   ├── templates/           # shared layouts/partials
│       │   └── constants/           # e.g. status codes
│       └── routes/
│           └── <name>/              # controller.js, controller.test.js, index.js, index.njk
├── docs/
│   ├── adr/                         # Architecture Decision Records
│   └── design-specs/                # captured Figma Design Specs
└── README.md
```

## Notes
- **One folder per route** under `routes/`, self-contained (controller + tests + route + view).
- **common/helpers** holds cross-cutting logic; controllers stay thin and delegate to it.
- **Reusable UI** lives in GOV.UK Frontend + shared `common/` partials/components — reuse before building.
- Capture architecture decisions (new routing/session/cache strategy, integrations, auth) as ADRs under
  `docs/adr/`.
