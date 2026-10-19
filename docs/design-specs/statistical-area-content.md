# Statistical area: consistent gear content

- Source: user-supplied screenshots and request to show matching content on `/statistical-area` and `/statistical-area-other` for selected gears.
- Read date: 2026-10-17. Figma version and exact spacing measurements unavailable.
- Confirmed: heading reads "Select the statistical sub area where the majority of your catch was caught using pots" for pots; the gear name must reflect the actual selection rather than a hard-coded gear or mesh size.
- Both pages share the same heading, document title and two existing explanatory paragraphs. Caption, shared header/footer, back destinations, page spacing, map and radio/search controls remain unchanged.
- Catalogue names are retained when gear selection is submitted; existing bundled gear IDs can resolve their names without re-selection.
- Compatibility update, 2026-10-19: sessions with API gear IDs but no saved names resolve the missing names from the gear catalogue on both pages, including validation errors. Known names need no extra catalogue request.
- Multiple selected gears are listed together because the current journey stores a list and has no per-gear area step. No selected/recognised gear produces a generic heading rather than inventing pots or seine nets.
- Acceptance: matching headings and guidance for every bundled gear, saved API catalogue names and multiple selections; selected-gear heading retained on validation errors.
- No additional GOV.UK component or styling deviations are introduced by this content correction.

## Other Selection Presentation (2026-10-19)

- Source: supplied screenshots of the selected Other option and the manual-entry field above Save and continue.
- Keep the field hidden until Other is selected, retaining its existing label, search results and validation.
- Placeholder: "Start typing to display the list". Reuse the existing decorative `.app-autocomplete__arrow` indicator and reserved input padding from the port and gear fields.
- Recommended nearest GOV.UK spacing tokens, not measured Figma values: label bottom spacing 4 and field-to-button spacing 9.
- This reuses the previously recorded bespoke autocomplete-arrow deviation. The arrow is hidden from assistive technology and does not intercept pointer input.