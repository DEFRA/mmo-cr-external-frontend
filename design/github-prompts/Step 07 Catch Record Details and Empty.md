# Step 07: Catch Record Details and Empty Page

## 1. Title

Catch Record Web UI: Step 07 - Implement Catch Record Details and the Empty Page State

## 2. Recommended Agent Workflow

Use only the agents required for this task.

### Planning

**Agent:** `.github/agents/frontend-planner.agent.md`

**Thinking effort:** High

The planning agent must inspect the existing application, the approved plans from earlier steps, and the supplied design references before proposing changes.

The planning agent must:

1. Identify the existing route, controller, view-model, Nunjucks, service, fixture, and test patterns used by the Catch Record area.
2. Identify how authenticated account and vessel context is currently provided.
3. Confirm whether the empty page means that no catch-record details have yet been added to the current draft.
4. Map every visible heading, label, action and information block in the supplied PNG.
5. Define the route and view-model contract for the empty state and the populated state that later steps will extend.
6. Define how the primary action starts or resumes the catch-record journey.
7. List the exact files to create or modify.
8. Define unit, integration, accessibility and manual-verification coverage.
9. Record any ambiguity that would affect implementation.
10. Stop after producing the plan and wait for approval.

After approval, save the approved plan to:

```text
design/plans/07-catch-record-details-empty-page.md
```

### Implementation

**Agent:** `.github/agents/frontend-developer.agent.md`

**Thinking effort:** Medium

Use High thinking effort only if repository inspection finds that this step requires significant changes to journey state, route composition or shared data-access behaviour.

The implementation agent must:

1. Read the approved plan.
2. Implement only the approved Step 07 scope.
3. Reuse the common layout and components created by earlier steps.
4. Add or update the required tests.
5. Run focused checks and report the outcomes.

### Review

**Agent:** `.github/agents/frontend-code-reviewer.agent.md`

**Thinking effort:** Medium

The reviewer must check the result against this prompt, the approved plan, the PNG reference, existing repository conventions, GOV.UK patterns and accessibility requirements.

Classify findings as:

```text
Blocking
Important
Suggestion
```

### Orchestrator

Do not use `.github/agents/frontend-orchestrator.agent.md` for this task unless planning proves that multiple independent technical domains require coordination. A normal page, route and test implementation does not require the orchestrator.

## 3. Objective

Implement the Catch Record Details page in its initial empty state.

The page must provide a clear starting point for a user who has opened or created a catch record but has not yet added the details required to complete it. The page must use the existing common application shell and provide an accessible route into the next step of the catch-record journey.

## 4. Design References

### Figma page URL

```text
https://www.figma.com/design/9Jve7RKNprYeeaNYsbTUH1/MMO-Catch-Records?node-id=48-26598&t=ffkmqdjC5IXaXW7u-0
```

### PNG screen reference

![Catch record details](./../screens/CatchRecordsForVessel.png)

The attached PNG is the primary visual reference because the Figma connection may be unreliable.

When references differ, use this precedence:

1. Explicit requirements in this prompt.
2. Approved Step 07 plan.
3. Existing application architecture and earlier approved shared-layout implementation.
4. Attached PNG for visible content, hierarchy, positioning and spacing.
5. Figma page for supplementary design detail.
6. GOV.UK Design System guidance and established project conventions.

Do not invent text, data, actions or business rules that are not visible in the reference or established in the repository.

## 5. Background Context

The Catch Record Web UI allows an authenticated user to create, complete, review and submit a catch record.

Earlier implementation steps establish the common application shell and the routes needed to reach this page. This step introduces the Catch Record Details page and its empty state. Later prompts will add the individual data-capture sections and the populated summary state.

The implementation must therefore establish a stable page, route and view-model structure without prematurely implementing vessel, trip, skipper, gear, statistical-area, species, weight, not-landed-catch or submission functionality.

## 6. Critical Constraints

