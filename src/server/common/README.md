# Server common work

For common work that is Server specific

## Application shell and shared page layout

The base layout at [layouts/page.njk](templates/layouts/page.njk) extends the GOV.UK Frontend
`govuk/template.njk` and provides the shared shell every route view builds on: header, left-aligned
`govukServiceNavigation`, Beta phase banner, a pre-main navigation row, skip link, single `main`
landmark, and footer.

### Visual Source of Truth

Step 01 (Application Shell) was built against the references recorded in
[github-prompts/01-common-layout-foundation-plan.md](../../../github-prompts/01-common-layout-foundation-plan.md)
(Figma URL + PNG screenshots under `design/screens/`). Refer back to that plan rather than re-fetching the
design when working on the shell.

### Extending the layout

Route views `{% extends 'layouts/page.njk' %}` and override `{% block pageContent %}` (not
`{% block content %}`) with their page-specific markup. `content` itself is owned by the shared layout and
nests, in order: an optional `notification` block, an optional `errorSummary` block, then `pageContent`.

### Optional Back link

A route can supply a page-specific GOV.UK Back link via the view context:

```js
return h.view('about/index', {
  pageTitle: 'About',
  heading: 'About',
  backLink: { href: '/', text: 'Back' }
})
```

The Back link renders in the shared `page-navigation` component
([components/page-navigation](components/page-navigation)), in the pre-main row **above** `main`, not in
the header — this keeps it page-specific (it can vary per screen or be omitted entirely, e.g. on `home`)
while the header/service navigation stay identical across every page. When no `backLink.href` is supplied,
no Back link or empty placeholder is rendered.

### Pre-main row responsiveness

The pre-main row (`.app-page-navigation`) is a flex row: the optional Back link sits on the left, the
language selector is pushed to the right with `margin-left: auto`. At mobile widths the language selector
wraps onto its own line with GOV.UK spacing tokens — no absolute positioning or fixed pixel values are used.

### Language selector (non-functional integration point)

The language selector in `page-navigation` is a **non-switching integration point** for a future
localisation step. `English` renders as plain text (not a link) for the current language; `Cymraeg` renders
as a link that preserves the current route path with a `?lang=cy` query parameter
(`src/config/nunjucks/context/context.js`, `buildLanguageToggle`). No translation catalogue or real
switching is implemented — do not treat this as operational bilingual support.

### Error summary and notification banner

Supply `errorSummary` (GOV.UK `govukErrorSummary` params) and/or `notification` (GOV.UK
`govukNotificationBanner` params) in the view context to render them above `pageContent`. Neither renders
when not supplied — an empty error/notification region is never announced to assistive technology.

## Mock-data layer (walkthrough-only)

Routes source their placeholder content from `src/server/common/data/` via the single accessor
`getData(pageName)` in [data/get-data.js](data/get-data.js). This data exists **only to support the
frontend walkthrough** — it is fictional, non-persistent, and not read from or written to any backend.

Supported keys: `service`, `account`, `allRecords`, `catchRecordDetails`, `selectVessel`, `tripDates`,
`ports`, `gearSelection`, `potsDetails`, `statisticalAreas`, `alternativeStatisticalAreaExample`,
`speciesSelection`, `speciesWeights`, `catchNotLanded`, `confirmation`.

Calling `getData` with a key not in this list throws an `Error` naming the unknown key — it does not leak
file paths or stack details.

Each call returns a `structuredClone` of the underlying data, so mutating a returned value never affects
the source constant or any later call to `getData`.

To add or edit a mock value, edit the relevant file under `src/server/common/data/` and, if adding a new
key, register it in the `dataByKey` map in `get-data.js`. **No real personal data or secrets may be added
to this layer** — only clearly fictional placeholder content.

### Tests verifying the shell

- [components/page-navigation/template.test.js](components/page-navigation/template.test.js) — Back link
  and language selector rendering/accessibility in isolation.
- [../routes/home/controller.test.js](../routes/home/controller.test.js) — shell rendering with no Back
  link, skip link, single `main`, footer, page title, empty error/notification state.
- [../routes/about/controller.test.js](../routes/about/controller.test.js) — shell rendering with a Back
  link present.
- [../config/nunjucks/context/context.test.js](../../config/nunjucks/context/context.test.js) and
  [../config/nunjucks/context/build-navigation.test.js](../../config/nunjucks/context/build-navigation.test.js) —
  context and navigation data feeding the shell.
