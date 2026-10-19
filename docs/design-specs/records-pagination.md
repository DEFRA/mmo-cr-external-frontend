# Records Pagination Controls

- Source: user-supplied records-page comparison and close-ups of Next and the left arrow, read 2026-10-19.
- Scope: pagination controls on `/records`. Leave the table, page-number component, result count and paging rules unchanged.
- Next uses bold GOV.UK body typography, an underlined blue label and a separate grey right arrow. The arrow itself has no underline.
- Replace font-dependent arrow characters with the existing arrow icons from the installed GOV.UK pagination template. Both icons remain decorative, hidden from assistive technology and non-focusable.
- Use the same left-arrow treatment beside the bold result count. Recommended nearest GOV.UK spacing tokens: 4 between left arrow and summary, and 3 between Next and its arrow. Icon dimensions use spacing token 4 rather than screenshot-derived pixel measurements.
- Preserve actual previous/next page destinations and disabled non-link controls at the first/last page. Keep the blue Next label on the last page to follow the supplied visual design, with `aria-disabled` retained.
- Acceptance: matching typography and icon styling, enabled and disabled markup covered by tests, no mobile overflow and unchanged pagination navigation.
- Existing deviation retained: the result-count/previous/number/Next composition is bespoke rather than the stock GOV.UK pagination layout. No new assets or dependencies are introduced.