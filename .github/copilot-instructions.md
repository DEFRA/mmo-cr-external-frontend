# MMO Catch Recording — External Frontend (Project Guidelines)

This repository holds the source code for the **MMO Catch Recording** external-facing web frontend for
the Marine Management Organisation, part of the Department for Environment, Food and Rural Affairs
(**DEFRA**). It is a DEFRA **Core Delivery Platform (CDP)** Node.js service built with Hapi.js, Nunjucks
templating and the GOV.UK Design System.

These guidelines apply to **every** chat request in this workspace and are inherited by custom agents
(including [Frontend Developer](.github/agents/frontend-developer.agent.md),
[Frontend Planner](.github/agents/frontend-planner.agent.md),
[Frontend Orchestrator](.github/agents/frontend-orchestrator.agent.md) and
[Frontend Code Reviewer](.github/agents/frontend-code-reviewer.agent.md)).

---

## 1. Standards precedence (highest wins)

When guidance conflicts, follow this order:

1. **DEFRA Software Development Standards** (mandatory) — https://defra.github.io/software-development-standards/
2. **DEFRA Digital Service Manual** — https://digital.defra.gov.uk/service-manual
3. **GOV.UK Service Standard & Service Manual (GDS)** — https://www.gov.uk/service-manual
4. **GOV.UK Design System & GOV.UK Frontend** — https://design-system.service.gov.uk/
5. **Community best practice** — OWASP ASVS/Top 10, Node.js & Hapi.js guidance, widely-adopted patterns

> **DEFRA takes precedence over GDS. GDS takes precedence over GOV.UK Design System/community guidance.**
> Any deviation from a DEFRA standard MUST be raised as a formal exception through DEFRA's architectural
> governance (Delivery Architecture team: `delivery.architecture@defra.gov.uk`).

## 2. Mandatory DEFRA constraints (apply to all work)

- **Encrypt all traffic** (HTTPS/TLS). Never send data over plain HTTP. Set secure response headers
  (HSTS, CSP, `X-Content-Type-Options`, frame protection) — this service already configures these.
