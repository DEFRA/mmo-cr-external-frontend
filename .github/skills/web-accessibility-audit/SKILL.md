---
name: web-accessibility-audit
description: 'Audit and validate the MMO Catch Recording external web frontend against WCAG 2.2 AA and GOV.UK Design System accessibility guidance (a DEFRA legal requirement). Use to review Nunjucks pages/GOV.UK Frontend components for keyboard operability, screen-reader support, semantic structure, contrast, focus and progressive enhancement, and to prepare for a formal audit before public beta.'
argument-hint: "e.g. 'audit the Add Catch page for accessibility'"
user-invocable: false
---

# Web accessibility audit

Accessibility is a **legal requirement** for DEFRA services (WCAG 2.2 AA). Use this skill to check code and
running pages, following the [accessibility instructions](../../instructions/accessibility.instructions.md).

## When to use

- Reviewing a new/changed Nunjucks page or component.
- Preparing for the **formal accessibility audit required before public beta**.
- Diagnosing a reported accessibility issue.

## Procedure

### 1. Static code review (per page/template)

Check the markup for:

- [ ] **GOV.UK Frontend components** used for forms, buttons, error summary, tables, navigation (not
      hand-rolled).
- [ ] **Semantic HTML** and correct landmarks; one `<h1>`; heading levels in order; descriptive unique
      `<title>`; page language set.
- [ ] Every input has an associated `<label>` (or `<legend>` for groups); hints via `aria-describedby`.
- [ ] Validation uses the **GOV.UK error summary** (focused on load) with in-field messages linked by `id`,
      describing how to fix; error not conveyed by colour alone.
- [ ] **Contrast** ≥ 4.5:1 (normal) / 3:1 (large/UI); GOV.UK colours used.
- [ ] Meaning never conveyed by **colour alone** (add text/icon/shape).
- [ ] **Focus is visible** (GOV.UK focus style not removed); logical tab order; skip link present.
- [ ] Fully **keyboard operable**, no traps; native elements preferred over custom widgets.
- [ ] **Works with JavaScript disabled** (progressive enhancement); enhancements degrade gracefully.
- [ ] `prefers-reduced-motion` respected; no auto-dismissing/time-boxed content.

### 2. Automated checks

- Run **axe-core**, **Lighthouse** and/or **pa11y** against each key page.
- Add/extend Vitest assertions on rendered HTML (`cheerio`) that labels are associated, the error summary
  links to fields, and key landmarks/headings exist.
- Run linters and the DEFRA SonarCloud gate.

### 3. Manual assistive-technology testing

- Operate the whole journey by **keyboard only**; verify focus order, visible focus and no traps.
- Test with a **screen reader** (VoiceOver / NVDA); verify labels, roles, and error announcements.
- Test with **JavaScript disabled**; confirm the core journey still works.
- Check **400% zoom** and **200% text spacing**; verify no loss of content/function.
- Test on current + latest major browsers per DEFRA/GDS browser support.

### 4. Report & fix

- List issues by WCAG success criterion with severity and a concrete fix.
- Fix, then re-run the checks. Track residual items.
- Before public beta: obtain a **formal accessibility audit**, fix issues, and publish an
  **accessibility statement**.

## Output format

Produce a short report:

- **Summary** (pass/fail against WCAG 2.2 AA).
- **Findings** table: element → criterion → severity → recommended fix.
- **Validation**: which automated/manual checks were run and their results.
- **Follow-ups**: anything deferred, with rationale.