1. Implement only the Catch Record Details page and its empty state.
2. Do not implement the later catch-data forms in this step.
3. Do not add fields, labels, links, cards, status values or actions that are not supported by the supplied design or existing requirements.
4. Do not redesign the common header, navigation row, language selector, footer or shared layout.
5. Do not move the Back link into the header.
6. Use an explicit server-side Back link destination through the existing layout contract.
7. Do not use `window.history.back()` as the default Back link implementation.
8. Do not alter authentication, infrastructure, database schemas, deployment configuration or unrelated routes.
9. Do not introduce new dependencies unless the approved plan demonstrates an essential need.
10. Do not create a second page shell or duplicate existing shared components.
11. Do not use JavaScript where server-rendered HTML provides the required behaviour.
12. Do not use placeholder production data.
13. Do not make the empty state depend solely on the visual absence of content. Represent the state explicitly in the view model or existing domain model.
14. Do not implement the populated Catch Record Details state beyond the minimum extension points approved in the plan.
15. Do not make unrelated refactors.

## 7. Required Outcome

After this task:

1. A user can navigate to the Catch Record Details route using the existing application journey.
2. The route renders the Catch Record Details page using the shared application shell.
3. The page displays the exact empty-state content and action shown in the supplied PNG.
4. The page has a single clear `<h1>`.
5. The Back link appears in the shared pre-main navigation region when the design calls for it.
6. The English/Cymraeg control continues to use the shared implementation.
7. The empty state is driven by an explicit server-side state or view-model condition.
8. The primary action links to the correct next route or existing placeholder route established by the approved plan.
9. The page behaves correctly when the user does not have catch-record details yet.
10. The implementation provides a clean extension point for a future populated details state without rendering unfinished sections now.
11. Relevant tests pass.
12. The page meets WCAG 2.2 AA expectations and established accessibility instructions.

## 8. Scope

### In scope

- Repository inspection for existing catch-record patterns
- Catch Record Details route or refinement of an existing route
- Controller or route-handler logic required to render the page
- Explicit empty-state view-model data
- Nunjucks page template
- Exact empty-state text and action from the supplied PNG
- Shared Back link configuration, when shown by the design
- Shared application shell integration
- GDS component selection
- Responsive layout and spacing
- Route, rendering, integration and accessibility tests
- Minimal developer documentation if a new page-state contract is introduced
- The button Download PDF should be a dummy button that do nothing

### Out of scope

- Vessel-selection implementation
- Trip-date or port forms
- Skipper forms
- Gear forms
- Statistical-area selection
- Species selection
- Landed or not-landed weight capture
- Check Your Answers
- Submission
- Confirmation
- Populated catch-record summary sections, unless an existing implementation only needs to remain functional
- Data persistence changes
- API redesign
- Authentication changes
- Figma API integration
- Header or footer redesign
- New navigation architecture
- download pdf functionality

## 9. Repository Inspection

Before planning, inspect and report on:

1. The current Catch Record routes and route naming.
2. Existing controllers or handlers for record views and drafts.
3. Existing domain, fixture or session state used to identify a catch record.
4. Existing Nunjucks page and component conventions.
5. How the shared shell receives `pageTitle`, `backLink`, language and error data.
6. Existing GOV.UK Frontend macros and project wrappers.
7. Existing empty-state patterns elsewhere in the application.
8. Existing button, link, inset-text, panel or summary-list patterns.
9. Existing test helpers and accessibility test setup.
10. Existing URL conventions for record identifiers.
11. Existing authorisation checks for viewing a catch record.
12. Any conflict between the design reference and the current route or data model.

Do not assume filenames. Find the actual implementation paths.

## 10. Target User Flow

Implement the approved equivalent of this logical flow:

```text
Previous records or draft-record step
  -> Catch Record Details
     -> Empty state displayed
        -> User activates the primary action
           -> Next approved catch-record step
```

The exact source route, destination route and primary-action wording must come from the supplied design and current journey definition.

If the destination page is scheduled for a later prompt and no route exists yet, follow the repository's approved incremental-delivery approach. Do not invent a production route silently. Record the dependency in the plan.

## 11. Page Content and Hierarchy

Transcribe and implement the visible content from the attached PNG exactly, subject to approved Welsh or English content handling.

The page should normally contain:

1. Shared header and service navigation.
2. Shared phase banner if already part of the common shell.
3. Shared pre-main navigation row.
4. Optional Back link on the left.
5. Shared language selector on the right.
6. Main content region.
7. Catch Record Details page heading.
8. Empty-state explanation shown by the design.
9. One clear primary action or start/resume action shown by the design.
10. Shared footer.

Do not assume that all items above are visible if the supplied PNG shows otherwise. The PNG determines visible page-specific content.

## 12. GDS Component Recommendations