- **Progressive enhancement.** Follow the GDS
  [progressive enhancement](https://www.gov.uk/service-manual/technology/using-progressive-enhancement)
  approach: the core journey must work with HTML alone; layer CSS and JavaScript on top. Do not depend on
  client-side JavaScript for a page to function.
- **Log errors** with structured logging (pino/ECS) so a user's issue can be diagnosed for support;
  support a configurable debug logging level. Never log secrets or PII.
- **Code in the open** in the [DEFRA GitHub org](https://github.com/DEFRA); analyse quality/coverage in
  [DEFRA SonarCloud](https://sonarcloud.io/organizations/defra).
- **Never commit secrets.** Follow DEFRA's
  [credential exposure](https://defra.github.io/software-development-standards/processes/credential_exposure/)
  process if a secret leaks.
- **Accessibility is a legal requirement:** meet **WCAG 2.2 level AA** and work with common assistive
  technologies (see [accessibility](.github/instructions/accessibility.instructions.md)).
- **Secure by Design** (https://www.security.gov.uk/guidance/secure-by-design/principles/).
- Maintain a README to DEFRA
  [README standards](https://defra.github.io/software-development-standards/standards/readme_standards/),
  plus a solution overview, ADRs and architecture diagrams.

## 3. The working framework (Triage → Read → Research → Plan Handoff → Plan Validation Research → Approval → Implement → Test → Iterate)

This section is the **single source of truth** for the working loop. Custom agents reference it and
**must not restate or fork it**.

**Triage first — pick the right path by size and risk:**

- **Trivial / low-risk** (typo, copy/comment/doc tweak, a small localised change with no impact on
  architecture, routing, sessions/caching, auth, security or accessibility): skip the planner and heavy
  research. Do a light **Read → Implement → Test → Summarise**, and research only the specific point that
  is genuinely uncertain.
- **Non-trivial** (new feature, architecture, routing, session/caching, auth, security, an accessibility
  surface, or anything user-visible or risky): run the full loop below.

Non-trivial loop:

1. **Read** — Read the relevant files/config in the repo for context before acting. Never assume; verify.
2. **Research** — Do a thorough internet research in the open, **scoped to the task's risk**, and validate
   findings against DEFRA/GDS, the GOV.UK Design System, and framework (Node.js/Hapi) guidance so advice
   reflects current APIs and policy. Cite sources.
3. **Clarify** — Ask the user targeted questions whenever requirements are ambiguous or missing. Surface
   requirement gaps explicitly with suggested fixes. Do not guess at intent.
4. **Plan handoff** — Delegate planning to the task's designated planning agent when one exists (for
   frontend implementation, this is [Frontend Planner](.github/agents/frontend-planner.agent.md)). The
   planning agent returns the complete implementation plan.
5. **Plan validation research** — Perform a thorough internet research in the open to validate the plan
   against DEFRA/GDS, the GOV.UK Design System, and framework guidance, **focusing on the steps the planner
   flagged as risky or version-sensitive** (unfamiliar APIs, security, policy). Send targeted revisions
   back to the planner.
6. **Approval** — Present the complete validated plan to the user and obtain explicit approval before
   implementation. If changes are requested, update the plan, re-validate, and re-approve. **Cap the
   plan → validate → approve → implement replanning cycle at 3 iterations**; if it is still unresolved,
   stop and surface the blocker to the user instead of looping.
7. **Implement** — Deliver one task at a time (or parallel independent tasks) from the approved plan. Stay
   focused on the requested outcome; do not scope-creep or refactor unrelated code. **When a change
   establishes or alters architecture** (a new routing pattern, session/cache strategy, external
   integration, auth), create the required ADR(s) first under `docs/adr/`, then build against them.
8. **Test / Validate** — Build, run unit/accessibility tests, lint, check errors, and confirm each task
   works before moving on.
9. **Iterate** — Refine until the user is satisfied with each task.
10. **Summarise** — End with a detailed **executive summary** of what changed, why, how it was validated,
    and any follow-ups or risks.

## 4. Tech stack (current decisions)

- **Runtime:** Node.js **≥ 24** (ES Modules, `type: module`). Use the `#/` import alias for `src/`.
- **Server:** [Hapi.js](https://hapi.dev/) 21 with plugins (`@hapi/vision`, `@hapi/inert`, `@hapi/yar`,
  `@hapi/scooter`, `blankie`). Routes are registered via `src/server/router.js`.
- **Views:** [Nunjucks](https://mozilla.github.io/nunjucks/) templates rendered through `@hapi/vision`,
  built on the [GOV.UK Design System](https://design-system.service.gov.uk/) / `govuk-frontend`.
- **Client assets:** SCSS + JS bundled with **Vite**; GDS Sass patterns via `stylelint-config-gds`.
- **Config:** [convict](https://github.com/mozilla/node-convict) in `src/config/`; environment-driven,
  no secrets in source.
- **Caching/session:** Catbox (Redis in deployed environments, in-memory locally) via `@hapi/yar`.
- **Logging/observability:** pino with `@elastic/ecs-pino-format`, `@defra/hapi-tracing`,
  `@defra/cdp-metrics`, `@defra/cdp-auditing`.
- **Testing:** [Vitest](https://vitest.dev/) with v8 coverage; `cheerio` for HTML assertions. See the
  [testing instructions](.github/instructions/testing.instructions.md).
- **Tooling:** ESLint (`neostandard`), Stylelint (`stylelint-config-gds`), Prettier. Do not fight the
  formatter.

## 5. Build & test commands

- Install: `npm install`
- Develop (watch): `npm run dev`
- Build client assets: `npm run build:frontend`
- Production start: `npm start`
- Lint (JS + SCSS): `npm run lint` · Fix JS: `npm run lint:js:fix`
- Format: `npm run format` · Check: `npm run format:check`
- Test + coverage: `npm test` · Watch: `npm run test:watch`
- Security audit: `npm run security-audit`
- Full pre-commit gate: `npm run git:pre-commit-hook`

## 6. Conventions

- **Routing:** one folder per route under `src/server/routes/<name>/` containing `controller.js`,
  `controller.test.js`, `index.js` (route wiring) and `index.njk` (view). Follow the existing home/about
  examples. Register new routes in `src/server/router.js`.
- **Controllers** are thin: build view context and return `h.view('<template>', { pageTitle, heading, … })`.
  Keep domain/IO logic in `src/server/common/helpers/` (or a service module), not in controllers.
- **Views** extend the GOV.UK layout; reuse GOV.UK Frontend components and the shared partials/components
  under `src/server/common/`. Do not hand-roll markup a GDS component already provides.
- **Nunjucks** context/filters/globals live under `src/config/nunjucks/`; add reusable formatting there
  (see `format-currency`, `format-date`) rather than in templates.
- **JavaScript style:** ES modules, `neostandard` (Standard-style, no semicolons); descriptive names;
  small pure functions; validate input at boundaries with Joi/Hapi `validate`.
- Conventional, descriptive commits; small PRs; follow DEFRA
  [pull request](https://defra.github.io/software-development-standards/processes/pull_requests/) and
  [version control](https://defra.github.io/software-development-standards/standards/version_control_standards/) standards.
