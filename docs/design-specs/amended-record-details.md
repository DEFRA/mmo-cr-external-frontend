# Amended Record Details

- Source: supplied vessel-heading and Gear used screenshots, read 2026-10-19.
- Scope: `/records/amended-1`, through the amended-status details view. Submitted, unsent and late record views retain their existing stored details.
- Heading and document title: "Catch record for <selected vessel name>". Retain the record reference as the caption, with the record's vessel as fallback when no journey selection exists.
- Reuse the check-answers summary builder and GOV.UK summary-section macro in read-only mode. Show the journey's captured dates, ports, statistical area, gear selection and measurements, selected species and weights, and not-landed answers.
- Gear used retains the previous four-row pots layout, including Mesh size and saved-measurement precedence. Other gears omit pots-specific rows.
- Preserve actual subrectangle codes selected from the Other list rather than replacing them with example data.
- Retain Record status, Edit catch record and Download PDF controls. Do not add row-level Change links to this read-only page.
- This walkthrough uses the current session journey for amended views; it does not introduce persistent record storage or change other record statuses.
- Acceptance: selected vessel in heading/title and trip rows; captured trip dates and answers; saved mesh measurements; no invented pots rows for non-pots gear; read-only summaries; unchanged stored submitted-record values.
- No new CSS, assets, shared-shell changes or GOV.UK design-system deviations are required.