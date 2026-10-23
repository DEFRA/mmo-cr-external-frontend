# Guidance Layout

## Source

- Source: user-supplied screenshot (fallback), read on 2026-10-21.
- Figma file: `9Jve7RKNprYeeaNYsbTUH1`, node `718:107548`.
- The Figma outline was accessible, but asset downloading failed with `ERR_NETWORK`.
- Figma version is unavailable. The latest screenshot supersedes the earlier two-line attribution reference.
- The screenshot labels its frame as 1728 by 863; its displayed image is scaled.
- The source image is attached to the conversation, not stored in the repository.

## Confirmed Visual Requirements

- Guidance caption, heading, introduction and contents share a left edge.
- The introduction has larger text than the attribution and contents.
- The divider is above the attribution and spans the full page content width.
- Department names are bold links on one desktop line.
- The grey England band fills the narrower introduction and contents column.
- Contents links have dash markers. The bordered print button has an icon and underlined blue text.
- All existing wording and destinations remain unchanged.

## Components And Ownership

- Shared layout retains ownership of header, navigation, language switcher and footer.
- The existing `appHeading` provides the caption and heading without local centring overrides.
- Page content uses GOV.UK grid rows: two-thirds introduction, full-width attribution, two-thirds remaining content.
- Typography uses `govuk-body-l`, `govuk-body-s` and `govuk-font(16)`.
- Existing semantic navigation, anchors and print button are retained; no new assets are needed.

## Spacing And Tokens

Recommended interpretations of the scaled screenshot, not measured Figma values:

- Attribution top padding: spacing 4; bottom margin: spacing 8.
- England band padding: spacing 4 vertically and spacing 3 horizontally; bottom margin: spacing 4.
- Contents bottom margin: spacing 4; print button bottom margin: spacing 6.
- Follow-up section screenshots: section headings use spacing 9 above and spacing 6 below; the warning uses spacing 9 above and below. These are GOV.UK-token interpretations of the visible gaps, not exact Figma measurements.
- Colours use existing GOV.UK link, white and black-tint tokens.

## Responsive Behaviour And Accessibility

- At mobile widths, grid columns become full width and department links wrap naturally.
- No fixed text heights or nowrap rules; no horizontal scrolling at 375px.
- Existing heading structure, link focus treatments and keyboard-operable print behaviour remain intact.
- Navigation and content remain server-rendered without JavaScript; printing retains its existing enhancement.
- No new loading, empty, error or validation states are introduced.
- No security configuration, external integration or personal data changes.

## Acceptance Checks

- Desktop: heading and attribution share their left edge; attribution links occupy one line each.
- Divider is above the attribution; England band spans the two-thirds column.
- Mobile: all content stays within the viewport and attribution wraps without clipping.
- Existing guidance route tests and Sass lint pass.

## Design System Deviations

The bespoke England band, dash-prefixed contents list and bordered print control are existing page-specific components. This correction retains them and uses GOV.UK typography, colour and spacing tokens; it introduces no new component pattern.