Use the exact component that best matches the supplied design and existing application patterns.

### Page heading

Use GOV.UK heading classes, normally:

```text
govuk-heading-xl
```

Use a smaller level only if the PNG and existing page hierarchy clearly require it.

### Introductory or empty-state text

Use:

```text
govuk-body
```

Use `govuk-body-l` only if the design clearly presents lead text.

### Primary action

Use the GOV.UK Button component if the design presents a primary action as a button:

```text
govukButton
```

If the design presents the action as a normal text link, use a GOV.UK link instead. Do not convert a link into a button or a button into a link merely by visual preference.

### Back link

Use the shared GOV.UK Back Link implementation from the application shell. The route supplies the explicit destination.

### Empty-state container

Prefer normal semantic headings, paragraphs and actions in the content column. Do not introduce a card, panel or inset solely to create an empty-state appearance unless the PNG shows that treatment or the repository already defines it.

### Future detail sections

Do not render empty Summary Lists for content that has not been added. Later populated states may use GOV.UK Summary List components, but this empty state must not expose blank rows.

## 13. Positioning and Spacing

Match the attached PNG while using GOV.UK spacing tokens and established project utilities.

Requirements:

1. Use the same `govuk-width-container` alignment as the common shell.
2. Keep the Back link and language selector in the shared pre-main region.
3. Align the main page heading to the left edge of the main content column.
4. Use a readable content width. Prefer the existing two-thirds content column if that matches the PNG and project pattern.
5. Position the empty-state explanation directly beneath the page heading using GOV.UK vertical spacing.
6. Position the primary action beneath the explanatory content with clear separation.
7. Do not centre the page content unless the PNG explicitly shows centred content.
8. Do not use fixed page heights or large empty margins to force footer placement.
9. Keep the footer in normal document flow.
10. Use responsive spacing tokens rather than arbitrary pixel values.
11. Preserve the corrected header and footer styling from previous steps.
12. Do not change the logo, centred header menu or thin grey footer border.

The planning agent must identify the exact existing classes, macros or Sass utilities used for:

- Content width
- Heading bottom spacing
- Empty-state paragraph spacing
- Primary-action spacing
- Main content top and bottom spacing

## 14. Route and View-Model Requirements

Follow existing repository conventions.

The route or controller should provide only the data needed by the template, including the approved equivalent of:

```text
pageTitle
language
backLink
catchRecord identifier or safe reference
isEmpty
primaryAction
```

Property names must follow the existing application conventions.

Requirements:

1. Determine `isEmpty` from existing domain, fixture, service or session state rather than from template-side guesswork.
2. Do not put business logic in the Nunjucks template.
3. Do not expose sensitive internal identifiers if the existing application uses public or opaque record references.
4. Ensure the current user is authorised to view the requested catch record through the existing mechanism.
5. Handle a missing or invalid catch record using the current application error pattern.
6. Do not create a new persistence layer for this step.
7. Keep the contract extensible for later populated details without adding unused fields now.

## 15. Navigation Requirements

### Back link

- Use the shared pre-main Back link slot.
- Supply an explicit internal URL.
- Return the user to the correct prior screen in the journey.
- Preserve relevant journey state through the existing server-side mechanism.
- Do not use browser history as the default.

### Primary action

- Use the exact label shown in the PNG.
- Link or submit to the approved next journey route.
- Preserve the current catch-record context.
- Use a link when navigation is safe and idempotent.
- Use a form submission only when the action creates or mutates server-side state.
- Do not create duplicate draft records when the user refreshes or activates the control twice.

### Language selector

- Reuse the shared English/Cymraeg implementation.
- Keep the user on the equivalent Catch Record Details route.
- Preserve the record context.
- Do not reimplement the selector in this page template.

## 16. Empty-State Behaviour

The page is in the empty state when the current catch record has no details that qualify for the populated details view according to the existing or approved domain rule.

Requirements:

1. Render the approved empty-state text.
2. Render the approved primary action.
3. Do not render blank detail rows.
4. Do not render empty Summary Lists.
5. Do not render fake example data.
6. Do not render a success, warning or error state merely because no details exist.
7. Ensure assistive-technology users encounter the page heading, explanation and action in a logical order.
8. Ensure the page remains useful if CSS or client-side JavaScript does not load.

If the repository lacks a defined rule for when a catch record is empty, the planning agent must flag the ambiguity rather than inventing the business rule.

