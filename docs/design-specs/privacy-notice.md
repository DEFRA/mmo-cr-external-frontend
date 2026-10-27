# Privacy Notice Layout Corrections

## Source And Evidence

- Read on 2026-10-27. Source: user-supplied Complaints/footer crop (1248 by 606) and six written acceptance criteria. No Figma URL or full-page export supplied.
- Confirmed from crop: left-aligned text, a narrow paragraph measure, a separate Visit line for the ICO URL, and a full-width grey footer with OGL and Crown copyright branding.
- Confirmed from code: the page already uses a two-thirds grid; the heading was outside it. Account navigation is available only in a signed-in session. The shared footer override omitted the v6 semantic wrapper.
- Approved by user: proceed from the crop/checklist, preserve signed-in-only account navigation, and add a local Cookies page.
- Written criteria take precedence over the crop's footer labels: Privacy notice, Accessibility statement and Cookies. Retain the existing Feedback link.

## Ownership And Components

- Shared layout owns the GOV.UK header, authenticated navigation, Beta banner, Back/language row, footer and branding. Restore the inherited footer wrapper rather than duplicating chrome.
- Privacy Notice owns one two-thirds column containing its shared appHeading and all existing notice sections. Cap the column at two-thirds of the GOV.UK page-width token; use full available width on mobile.
- Reuse GOV.UK typography, grid, links, footer and Cookies table components. No new visual assets or dependencies.
- Cookies follows the existing route/controller/view convention. The table describes the configured session cookie name and browser expiry; no consent control is needed for this essential cookie.

## Recommended Rhythm

- Preserve appHeading's heading-to-introduction spacing.
- Section headings: responsive GOV.UK spacing 6 above and 4 below. Paragraph/list spacing remains the standard GOV.UK rhythm; retain the compact postal address blocks.
- Complaints uses the larger GOV.UK heading style visible in the crop, with spacing 6 above and the standard heading-l margin below.
- Final content-to-footer separation: responsive GOV.UK spacing 9 within the column on mobile; twice spacing 9 plus spacing 7 on desktop, plus the shared main-wrapper spacing. This approximates the larger blank area in the supplied crop without imposing it on mobile.
- These values and the column cap are recommendations, not measurements from a complete Figma frame. Exact full-page wrapping and spacing remain unverified without that frame.

## States And Accessibility

- Both pages are public and render without JavaScript. Signed-in sessions retain Home, Your account and POST Sign out navigation; signed-out sessions do not expose account actions.
- Preserve one h1, ordered section headings, visible link focus, language and Back navigation, an accessible ICO link and a semantic footer landmark.
- No changes to authentication, session configuration, CSP, autoescaping or cookie consent behaviour.

## Acceptance And Deviations

- Verify aligned heading/body, constrained desktop measure, no horizontal overflow on mobile, and a visible footer at the document end with all requested links and licence branding.
- Verify signed-in account/sign-out controls and a working Cookies destination.
- Run focused route tests, stylesheet/JS lint, frontend build and the full test suite; inspect desktop/mobile screenshots.
- No new GOV.UK component deviations. Existing custom shared header/footer styling is retained; page-local spacing and the width cap use GOV.UK tokens.
- Exact full-page Figma parity, full manual screen-reader testing and formal accessibility audit are not established by this crop-based correction.