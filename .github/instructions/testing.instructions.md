---
description: "Testing standards for the MMO Catch Recording external web frontend: Vitest unit/integration tests, Hapi server.inject route tests, cheerio HTML assertions, accessibility checks, coverage targets and SonarCloud. Use when writing or reviewing tests or setting quality gates."
applyTo: "**/*.test.js"
---

# Testing standards

Follow DEFRA [quality assurance and test standards](https://defra.github.io/software-development-standards/standards/quality_assurance_standards/).
New or changed behaviour ships with tests. Track coverage in
[DEFRA SonarCloud](https://sonarcloud.io/organizations/defra) and keep the quality gate green.

## What to test

- **Unit tests** for controllers, view-context builders, Nunjucks filters/globals, server helpers and
  domain rules. Prefer fast, isolated, deterministic tests. Mock external HTTP and Redis — no real network.
- **Route/integration tests** using Hapi's `server.inject` against a server from `createServer()` — assert
  status code and rendered HTML. Use `cheerio` to query the markup (headings, labels, error summaries).
- **Accessibility-relevant assertions** where practical: labels are associated, error summaries link to
  fields, key landmarks/headings exist.
- **Failure paths** — validation errors, not-found, unauthorised, and server errors render the correct
  GOV.UK page and status.

## Framework & conventions

- **Vitest** is the test runner (`globals: true`, `environment: node`), with `@vitest/coverage-v8`. Colocate
  tests next to source as `*.test.js` (e.g. `controller.test.js`) mirroring the existing routes.
- Structure tests **Arrange → Act → Assert**. One behaviour per test; descriptive names
  (`Should render error summary when licence number is missing`).
- Make tests independent and order-agnostic; `clearMocks` is on. Reset any shared state. Use a fixed
  timezone (`TZ=UTC`, as the `test` script sets) and fake timers instead of real waits — never `sleep`.
- Use `vitest-fetch-mock` / explicit mocks for outbound calls; keep sample payloads/fixtures in the test.
- Start/stop the Hapi server in `beforeAll`/`afterAll` (`server.initialize()` / `server.stop({ timeout: 0 })`).

## Coverage targets

Coverage must be **visible and reported** in [DEFRA SonarCloud](https://sonarcloud.io/organizations/defra)
and must not regress below the established baseline. The project quality gate is:

- **≥90%** overall (global) line/branch coverage.
- **≥95%** for core business logic — controllers, view-context builders, helpers, filters and domain rules.
- **100%** for error-handling and security-critical paths — input validation, auth, session handling and
  error mapping.

Write tests alongside the code (same change, not a follow-up), and run the full suite after every change —
`npm test` — confirming all tests pass before moving on.

## Running

- Local/CI: `npm test` (runs `vitest run --coverage` with `TZ=UTC`). Watch mode: `npm run test:watch`.
- Every PR runs test + lint + format check + `npm run security-audit` + SonarCloud before merge
  (`npm run git:pre-commit-hook` runs the same gate locally).

See the [unit-tests skill](../skills/unit-tests/SKILL.md) for a step-by-step approach to writing Vitest
tests for this codebase.
