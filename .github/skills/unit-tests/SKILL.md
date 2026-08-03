---
name: unit-tests
description: 'Write and strengthen Vitest tests for the MMO Catch Recording external web frontend: unit tests for controllers, view-context builders, Nunjucks filters and server helpers, plus Hapi server.inject route/integration tests with cheerio HTML assertions. Use when adding tests for new/changed behaviour, closing coverage gaps, or setting up a test for a new route. Enforces the tiered coverage targets and DEFRA SonarCloud gate.'
argument-hint: "e.g. 'write tests for the add-catch controller' or 'close the coverage gap in format-date filter'"
user-invocable: false
---

# Unit & route tests (Vitest)

Write fast, deterministic tests that ship **with** the code, following the
[testing instructions](../../instructions/testing.instructions.md). New or changed behaviour is not done
until it has tests and the suite is green.

## When to use

- Adding tests for a new/changed controller, helper, filter/global or domain function.
- Adding a route/integration test for a new page.
- Closing a coverage gap flagged by SonarCloud or the coverage report.

## What to test (by layer)

- **Controllers** — the returned view/template and context, status codes, redirects, and error branches.
- **Helpers / services / domain logic** — inputs → outputs and error paths, in isolation (mock IO/Redis/HTTP).
- **Nunjucks filters/globals** — pure input→output (e.g. `format-currency`, `format-date`); cover edge cases
  (null/empty/boundary/locale/timezone).
- **Routes (integration)** — via Hapi `server.inject` against `createServer()`; assert status and rendered
  HTML with `cheerio` (headings, labels, error summary, key content).
- **Failure paths** — validation errors, not-found, unauthorised, server errors render the correct GOV.UK
  page and status. These are **100%**-coverage paths.

## Procedure

1. **Read** the code under test and the existing colocated `*.test.js` nearby for the established pattern
   (see `src/server/routes/home/controller.test.js`).
2. **Arrange** — build the server in `beforeAll` (`server.initialize()`), tear down in `afterAll`
   (`server.stop({ timeout: 0 })`). Mock outbound HTTP (`vitest-fetch-mock`/explicit mocks) and Redis; keep
   fixtures inline. Rely on `clearMocks` and a fixed `TZ=UTC`.
3. **Act** — call the function directly, or `server.inject({ method, url, payload })` for a route.
4. **Assert** — one behaviour per test; assert outputs/status/markup, not implementation details. Use
   `cheerio.load(result)` and query by role/label/text for HTML.
5. **Name** tests to describe behaviour (`Should return 400 and error summary when licence number is
missing`). Keep tests independent and order-agnostic; no real timers/`sleep` — use fake timers.
6. **Run & verify** — `npm test` (with coverage). Confirm all pass and coverage meets the targets before
   finishing.

## Coverage targets (must hold)

- **≥90%** global · **≥95%** core logic (controllers, view-context builders, helpers, filters, domain) ·
  **100%** error-handling and security-critical paths (validation, auth, session, error mapping).
- Coverage must be **reported** and must not regress below the DEFRA
  [SonarCloud](https://sonarcloud.io/organizations/defra) baseline; the quality gate stays green.

## Anti-patterns to avoid

- Hitting real network/Redis/services, or depending on external state.
- Time/locale flakiness — always pin `TZ` and use fake timers, never `sleep`.
- Asserting internal calls instead of observable behaviour/output.
- Snapshotting entire pages brittlely — assert the specific markup that matters.
- Leaving the suite red or skipping a failing test "to fix later".

## Output

- The added/updated `*.test.js` colocated with the source.
- A short note of what is covered, any gaps intentionally left (with rationale), and the pass/coverage
  result from `npm test`.
