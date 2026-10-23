# Add port: search-field design gap

- Source: user-supplied design screenshot and gap table (screenshot fallback).
- Figma: https://www.figma.com/design/9Jve7RKNprYeeaNYsbTUH1/MMO-Catch-Records?node-id=718-105740
- Read date: 2026-10-17. Figma version/lastModified unavailable; the local cache contains a different node.
- Scope: `/add-port?for=departure&entry=1`, with the shared field also used for return-port and account port entry.

## Confirmed Target

- Keep the departure heading, caption, text input and Save and continue button.
- Replace `Type to search (minimum 2 characters)` with `Start typing to display the list`.
- Add a downward arrow indicator separated from the input text by a vertical rule.
- The reference shows shared GOV.UK header, phase banner, Back link, language switcher and footer; these remain owned by the page layout and are unchanged.

## Implementation

- Retain the GOV.UK input macro, associated label, error message and description linkage.
- Reuse the existing Add gear `.app-autocomplete` styles through the input macro's wrapper and after-input options. No new visual assets or CSS tokens are needed.
- Keep existing caption-to-heading, heading-to-control, control-to-button and footer spacing. Exact screenshot spacing is not measured; spacing changes are outside this two-item correction.
- Preserve filtering, selection, minimum search length, submission and server validation. Assumption: the supplied gap table requests a visual dropdown indicator, not a new click-to-open interaction.

## Acceptance

- Default departure and return fields display the exact target placeholder and a visible arrow.
- Text has reserved space before the arrow at desktop and mobile widths.
- Filtering and selecting a port still work; selecting a result closes the list.
- Validation retains the red input border, inline error and error-summary link, with the arrow aligned to the input rather than the error message.
- Submitting a port already saved in the relevant Account or journey favourites list stays on Add port, preserves the entered value, and shows “[Port name] is already saved in your favourites” in the error summary and beside the field. The saved list remains unchanged (FR5).
- The arrow is decorative (`aria-hidden`, no pointer interception); the input remains labelled and keyboard accessible.

## GOV.UK Deviation

The bespoke autocomplete arrow is not part of the standard GOV.UK text input. It reuses the application's existing Add gear treatment to match the supplied design; no shared-shell or GOV.UK token changes are introduced.