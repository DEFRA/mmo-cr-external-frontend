---
description: 'Accessibility standards (WCAG 2.2 AA, DEFRA/GDS legal requirement) for the MMO Catch Recording external web frontend. Use when building UI, reviewing Nunjucks templates/GOV.UK Frontend components, or auditing keyboard, screen-reader, contrast and focus support.'
applyTo: 'src/**/*.njk, src/**/*.js, src/client/**/*.scss'
---

# Accessibility standards (legal requirement)

Meeting accessibility is a **legal requirement** for DEFRA services under the Public Sector Bodies
(Websites and Mobile Applications) Accessibility Regulations 2018 and the Equality Act 2010. The service
**must meet [WCAG 2.2 level AA](https://www.gov.uk/service-manual/helping-people-to-use-your-service/understanding-wcag)**
and work with common assistive technologies. This applies even to internal/staff-facing pages.

References: [DEFRA accessibility](https://digital.defra.gov.uk/accessibility) ·
[GDS testing for accessibility](https://www.gov.uk/service-manual/technology/testing-for-accessibility) ·
[GOV.UK Design System — accessibility](https://design-system.service.gov.uk/accessibility/).

## Build accessibility in from the start

Consider it at every stage (design → markup → test), not as a retrofit. Use the **GOV.UK Design System**
components and patterns — they are built and tested for accessibility. Do not hand-roll markup a GDS
component already provides, and don't override it in ways that break its behaviour.

## Progressive enhancement

- The core journey must work with **HTML alone**; layer CSS and JavaScript on top. Never make a page
  depend on client-side JavaScript to function. Server-side validation must exist even when client-side
  validation is added.

## Structure & semantics

- Use **semantic HTML** (`<button>`, `<a>`, `<label>`, `<fieldset>`/`<legend>`, lists, tables with headers)
  and correct landmarks. One `<h1>` per page; heading levels in order with no gaps.
- Every page has a descriptive, unique `<title>` and a visible page heading. Set the page language.
- Use the GOV.UK page template, skip link, and back link where appropriate.

## Forms & errors

- Every input has a programmatically associated `<label>` (or `<legend>` for grouped inputs). Use hint text
  and `aria-describedby` where helpful.
- On validation failure use the **GOV.UK error summary** at the top (focused on load), with in-field error
  messages linked to their inputs; describe how to fix the problem. Never convey the error by colour alone.
- One question/thing per page where the GDS pattern calls for it; group related fields with fieldsets.

## Colour, contrast & focus

- Contrast meets WCAG AA — **4.5:1** for normal text, **3:1** for large (≥18pt / bold ≥14pt) text and
  meaningful UI/graphics. Use GOV.UK Frontend colours, which meet AA.
- **Never rely on colour alone** — pair with text, icon or shape.
- **Focus is always visible** (keep the GOV.UK focus style); do not remove outlines. Focus order is logical.

## Keyboard & assistive tech

- Everything is operable by **keyboard alone**, in a logical order, with no traps. Provide a skip link.
- Custom interactive widgets (only where a GDS component doesn't exist) expose correct roles/states/names
  and keyboard behaviour; prefer native elements first.
- Respect `prefers-reduced-motion`; avoid auto-playing motion and time-boxed auto-dismissing content.

## Nunjucks/GOV.UK checklist

- [ ] GOV.UK Frontend components used for forms, buttons, error summary, tables, navigation.
- [ ] Semantic HTML and correct heading order; one `<h1>`; descriptive `<title>`.
- [ ] All inputs have associated labels; errors use the GOV.UK error summary + in-field messages.
- [ ] Contrast meets AA; focus is visible; no meaning by colour alone.
- [ ] Fully keyboard operable; logical tab order; skip link present.
- [ ] Works with JavaScript disabled (progressive enhancement); enhancements degrade gracefully.
- [ ] `prefers-reduced-motion` respected.

## Testing (do both automated and manual)

- **Automated:** run axe-core / Lighthouse / pa11y against key pages; assert accessible markup in Vitest
  where practical (labels, roles, error-summary links). Keep the DEFRA SonarCloud gate green.
- **Manual:** operate the whole journey by **keyboard only**; test with a **screen reader** (VoiceOver /
  NVDA); verify with **JavaScript disabled**; check zoom to 400% and 200% text spacing.
- Get a **formal accessibility audit and fix issues before public beta**, and publish an accessibility
  statement. See the [web-accessibility-audit skill](../skills/web-accessibility-audit/SKILL.md).
