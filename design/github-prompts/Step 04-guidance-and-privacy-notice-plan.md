# Step 04 — Guidance and Privacy Notice (Approved Plan)

## 1. Objective

Replace the Step 02 placeholders for Guidance (`/`) and Privacy Notice (`/privacy-notice`) with detailed, accessible pages matching the two committed PNG screenshots (`design/screens/Guidance.png`, `design/screens/PrivaciNotice.png`), reusing the Step 01 shell and Step 03 `getData('service')` for the service name. Long-form legal/guidance copy stays in Nunjucks (not mock data). Print-page behaviour is out of scope but the link is still presented (plain, no JS print behaviour).

## 2. Visual Source of Truth

Figma API/skill could not be invoked in this session (terminal tools were unavailable when planning began), so per the documented fallback, the committed PNGs are used as the visual and textual source of truth:

- Guidance: `design/screens/Guidance.png`
- Privacy Notice: `design/screens/PrivaciNotice.png`

Figma URL (for future reference): `https://www.figma.com/design/9Jve7RKNprYeeaNYsbTUH1/MMO-Catch-Records?node-id=48-24711`

## 3. Implementation Plan

1. **Guidance** (`src/server/routes/guidance/index.njk` + `controller.js`) — replace `appPlaceholderPage` with real content: caption "Guidance" + `appHeading` H1 "How to record your catch"; intro paragraph; "From:" org links; `govukInsetText` "Applies to England"; a Contents list of in-page anchor links; a "Print this page" link (plain link, no JS print behaviour — explicitly out of scope, documented limitation); five `h2` sections with the exact PNG copy; `govukWarningText` where the design shows a warning; `govukButton` Start now (already implemented) → `/sign-in`; Get help section with phone/hours as static page content. The temporary "Privacy notice" link moves to just above the footer, outside the two-thirds content column, with a one-line dev comment marking it temporary.
2. **Privacy Notice** (`src/server/routes/privacy-notice/index.njk` + `controller.js`) — replace placeholder with the full legal content read from the PNG: intro paragraph + all `h2` sections shown, semantic lists for bullet groups, address blocks as paragraph groups (no `<address>` convention exists elsewhere in the repo), ICO link. Back link already correctly points to `/` (Guidance) — unchanged.
3. **Mock data** — use `getData('service')` (already exists) only for the service name; do not add a telephone/hours key to the data layer (long-form static copy stays in the template).
4. **Tests** — update `guidance/controller.test.js` and `privacy-notice/controller.test.js`; assert the placeholder sentence is gone; assert contents anchors resolve to real IDs; assert Back/Start now/Privacy-notice link destinations.
5. **Validation** — lint/format/test/build/security-audit, then a manual browser pass (JS-disabled navigation, keyboard, 320/768/1440px, 200% zoom) against the two PNGs.

## 4. File/Component Impact

- `src/server/routes/guidance/index.njk`, `src/server/routes/guidance/controller.js`, `src/server/routes/guidance/controller.test.js`
- `src/server/routes/privacy-notice/index.njk`, `src/server/routes/privacy-notice/controller.js`, `src/server/routes/privacy-notice/controller.test.js`
- No changes to `src/server/common/data/*` or the Step 01 shell/header/footer.

## 5. Validation Plan

- `npm run lint:js`, `npm run lint:scss`, `npm run format:check`, `npm test`, `npm run build:frontend`, `npm run security-audit`.
- `server.inject` tests: `/` and `/privacy-notice` return 200 with correct `h1`/title; Start now → `/sign-in`; Guidance → Privacy notice link → `/privacy-notice`; Privacy Notice Back → `/`; contents anchors resolve to real `id`s on the page; existing Step 02/03 regression suites unaffected.
- Manual: `npm run dev`, compare both pages against the PNGs at 320/768/1440px and 200% zoom, tab through with keyboard, disable JS and confirm Start now/Privacy notice/Back still work, then stop the dev server.

## 6. Risks, Assumptions and Sources

- PNG screenshots used as the visual/text source of truth because the Figma API/skill could not be invoked when planning began — documented fallback per the repo's figma-design instructions, approved by the user.
- "Print this page" renders as a plain link with no client-side print behaviour — approved as out of scope; the link is still presented per user instruction.
- Long-form Guidance/Privacy content stays in Nunjucks templates, not `getData`, per the source prompt §7.
