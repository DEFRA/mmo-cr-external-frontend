# Edit Catch Record Reason

- Source: user-supplied reference screenshot, read 2026-10-19. No Figma node/version or measured spacing values supplied.
- Scope: `/records/submitted-1/edit-reason`. Preserve the existing late-record heading and absence of notification on that variant.

## Design

- Keep the shared header, phase banner, Back/language navigation and footer unchanged.
- Place the Important notification inside the two-thirds form column, above the record-reference caption. Retain the record-specific trip-end date and render the banner once.
- Keep "Why are you editing this catch record?", the Include prompt and the four supplied bullets in their existing order.
- Enlarge the textarea to nine rows as a screenshot-based approximation; do not claim exact Figma measurements.
- Restore the GOV.UK warning icon and text below the textarea: "You must have a valid reason for editing this catch record. Editing a catch record without a valid reason may be an offence and could result in enforcement action."
- Keep Save and continue below the warning with clear separation.
- Recommended nearest GOV.UK spacing tokens: heading bottom 7, hint and textarea-group bottom 8, warning bottom 9 and button top 4. These are responsive design choices, not measured Figma tokens.

## Behaviour And Acceptance

- Retain required, trimmed reason validation, the 2,000-character maximum, error-summary link, inline error and entered value on failure.
- Retain the existing amendment-state handling and redirect to the selected record's edit-review page.
- Banner, caption, question, hints, textarea, warning and button appear in that order, without overlap or mobile overflow.
- Use GOV.UK notification, textarea, warning and button macros. No new assets, bespoke CSS, shared-layout changes or GOV.UK component deviations are introduced.