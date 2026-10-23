# Check Answers: Gear Used

## Read-Only Submitted-Record Layout (2026-10-22)

- This update supersedes the earlier editable review requirements below. The user explicitly approved making `/check-answers` fully read-only, including removing submission.
- Reuse `record-details/index.njk`, the template used by `/records/submitted-1`, directly through the view controller. Preserve the two-thirds content column, record reference, vessel heading, GOV.UK summary-list styling and section order: Trips details, Gear used, Species caught, Species not landed.
- Data comes from the current journey, not the example submitted record. Keep every gear's measurements, statistical area, species and individual weights, including zero values and repeated species. Multiple gears are identified within the existing four-section structure.
- The default record is tested for exact row order and value formatting against `/records/submitted-1`. Do not add unrecorded example mesh measurements.
- No Change, Edit, Update, Download or submit controls are rendered in the review content. The shared summary component strips row actions when read-only rendering is enabled, even if a future model supplies them.
- The declaration and submission warning are removed. `/check-answers` accepts GET only; POST is rejected. No submission or answer modification occurs from the page.
- Back goes to `/records`, not an editable journey step. Incomplete answers can be reviewed without an automatic redirect to a form. Shared application navigation remains unchanged.
- Do not mark an unsubmitted journey as Submitted. Existing stored-record status display and edit/download controls on actual record-detail routes remain unchanged.
- Verification covers source-view formatting parity, all captured multi-gear data, duplicate species weights, visible Yes/No answers, removed controls, rejected POST, and the rendering guard. Existing editable record routes remain independently tested.

- Source: user-supplied Gear used screenshot, read 2026-10-19. No Figma version or measured spacing supplied.
- Scope: the Gear used section on `/check-answers`; other sections and the shared page layout remain unchanged.
- Use the existing GOV.UK heading and summary-list component: bold labels, values in the middle, right-aligned Change actions and thin horizontal separators.
- For pots, keep row order: Gear type; Total pots or traps hauled; Total pots or traps left in water; Mesh size.
- Gear labels and counts come from the journey, not hard-coded screenshot content. The screenshot's Pot, 7 and 5 are example values; catalogue names such as Pots are retained.
- Mesh sizes use `50 mm` formatting. Prefer the trip's saved gear mesh measurement, then its saved favourite measurement, then a catalogue mesh hint. The existing illustrative pots value remains the fallback when no mesh measurement is available.
- Each Change action points to `/gear-selection?return=/check-answers`, retaining its row-specific accessible label.
- Acceptance: verify row order and values, saved mesh measurement precedence, all Change destinations and responsive display. No bespoke CSS or new GOV.UK design-system deviation is introduced.

## Four-Section Review Update (2026-10-22)

- Source: four user-supplied screenshots in the conversation, with explicit implementation approval. The earlier gear-only scope is superseded for `/check-answers`; summaries on other pages retain their existing behaviour.
- Title: Check your details. Caption: New catch record.
- Section 1: Trips details, ordered Vessel, Date left, Port left from, Date returned, Port returned to, Gear used. Vessel has no Change action, matching the reference. Gear names appear on separate lines.
- Section 2: Gear, with one subheading per selected gear. Area and selected species precede the saved measurements; the number of times shot precedes dimensions.
- Section 3: Species caught, with a separate weight block for each gear/species pair. Do not deduplicate a species caught using different gears. Preserve individual weights, including zero. Unit labels are on the keys, not repeated after values.
- Section 4: Species not landed, including Catch kept onboard or in keep pots. A saved false answer displays No; saved true answers retain their species details. Do not replace saved answers with screenshot example values.
- Change actions preserve `return=/check-answers`. Area and species changes retain the corresponding gear ID; weight and measurement links target the relevant input field. Existing change-loop navigation and validation remain in place.
- Final-section screenshot update: the declaration is a bold GOV.UK warning, followed by "By submitting your catch record, you're confirming:" and three bullets covering accurate landed weights, permitted tolerance levels and possible action for inaccurate recording. Spacing 9 separates the warning, confirmation list and Accept and submit trip details button. The existing POST-to-confirmation flow is unchanged; no new persistence or submission API is introduced.
- Confirmed layout: existing two-thirds content column, numbered `h2` sections, `h3` gear/species headings, GOV.UK summary lists with right-aligned Change links. Shared header, navigation and footer remain owned by the layout.
- Spacing interpretation: GOV.UK spacing 8 before major sections, spacing 6 between repeated groups, spacing 6 below major section headings. These are token-based interpretations of scaled screenshots, not measured Figma values.
- Accessibility: heading hierarchy is maintained, repeated species blocks have hidden gear context, and every Change action retains a descriptive accessible label. Text and list values are escaped before rendering. The warning's fallback label is visually hidden rather than showing the screenshot's joined WarningBy text.
- Assets: none added. No new colour tokens or bespoke visual component patterns are introduced.
- Verification: model tests cover row order, duplicate species, separate weights, zero measurements and the saved No answer. Journey tests exercise Change destinations, field anchors, edit return paths and gear isolation. Browser checks cover desktop/mobile wrapping and overflow.