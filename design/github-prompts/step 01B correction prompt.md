# Correct Header Logo, Menu Alignment and Footer Border

## Objective

Apply only the following three visual corrections to the existing application shell:

1. Make the dot in the middle of the existing logo white.
2. Centre the main menu within the blue header area.
3. Change the footer top border to a thin grey line.

## Agent and Thinking Effort

**Agent:** `.github/agents/frontend-developer.agent.md`

**Thinking effort:** Low

The orchestrator agent is not required for this small, contained styling task.

## Critical Constraints

- Do not resize the logo.
- Do not replace or redesign the logo.
- Do not change any part of the logo except the colour of the middle dot.
- Do not change the height, colour, or overall structure of the blue header area.
- Do not change the menu content, labels, links, order, typography, or behaviour.
- Do not change footer content, spacing, typography, background, or layout.
- Do not modify routing, business logic, accessibility behaviour, localisation, or unrelated components.
- Do not refactor unrelated code.
- Do not add dependencies.

## Required Changes

### 1. Logo middle dot

Keep the existing logo at its current dimensions and position.

Change only the dot in the middle of the logo to white.

Before changing the implementation, inspect how the logo is rendered:

- If the logo is inline SVG, update only the relevant dot element's fill or stroke.
- If the dot is styled with CSS, update only the relevant dot selector.
- If the logo is an external image that cannot be selectively styled, identify the smallest appropriate existing asset-level correction without resizing or redesigning the logo.

Do not apply a global colour rule that changes other logo elements.

### 2. Main menu alignment

Centre the main menu horizontally inside the blue header area.

Requirements:

- Centre the menu relative to the full blue header area, not merely the space remaining beside the logo or other controls.
- Preserve the existing menu order, spacing between menu items, focus states, hover states, links, and responsive behaviour.
- Keep the menu vertically aligned within the header as shown in the supplied design reference.
- Prefer the existing layout system, flexbox, grid, or established project utilities.
- Do not use arbitrary offsets or negative margins to simulate centring.
- Ensure centring remains correct at supported desktop widths.
- Ensure the menu remains usable and does not overlap the logo or other header controls at narrower widths.

### 3. Footer top border

Change the footer top border to a thin grey line.

Requirements:

- Use the existing GOV.UK or project grey colour token where available.
- Use a thin border, normally `1px`, unless the repository's established thin-border token defines the equivalent.
- Apply the border only to the top of the footer.
- Preserve the footer's existing content, background, width, spacing, and layout.

## Design References

### Figma URL

```text
https://www.figma.com/design/9Jve7RKNprYeeaNYsbTUH1/MMO-Catch-Records?node-id=48-24445&t=ffkmqdjC5IXaXW7u-0
```

### PNG screen reference

Header
![Header](./../screens/Header.png)

Footer
![Footer](./../screens/footer.png)

Full layaut smple page
![Full layaut sample page](./../screens/SIgnIn.png)

Use the attached PNG as the primary visual reference for these corrections.

## Files to Inspect First

Inspect the existing implementation and identify the actual files responsible for:

- Header markup
- Logo markup or asset
- Main menu layout
- Header styles
- Footer markup
- Footer styles
- Existing component tests

Do not assume filenames and do not modify unrelated files.

## Testing and Verification

After making the changes:

1. Run the existing focused tests for the header, navigation, layout, and footer.
2. Confirm the logo dimensions have not changed.
3. Confirm only the middle dot in the logo is white.
4. Confirm the main menu is horizontally centred in the blue header area.
5. Confirm the menu does not overlap other header elements at supported widths.
6. Confirm keyboard navigation, focus styles, hover styles, and links still work.
7. Confirm the footer has a thin grey top border.
8. Confirm no other footer styling has changed.
9. Check the final result against the supplied PNG.
10. Report the files changed and the tests run.

## Acceptance Criteria

- [ ] The logo remains at its existing size and position.
- [ ] Only the logo's middle dot is changed to white.
- [ ] The main menu is centred within the blue header area.
- [ ] Menu content and behaviour are unchanged.
- [ ] The footer has a thin grey top border.
- [ ] Footer content and layout are unchanged.
- [ ] No unrelated changes are included.
- [ ] Existing relevant tests pass.

Do not make any changes beyond the three corrections described in this prompt.

If you reach any ambiguity ask me to clarify.
