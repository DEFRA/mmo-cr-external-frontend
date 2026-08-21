# Step 17 — Account Page and Header Destinations (Approved Plan)

## 1. Objective

Make the shared header's Home / Your account / Sign out destinations functional, and replace the Account page placeholder with the approved GOV.UK page, without adding a real backend, identity provider or broad new route-guard architecture.

## 2. Key finding (scope-defining)

No simulated sign-in/session mechanism exists anywhere in the repo. `sign-in` submit just redirects to `/records` with no state set, and every existing route (all ~20 catch-record wizard routes, `records`, `account`, `confirmation`) is directly reachable with zero guard — and all 42 existing test files rely on that (direct `server.inject` GETs, no prior sign-in). Retrofitting a guard onto every route would be large, unrelated scope creep for this step.

## 3. Decisions

1. Add a **minimal simulated sign-in flag** in the session: new `common/helpers/auth/session.js` (`isSignedIn`, `signIn`, `signOut` — boolean only, no tokens/passwords).
2. `sign-in` submit now also calls `signIn(request)` before its existing redirect to `/records` (one-line addition, no visual change).
3. New `GET /sign-out` route clears the session (signed-in flag **and** the in-progress catch-record journey state via `request.yar.reset()`) and redirects to `/`.
4. The guard is applied **only to `/account`** — the one page this step builds — redirecting to `/sign-in` when signed out. The other ~20 existing routes are intentionally left unguarded; broader guarding is out of scope for this step.
5. Header nav (`build-navigation.js`) is driven by `isSignedIn(request)`: all three items when signed in (Home → `/records`, Your account → `/account`, Sign out → `/sign-out`), **empty array when signed out** (no signed-out header PNG was supplied, so nothing is invented).
6. `Sign out` is a plain nav link (GET), matching `govukServiceNavigation`'s native link-only item pattern (no custom form-in-nav deviation) — documented exception to "prefer POST for state changes" since it only clears an ephemeral demo flag, not a real security token.
7. "Your account" gets `current: true` only while on `/account`.
8. Every Account page Change/Add/Remove action uses the existing `/not-implemented?return=/account` placeholder pattern (matches `sign-in` and `species-selection`) — no new management journeys.
9. Account data (email, masked password, address, contact number, vessel role fields) extends the existing `common/data/account.js` fixture. "Vessel owned" is derived from the existing `selectVessel` data and "Species caught" from the existing `speciesSelection` data (not duplicated). Gear-onboard mesh text is a small, dedicated account-only list, kept separate from the live `gear.js` trip-selection reference data so Step 11's approved gear-selection page is untouched.
10. Orchestrator not required — one contained frontend task.

## 4. Header route-destination matrix

| Link         | Destination | Notes                                                                   |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| Home         | `/records`  | Existing "landing page after sign in"; not the public `/` guidance page |
| Your account | `/account`  | `current: true` only on this route                                      |
| Sign out     | `/sign-out` | GET, clears session, redirects to `/`                                   |

## 5. Signed-in/out navigation matrix

| State      | Home  | Your account                  | Sign out                                                     |
| ---------- | ----- | ----------------------------- | ------------------------------------------------------------ |
| Signed in  | shown | shown (current on `/account`) | shown                                                        |
| Signed out | —     | —                             | — (empty nav array; no PNG evidence for a signed-out header) |

## 6. Account page mapping (from `YourAccount.png`)

**Personal details** (`govukSummaryList`): Email address, Password (masked), Vessel owned, Vessels skipper of, Address, Contact number — each with a "Change"/"Add" action → `/not-implemented?return=/account`.

**Vessel details** (`govukSummaryList`, heading = vessel name + registration): Skippers, Ports used, Gear onboard (with mesh sub-text), Species caught — same placeholder actions.

Primary action: `govukButton` ("View all catch records", secondary style) → `/records`.

## 7. Files

- New: `src/server/common/helpers/auth/session.js` (+ test)
- New: `src/server/routes/sign-out/{controller.js,index.js,controller.test.js}`
- Rewritten: `src/config/nunjucks/context/build-navigation.js` (+ test), `src/server/routes/account/{controller.js,index.njk,controller.test.js}`
- Small edits: `src/server/routes/sign-in/controller.js`, `src/server/common/data/account.js`, `src/server/plugins/router.js`

## 8. Validation Plan

1. Unit tests: `auth/session.js`, `build-navigation.js` (signed-in/out matrices).
2. Route tests: `/account` (guarded, redirects when signed out), `/sign-out` (clears session, redirects, repeatable, no arbitrary redirect), `/sign-in` (sets flag).
3. Template tests: Account page wording/order/PNG fidelity, header link destinations, `aria-current`, no duplicated language selector.
4. Full regression run (`npm test`), lint, format, build.
5. Manual: PNG/responsive (320/768/1024/1440)/keyboard/200% zoom pass; confirm logo/menu/footer visual corrections remain intact.

## 9. Risks, Assumptions and Sources

- **Scope-limiting assumption (documented above)**: guard limited to `/account` only, to avoid an unrelated, high-blast-radius change across ~20 existing routes/tests.
- No signed-out header PNG was supplied; empty-nav-when-signed-out is a conservative, non-inventive choice.
- Sources: `design/screens/Header.png`, `design/screens/DashboardJamesSmith.png`, `design/screens/YourAccount.png`, existing `records/controller.js` comment ("Landing page after sign in"), existing `govukServiceNavigation` `current`/link-only item support (`node_modules/govuk-frontend/dist/govuk/components/service-navigation/macro-options.json`).
