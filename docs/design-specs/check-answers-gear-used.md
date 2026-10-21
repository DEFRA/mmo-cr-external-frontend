# Check Answers: Gear Used

- Source: user-supplied Gear used screenshot, read 2026-10-19. No Figma version or measured spacing supplied.
- Scope: the Gear used section on `/check-answers`; other sections and the shared page layout remain unchanged.
- Use the existing GOV.UK heading and summary-list component: bold labels, values in the middle, right-aligned Change actions and thin horizontal separators.
- For pots, keep row order: Gear type; Total pots or traps hauled; Total pots or traps left in water; Mesh size.
- Gear labels and counts come from the journey, not hard-coded screenshot content. The screenshot's Pot, 7 and 5 are example values; catalogue names such as Pots are retained.
- Mesh sizes use `50 mm` formatting. Prefer the trip's saved gear mesh measurement, then its saved favourite measurement, then a catalogue mesh hint. The existing illustrative pots value remains the fallback when no mesh measurement is available.
- Each Change action points to `/gear-selection?return=/check-answers`, retaining its row-specific accessible label.
- Acceptance: verify row order and values, saved mesh measurement precedence, all Change destinations and responsive display. No bespoke CSS or new GOV.UK design-system deviation is introduced.