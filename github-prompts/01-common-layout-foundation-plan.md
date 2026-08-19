# Step 01 — Application Shell and Shared Page Layout (Approved Plan)

## Visual Source of Truth
The following references are the single, authoritative visual source for this task. During implementation and verification, refer back to this section rather than re-ingesting the assets.
- Figma page: https://www.figma.com/design/9Jve7RKNprYeeaNYsbTUH1/MMO-Catch-Records?node-id=48-24445 (supplementary; Figma connection may be unreliable — do not depend on a live connection)
- PNG — Header: design/screens/Header.png
- PNG — Footer: design/screens/footer.png
- PNG — Full sample page: design/screens/SIgnIn.png
Reference precedence: (1) explicit prompt requirements, (2) existing app conventions required for compatibility, (3) PNG, (4) Figma, (5) GOV.UK Design System.

## Objective
Implement a reusable application shell and shared page layout by refining the existing base Nunjucks layout so every later happy-path screen extends a consistent GOV.UK-style foundation: shared header + left-aligned service navigation, skip link + single `main` landmark, a new shell-owned pre-main navigation row (optional page-supplied Back link on the left, persistent English/Cymraeg selector on the right), a Beta phase banner, shared error-summary/notification integration points, a shared footer, responsive alignment, a documented view-model contract, and tests — without building any later journey screen's business content.

Scope boundary: shell/layout infrastructure and representative wiring only. No form fields, catch-record rules, auth, DB/API/infra changes, or full bilingual translation platform.

## Approved Decisions
- Q1: Standard left-aligned `govukServiceNavigation` (not a centred header). PNG centred header recorded as a deliberate GDS-aligned deviation.
- Q2: Service navigation includes non-functional placeholder links `Home`, `Your account`, `Sign out` (required by design/scope), plus the service-name link to `/`.
- Q3: Include the Beta `govukPhaseBanner` in the shared shell now.
- Q4: Non-switching language-selector integration point using `?lang=cy` path preservation. No real localisation implemented; switching is not operational in this step.
- Q5: Remove breadcrumbs from the shared shell and the About controller; future pages use page-specific GOV.UK Back links.
- `serviceName` default = "Record your catch".
- Footer meta links: Feedback, Privacy policy, Accessibility Statement (retain default GOV.UK OGL + Crown copyright).

## Scope
In scope: refine base layout `page.njk`; new `page-navigation` component (pre-main row: optional Back link + language selector); global context additions (`htmlLang`, `languageToggle`); config update (`serviceName`, `feedbackUrl`); service navigation items; error-summary + notification integration points; Beta phase banner; SCSS for the new component; migrate home/about/error views to `pageContent`; unit/rendering + route/integration + accessibility tests; concise developer docs.
Out of scope: Welsh content translation / a translation service; later journey screen content, form fields, auth, dashboards, DB, API, infra, deployment; breadcrumbs; `history.back()` navigation; redesigning branding beyond service name/footer/nav wiring.

## Implementation Plan
Sequential foundation: (1) config + context; (2) new `page-navigation` component; (3) SCSS wiring. Then largely parallel: (4) refine base layout; (5) header/service nav/footer; (6) migrate representative routes; (7) developer docs. Then sequential: (8) tests; (9) lint/format/build; (10) plan already saved to `github-prompts/01-common-layout-foundation-plan.md`.

1. Config + context: `serviceName` → "Record your catch"; add `feedbackUrl` and `defaultLocale` (`en`); `context.js` adds `htmlLang` (default `en`) and `languageToggle` (built from request path, Cymraeg href preserves path via `?lang=cy`); remove default `breadcrumbs`.
2. New component `src/server/common/components/page-navigation/` (macro.njk `appPageNavigation`, template.njk, _page-navigation.scss, template.test.js): flex row with optional `govukBackLink` (only when `backLink.href` present; default text `Back`) and the English/Cymraeg selector (current-language text + other-language link with `lang`/`hreflang`). No empty placeholder; no absolute positioning; GOV.UK spacing tokens only; wraps/stacks accessibly at ≤ mobile.
3. Add `@use "page-navigation/page-navigation";` to `components/_index.scss`.
4. `page.njk`: add `htmlLang` block; replace breadcrumbs in `beforeContent` with `govukPhaseBanner` (Beta) + `appPageNavigation`; nest `notification`, `errorSummary` (render only when supplied) and `pageContent` blocks inside `content`; keep page-title block; update footer meta items.
5. `build-navigation.js`: `Home`, `Your account`, `Sign out` placeholder links (`href: '#'`), left-aligned standard Service Navigation; service-name link to `/`. Update its test.
6. Migrate `home/index.njk`, `about/index.njk`, `error/index.njk` to `pageContent`. `about/controller.js`: remove `breadcrumbs`, add `backLink: { href: '/', text: 'Back' }`. Home stays no-Back-link.
7. Developer docs appended to `src/server/common/README.md` (extend layout, optional Back link + why outside header, responsive pre-main row, language-selector integration point, error/notification usage, tests, Visual Source of Truth pointer).

## File/Component Impact
New: `src/server/common/components/page-navigation/{macro.njk,template.njk,_page-navigation.scss,template.test.js}`; developer doc additions; `github-prompts/01-common-layout-foundation-plan.md`.
Modified: `src/server/common/templates/layouts/page.njk`; `src/config/nunjucks/context/context.js` (+ test); `src/config/config.js`; `src/config/nunjucks/context/build-navigation.js` (+ test); `src/client/stylesheets/components/_index.scss`; `src/server/routes/home/index.njk`; `src/server/routes/about/index.njk`; `src/server/routes/error/index.njk`; `src/server/routes/about/controller.js` (+ test); `src/server/routes/home/controller.test.js` (assertions).
Unchanged: router/plugins, sessions/cache, security headers/CSP, logging, auth, Docker/compose, Vite/vitest config.

## Validation Plan
Unit/rendering (renderComponent + cheerio, data-testid), layout rendering, integration (server.inject for /, /about, /health), accessibility states (with/without Back link, English, error-summary). Commands: `npm run lint`, `npm run format:check`, `npm test`, `npm run build:frontend`, then manual responsive verification at 320/768/1024/1440px and 200%/400% zoom per the prompt's §23.

## Risks and Mitigations
- content→pageContent migration could break existing routes → migrate all three views together; integration tests assert 200 + markup.
- PNG centred header vs left-aligned GDS pattern → use standard pattern, record deviation.
- Language selector implies out-of-scope i18n → ship as non-switching integration point (`?lang=cy`), documented and code-commented as non-functional.
- Breadcrumb removal affects About/tests → remove from controller + context together, update tests.
- Pre-main row overlap on mobile → flexbox + wrap, tokens only, 320px reflow check, no absolute positioning.
- Empty error/notification announced to AT → conditional render only when data present; a11y test for empty state.
- SCSS load-path wiring → mirror the working `heading/heading` `@use` entry.

## Research and Sources
Alignment order DEFRA > GDS > GOV.UK Design System. GOV.UK Frontend 6.x page template (blocks `beforeContent`/`content`/`pageTitle`/`htmlLang`, built-in skip link → `#main-content`, `govuk-width-container` around beforeContent + main). Back Link, Phase banner, Service Navigation components (GOV.UK Design System). Translate-content pattern (current language as text, other as link with `lang`/`hreflang`). WCAG 2.2 AA per `.github/instructions/accessibility.instructions.md`. Confirm exact macro import paths/params against the in-repo `node_modules/govuk-frontend/dist` 6.2.0.