## 17. Error Handling Requirements

Use existing application error handling for:

- Missing record
- Invalid record identifier
- Record not accessible to the current user
- Failure to retrieve record state
- Invalid or unavailable next-step route

Requirements:

1. Do not expose stack traces or internal record identifiers.
2. Do not treat a retrieval failure as an empty record.
3. Do not silently create a replacement record.
4. Use the existing not-found, forbidden and service-error patterns.
5. Log failures according to current project conventions without logging sensitive record data.

## 18. Security Requirements

1. Preserve existing authentication and authorisation controls.
2. Verify that the requested record belongs to, or is accessible by, the current account using existing logic.
3. Escape all dynamic text through standard Nunjucks behaviour.
4. Do not trust route parameters directly in links or markup.
5. Use existing URL-generation helpers where available.
6. Do not expose internal database keys if the application uses a safer public identifier.
7. Do not add client-side record data that is not required for rendering.
8. Preserve existing CSRF protections if the primary action requires a form submission.

## 19. Accessibility Requirements

Meet WCAG 2.2 AA and `.github/instructions/accessibility.instructions.md`.

Verify:

1. The browser title identifies the Catch Record Details page and service.
2. The page contains one primary `<h1>`.
3. Heading order is logical.
4. The skip link targets the main content.
5. The main content has one landmark.
6. The Back link has a clear destination and accessible name.
7. The primary action has descriptive visible text.
8. The page does not announce blank regions or empty lists.
9. Focus order follows the visible order.
10. Focus indicators remain visible.
11. Content works at 200% and 400% zoom.
12. Content reflows at 320 CSS pixels without inappropriate horizontal scrolling.
13. The empty state does not rely on colour or position alone.
14. English and Cymraeg page-language attributes continue to work through the shared layout.
15. The page remains understandable without CSS or JavaScript.

Use `.github/skills/web-accessibility-audit/` where appropriate.

## 20. Responsive Requirements

Validate at least:

```text
320px
768px
1024px
1440px
```

Confirm:

- Heading and content remain aligned.
- Text does not clip or overflow.
- Primary action remains visible and usable.
- Back link and language selector do not overlap.
- No inappropriate horizontal scroll appears.
- The footer remains in normal flow.
- Spacing remains consistent with the attached PNG and GOV.UK responsive tokens.

## 21. Testing Requirements

Follow `.github/instructions/testing.instructions.md` and use `.github/skills/unit-tests/` where relevant.

### Unit and rendering tests

Cover at minimum:

1. The route builds the correct page title.
2. The template extends the common layout.
3. The empty-state heading is rendered.
4. The exact approved empty-state text is rendered.
5. The approved primary action is rendered once.
6. The primary action uses the expected destination.
7. The Back link uses the expected explicit destination when required.
8. No blank detail Summary List is rendered.
9. No fake catch data is rendered.
10. The language selector is supplied by the common shell rather than duplicated.
11. Undefined optional page data does not produce an empty or broken element.

### Route or controller tests

Cover at minimum:

1. An authorised request for an empty catch record returns the expected page.
2. The correct empty-state view model is passed to the template.
3. A missing record follows the existing not-found behaviour.
4. An inaccessible record follows the existing authorisation behaviour.
5. A service retrieval failure is not displayed as an empty record.
6. Existing catch-record routes remain stable.

### Integration tests

Where supported by the project:

1. Navigate from the approved prior step to Catch Record Details.
2. Confirm the page renders in the empty state.
3. Activate the primary action.
4. Confirm the user reaches the approved next route with record context preserved.
5. Use the Back link and confirm the correct previous page is reached.
6. Switch language and confirm the equivalent page and record context are retained.

### Accessibility tests

Run the existing automated accessibility checks against the empty state and verify no new blocking issue.

Do not rely on snapshots alone. Assert semantic structure, visible content and navigation behaviour explicitly.

## 22. Documentation Requirements

If this step introduces a new Catch Record Details view-model or page-state convention, add concise documentation covering:

- The route and template purpose
- How the empty state is determined
- How the primary action destination is supplied
- How later populated states should extend the page
- Tests covering the page

Do not duplicate general project or GOV.UK documentation.

## 23. Files and Areas to Inspect First

Inspect actual paths for:

```text
.github/copilot-instructions.md
.github/instructions/
.github/skills/
design/plans/
src/
test-helpers/
package.json
```

