# Species Selection And Add Species

- Source: user-supplied screenshots, read 2026-10-19. No Figma node, version or measured spacing supplied.
- Scope: `/species-selection` and `/add-species?return=/species-selection`.

## Confirmed Content And Layout

- Species selection retains the New catch record caption, the question "What species did you catch using pots?" when pots is selected, the live-weight guidance and conversion-factor link, species checkboxes, Add/Remove species links and Save and continue.
- Keep conditional weight entry and existing validation. Derive the question's gear description from the same selected-gear data as the statistical-area pages; no gear selected produces a generic question rather than inventing pots.
- Add species shows "Add species to your vessel" followed by the actual selected vessel name on a separate line. Do not default to the fictional vessel OLGA when there is no selection.
- The existing shared layout owns the header, phase banner, Back/language navigation and footer. These are unchanged.

## Species Suggestions

- Replace the browser-native datalist popup with a list matching image 4: the same width as the input, attached directly beneath it, white rows, thin dark borders and blue/yellow focus styling.
- Use `accessible-autocomplete` from the GOV.UK team for filtering, keyboard navigation, selection and assistive-technology announcements. Keep suggestions hidden while the input is empty, including on focus. Show matches by name or code after at least one character is typed, and hide suggestions again when the query is cleared.
- Include the full species catalogue, including species already saved as favourites, in both autocomplete suggestions and the native select. Submitting an already-added species displays "This species has already been added." in the error summary and beside the field without adding it again, including when returning to Your account (FR5 / Scenario 2).
- Use inline placement and a scrollable maximum height so results never cover Save and continue or the footer. Unlike statistical-area results, species rows contain the species name and code only; do not invent area coordinates.
- Keep existing GOV.UK typography, spacing and two-thirds layout. The exact screenshot dimensions are not measured; reuse the nearby statistical-area list's 2.75rem minimum row height and 19.25rem maximum list height.

## Accessibility And Security

- Preserve the heading label, input/error relationship, visible focus and the original select as the successful form control. Without JavaScript, the native select and server-side submission still work.
- Render reference-data names as text, not trusted HTML. Clear a previously confirmed value when the query is edited.
- Bundle component CSS with the app stylesheet rather than relying on runtime style injection. Do not weaken CSP.

## Acceptance And Deviations

- Selected vessel name appears on its own heading line for different vessels, including names with spaces.
- Selected gear controls the species question, including error states.
- Filter, keyboard/mouse selection, Add species return navigation and the no-JavaScript fallback work.
- At desktop and mobile widths, suggestions align to the input and neither overflow nor overlap subsequent controls.
- The styled autocomplete is an enhancement beyond the standard GOV.UK select; its custom row borders/focus treatment follow the supplied design. This deviation is explicit; no shared-shell changes are made.

## Remove Species Vessel Heading (2026-10-19)

- Source: supplied Add/Remove species screenshots. OLGA is example content, not a default vessel.
- Remove species heading is "Remove species from vessel", followed by the user's selected vessel name on a separate block line. Include the same name in the document title.
- Add species retains "Add species to your vessel" and the selected vessel on a separate line.
- Both GET and validation-error responses must retain the chosen name and return navigation. With no vessel selected, show the heading without inventing a vessel name.
- No species-removal logic, checkbox styling, shared layout or spacing changes are required for this heading correction.