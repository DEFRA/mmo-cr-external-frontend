---
description: 'Security standards for the MMO Catch Recording external web frontend: DEFRA Secure by Design, OWASP Top 10/ASVS, HTTPS/TLS, secure headers & CSP, input validation, session/cookie safety, secrets management, error logging. Use when handling data, requests, sessions, config, or reviewing security.'
applyTo: 'src/**/*.js, src/**/*.njk'
---

# Security standards

Precedence: DEFRA security > GDS > OWASP/community. DEFRA services must follow
**[Secure by Design](https://www.security.gov.uk/guidance/secure-by-design/principles/)** principles and
DEFRA [security standards](https://defra.github.io/software-development-standards/standards/security_standards/).
Design the service's security profile **before** finalising scope. Treat all inbound requests and external
responses as untrusted.

## Encryption in transit (mandatory)

- **All traffic must be encrypted** (HTTPS/TLS). Never serve or call plain HTTP.
- Keep the secure response headers this service configures — **HSTS**, **XSS protection**, `noSniff`,
  frame protection — enabled. Do not weaken them.
- Keep a strong **Content Security Policy** (`@hapi/scooter` + `blankie`). Avoid `unsafe-inline`; do not
  loosen the CSP without justification and governance sign-off.

## Input validation & output encoding

- **Validate every input at the boundary** with Hapi route `validate` (Joi) — params, query, payload,
  headers. Reject or coerce; never trust client data. Keep `abortEarly: false` so all errors surface.
- **Nunjucks autoescape stays on.** Never disable it. Use `| safe` **only** on values you fully control
  and have sanitised — never on user or external data (prevents XSS / template injection).
- Guard against injection in any downstream call (URLs, query strings, backend APIs); encode/parameterise.
- Protect state-changing routes against CSRF (e.g. `@hapi/crumb` or an equivalent token pattern) and use
  `POST` for mutations.

## Sessions, cookies & caching

- Use `@hapi/yar` for session state; keep cookies `Secure`, `HttpOnly` and `SameSite` appropriately, and
  sign them with a secret from config (never hard-coded).
- Store the **minimum** in the session; never put secrets or sensitive PII in cookies or `localStorage`.
- Server-side cache (Catbox/Redis) keys are namespaced; do not cache sensitive personal data unnecessarily.

## Authentication & authorisation

- Prefer platform-secure, standards-based auth (OAuth 2.0/OIDC) where sign-in is required; store tokens
  server-side, never in the browser. Confirm identity-assurance requirements with security before building
  bespoke flows.
- Enforce authorisation on every protected route; never rely on hidden UI alone.

## Secrets management

- **Never commit** API keys, tokens, passwords or certificates. Provide them via environment variables /
  `convict` config and CI-managed secrets; keep them out of source and logs. If a secret leaks, follow the
  DEFRA [credential exposure](https://defra.github.io/software-development-standards/processes/credential_exposure/)
  process immediately.
- Enable **GitHub Advanced Security** (secret scanning, Dependabot) and DEFRA SonarCloud. Keep
  dependencies patched, pinned and vetted; run `npm run security-audit` (fails on critical advisories).

## Error logging & diagnostics

- **Log errors** with the structured pino logger (`@elastic/ecs-pino-format`) so issues can be diagnosed;
  support a configurable debug log level.
- **Never log secrets or PII** (names, addresses, emails, vessel/licence identifiers, location) in
  plaintext. Never expose stack traces or internal detail to end users — render a generic GOV.UK error page.

## Secure coding (OWASP-aligned)

- Follow the [OWASP Top 10](https://owasp.org/www-project-top-ten/). Avoid insecure/deprecated APIs; keep
  the proxy dispatcher for outbound calls where the platform requires it.
- Apply least privilege for any external access; request and expose only what is needed.
- No debug backdoors or verbose logging in production builds.