Within the application, locate:

- Shared base layout
- Catch Record routes
- Relevant controllers or handlers
- Catch-record services or fixtures
- Existing Nunjucks templates and macros
- Existing localisation utilities
- Existing authorisation middleware
- Existing unit and integration tests
- Existing accessibility-test setup

The planner must name the actual files after inspection.

## 24. Suggested Files to Modify

Likely areas include:

- Existing Catch Record route configuration
- Existing or new Catch Record Details controller/handler
- Existing or new Catch Record Details Nunjucks template
- Existing view-model mapper, if the project uses one
- Route or controller tests
- Template rendering tests
- Integration or accessibility tests
- Minimal developer documentation

Only modify other files when necessary and explain why in the plan.

## 25. Delivery Plan Rules

### Before implementation

The planning agent must produce:

1. Repository findings.
2. Design-reference transcription.
3. Proposed user flow.
4. Proposed route and view-model contract.
5. Exact empty-state rule or a clearly identified ambiguity.
6. GDS component mapping.
7. Positioning and spacing plan.
8. Exact files to create or modify.
9. Test plan.
10. Accessibility plan.
11. Risks and mitigations.
12. Confirmation that the orchestrator is not required, unless evidence shows otherwise.

Do not change code during planning.

Stop and wait for approval.

### After approval

The first action is to save the approved plan at:

```text
design/plans/07-catch-record-details-empty-page.md
```

Then implement only that approved plan with the frontend developer agent.

### Completion report

Report:

- Files changed
- Empty-state behaviour implemented
- Route and navigation behaviour implemented
- Tests run and results
- Accessibility checks run and results
- Manual verification completed
- Any limitation or approved-plan deviation

## 26. Manual Verification Requirements

After automated tests pass:

1. Start the application using the documented local command.
2. Navigate to the page through the approved previous step.
3. Confirm the Catch Record Details heading matches the PNG.
4. Confirm the empty-state text matches the PNG exactly.
5. Confirm the primary action label and presentation match the PNG.
6. Confirm the primary action reaches the approved next route.
7. Confirm the current record context is preserved.
8. Confirm the Back link returns to the correct page.
9. Confirm the shared English/Cymraeg control remains correctly positioned and functional.
10. Confirm there are no empty detail rows or summary lists.
11. Check keyboard-only navigation.
12. Check screen-reader landmark and heading output where tooling is available.
13. Check 320px, 768px, 1024px and 1440px widths.
14. Check 200% zoom and, where practical, 400% zoom.
15. Confirm the corrected logo, centred main menu and thin grey footer border remain unchanged.
16. Confirm there are no new browser-console errors.

## 27. Acceptance Criteria

- [ ] The approved plan is saved to `design/plans/07-catch-record-details-empty-page.md`.
- [ ] The Catch Record Details route renders through the common application shell.
- [ ] The page matches the supplied empty-state PNG for content, hierarchy and action.
- [ ] The page contains one clear `<h1>`.
- [ ] Empty state is driven by explicit application or view-model state.
- [ ] No blank detail rows or Summary Lists are rendered.
- [ ] No fake catch data is rendered.
- [ ] The primary action uses the approved label and destination.
- [ ] The Back link uses an explicit approved destination.
- [ ] The English/Cymraeg control is reused from the shared shell.
- [ ] The page preserves applicable catch-record context.
- [ ] Missing, inaccessible and failed record retrievals use existing error behaviour and are not treated as empty records.
- [ ] The implementation meets accessibility and responsive requirements.
- [ ] Relevant unit, route, integration and accessibility tests pass.
- [ ] Earlier shared layout corrections remain unchanged.
- [ ] No later catch-data form or populated summary is implemented prematurely.
- [ ] No unrelated code or dependency changes are included.

## 28. Quality Requirements

- Reuse existing route, view-model, Nunjucks and test patterns.
- Prefer GOV.UK components and spacing tokens.
- Keep business decisions out of templates.
- Keep the empty-state contract small and explicit.
- Use semantic, progressively enhanced HTML.
- Avoid duplicate shared components.
- Preserve earlier implementation behaviour.
- Keep tests focused on behaviour and semantics.
- Keep the implementation ready for later populated Catch Record Details work without overengineering it now.

## 29. Final Instruction

If you reach any ambiguity ask me to clarify.
