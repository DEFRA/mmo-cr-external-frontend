# Step 05 — Sign In (Approved Plan)

## 1. Objective

Replace the Step 02 Sign In placeholder with a real GOV.UK sign-in form (Email address + Password) matching `design/screens/SIgnIn.png` exactly, keeping it a non-authenticating walkthrough stub: submit → `/records`, no validation, no credential checks, no persistence, no logging.

## 2. Implementation Plan

1. `controller.js`: keep `signInController`/`signInSubmitController` shape; GET passes view context for the form; POST stays `h.redirect('/records').code(303)` (already correct, no credential logic added).
2. `index.njk`: replace `appPlaceholderPage` with: `appHeading({ text: 'Sign in' })`; `govukInput` for Email address (`type="email"`, `autocomplete="username"`, `id`/`name="email"`); `govukInput` for Password (`type="password"`, `autocomplete="current-password"`, `id`/`name="password"`); `govukButton({ text: "Sign in" })` submitting the POST form; `<h2>Having trouble signing in?</h2>`; the two existing Empty Page links unchanged (`/not-implemented?return=/sign-in`).
3. No `novalidate`/client JS needed — POST works with JS disabled already.
4. Tests: extend `controller.test.js` — field labels/types/names/ids/autocomplete via cheerio; "Sign in" heading/button text; "Having trouble signing in?" heading; POST asserts redirect to `/records` and that the response contains no echoed email/password; keep existing Empty Page link assertions; remove the old placeholder-sentence assertion if present.

## 3. File/Component Impact

- `src/server/routes/sign-in/index.njk`, `src/server/routes/sign-in/controller.js` (likely no change needed), `src/server/routes/sign-in/controller.test.js`

## 4. Validation Plan

1. `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
2. `server.inject` GET/POST assertions above; confirm Guidance Start now → Sign In still works (already unchanged); confirm no regressions in Steps 02–04 suites (same known 2 pre-existing unrelated failures expected: `departure-port`/`species-selection` branch-aware Back-link tests).
3. Manual: JS-disabled POST, keyboard tab order (Back → Email → Password → Sign in → Forgotten password → Create account), 320/768/1440px, 200% zoom — deferred separately after implementation.

## 5. Risks, Assumptions and Sources

- No fields are required/validated (matches "do not add validation that blocks the happy path").
- No `novalidate` needed since there are no `required`/pattern constraints being added.
- GDS: none anticipated — standard `govukInput`/`govukButton` reproduce the PNG exactly (default green button, standard label/input spacing).
