# Catch Record Web UI: Frontend Walkthrough Implementation Plan

## 1. Purpose

This plan breaks the Catch Record Web UI frontend walkthrough into small, ordered implementation steps. Each step is intentionally scoped so it can later be executed through a dedicated GitHub Copilot prompt.

The plan is based on the agreed Happy Path Journey Map and Navigation Rules.

## 2. Project Constraints and Working Principles

- The project already exists. Do not create or scaffold a new project.
- Use Nunjucks templates and GOV.UK Design System components and patterns.
- Use the existing project architecture, build commands, routing conventions, linting, and test setup.
- Implement a frontend-only walkthrough with mock data and limited business logic.
- Do not add a backend, API, or database.
- Store all mock data in editable JSON object files.
- Keep route handlers, templates, data, and reusable components separated.
- Prefer standard GOV.UK components over custom implementations.
- Only introduce custom styling when the Figma design cannot be represented with existing GOV.UK components or utility classes.
- Preserve accessibility semantics, keyboard behaviour, labels, hints, fieldsets, legends, focus states, and error-summary compatibility.
- Do not implement functionality outside the agreed walkthrough.
- Visible but unimplemented actions must lead to a reusable Empty Page.
- Every GitHub Copilot prompt must use the agreed `ARTIFACT-INSTRUCTION` and `ARTIFACT-CONTENT` block format.
- Artifact paths must be safe relative paths and filenames must use kebab-case.
- GitHub prompt artifacts must be saved under `github-prompts/`.
- Every prompt must name its plan file.
- When a prompt uses Copilot plan mode, it must instruct Copilot that, immediately after plan approval, the first implementation action is to save the approved plan using the same base name as the prompt file.
- Every prompt must recommend reasoning effort for planning and implementation.
- Every prompt must end with: `if you reach any ambiguity ask me to clarify`.

## 3. Visual Implementation Rule

Any implementation step involving graphical design or visual fidelity must have a GitHub prompt containing:

- a placeholder for the Figma URL;
- placeholders for the relevant PNG reference images;
- a statement that the Figma design and supplied PNG images are the visual source of truth;
- instructions to inspect the existing implementation before changing it;
- instructions to use GOV.UK components wherever possible;
- instructions to ask for clarification when the written requirements, Figma design, PNG references, and existing project conflict.

Suggested prompt section:

```text
Figma URL: [FIGMA_URL]
PNG references:
- [PNG_REFERENCE_1]
- [PNG_REFERENCE_2]
```

The PNG references should be specific to the pages implemented in that step rather than attaching the entire design export when unnecessary.

## 4. Definition of Done for Every Step

A step is complete when:

- only the agreed scope has been implemented;
- the existing project starts and builds successfully;
- affected routes render without server or template errors;
- relevant links and form actions reach the expected destination;
- GOV.UK components and accessible markup are used correctly;
- mock content comes from editable JSON object files when data is required;
- no backend, database, or invented business logic has been introduced;
- existing functionality outside the step remains working;
- implementation notes and assumptions are recorded where appropriate;
- the step-specific acceptance criteria pass.

---

# Implementation Steps

## Step 01: Common Layout Foundation

### Goal

Create the reusable application shell before implementing the journey routes or pages.

### Scope

- Inspect the existing project's Nunjucks and GOV.UK layout conventions.
- Implement or extend the common page layout.
- Implement the shared header.
- Implement the shared footer.
- Include the service name, main navigation, language links, Beta banner, footer links, and copyright content shown in the design.
- Create one temporary layout test page and route solely to verify the shell.

### Deliverables

- Common Nunjucks layout.
- Reusable header component or configured GOV.UK header macro.
- Reusable footer component or configured GOV.UK footer macro.
- Temporary layout test page.
- Temporary layout test route.

### Acceptance Criteria

- The test page renders inside the common header and footer.
- The layout exposes the blocks required by future pages.
- Header and footer match the supplied Figma and PNG references as closely as possible using GOV.UK components.
- Header links may use temporary destinations at this stage.
- No happy-path page or route is implemented in this step.

### Prompt Inputs Required

- Figma URL.
- Header PNG.
- Footer PNG.
- At least one full-page PNG showing layout spacing.

### Suggested Prompt File

`github-prompts/01-common-layout-foundation.md`

### Suggested Plan File

`github-prompts/01-common-layout-foundation-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: Medium.

---

## Step 02: Route Structure and Placeholder Journey

### Goal

Create every agreed route and placeholder page, then connect the complete journey with simple links or form actions before implementing detailed page designs.

### Scope

Create placeholder routes and Nunjucks pages for:

1. Guidance.
2. Privacy Notice.
3. Sign In.
4. All Records.
5. Catch Record Details.
6. Create Draft Record.
7. Select Vessel.
8. Trip Date.
9. Trip Departure Date.
10. Trip Return Date.
11. Departure Port.
12. Return Port.
13. Gear Selection.
14. Pots Details.
15. Statistical Area.
16. Alternative Statistical Area.
17. Species Selection.
18. Species Weight.
19. Catch Not Landed.
20. Check Your Answers.
21. Confirmation.
22. Account.
23. Empty Page.

Each placeholder should contain only:

- common layout;
- page title;
- short placeholder description;
- minimal links or controls needed to navigate to the next agreed destination.

Implement the agreed branches:

- Guidance to Privacy Notice and back.
- Guidance to Sign In.
- All Records create action to Create Draft Record.
- Unsent record to Create Draft Record.
- Submitted, Amended, and Late records to Catch Record Details.
- Trip Date Yes directly to Departure Port.
- Trip Date No through departure and return date pages.
- Statistical Area Other to Alternative Statistical Area.
- Unsupported actions to Empty Page.

### Deliverables

- Complete route map.
- Placeholder Nunjucks page for each route.
- End-to-end clickable walkthrough.
- Safe fallback route for unimplemented features.

### Acceptance Criteria

- Every route renders successfully.
- The complete creation journey can be clicked from Guidance to Confirmation.
- Both supported trip-date branches work.
- Both supported statistical-area branches work.
- Record-status links use the agreed destinations.
- Unsupported actions consistently reach Empty Page.
- No detailed page design, validation, mock-data service, or persistence is introduced yet.

### Prompt Inputs Required

- Happy Path Journey Map.
- Navigation Rules.
- Existing route and view conventions.

### Suggested Prompt File

`github-prompts/02-route-structure-and-placeholder-journey.md`

### Suggested Plan File

`github-prompts/02-route-structure-and-placeholder-journey-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 03: Mock Data Foundation

### Goal

Create a central, editable mock-data layer that supplies page data without coupling JSON objects to route handlers or templates.

### Scope

- Inspect existing data-loading conventions.
- Create editable JSON object files grouped logically by page or domain.
- Implement a shared data accessor such as `getData(pageName)`.
- Return safe empty data or a clear development error for unknown page keys according to the existing project conventions.
- Ensure consumers receive data without mutating the source objects.
- Seed data for James Smith, OLGA, records, ports, gear, statistical areas, species, weights, and confirmation reference.
- Do not add any database or remote call.

### Deliverables

- Mock JSON data files.
- Shared mock-data accessor.
- Unit tests if the project already has a suitable test pattern.
- Short data-shape documentation.

### Acceptance Criteria

- Page data can be requested through one shared interface.
- Routes do not contain large inline data objects.
- Mock objects are easy to edit.
- The data supports all agreed walkthrough branches.
- No API, backend, or database dependency exists.

### Prompt Inputs Required

- Happy Path Journey Map.
- Navigation Rules.
- Existing source and test structure.

### Suggested Prompt File

`github-prompts/03-mock-data-foundation.md`

### Suggested Plan File

`github-prompts/03-mock-data-foundation-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 04: Guidance and Privacy Notice

### Goal

Replace the Guidance and Privacy Notice placeholders with detailed pages matching the designs and agreed temporary navigation correction.

### Scope

- Implement the full Guidance content.
- Make Guidance the application entry point.
- Add Start now leading to Sign In.
- Add the temporary Privacy notice link above the footer.
- Implement the full Privacy Notice content.
- Make the Privacy Notice Back link return to Guidance.

### Deliverables

- Detailed Guidance page.
- Detailed Privacy Notice page.
- Correct entry and return navigation.

### Acceptance Criteria

- `/` renders Guidance.
- Start now reaches Sign In.
- Privacy notice is accessible from Guidance.
- Privacy Notice Back returns to Guidance.
- Both pages match the relevant visual references and use accessible GOV.UK typography and components.

### Prompt Inputs Required

- Figma URL.
- Guidance PNG.
- Privacy Notice PNG.

### Suggested Prompt File

`github-prompts/04-guidance-and-privacy-notice.md`

### Suggested Plan File

`github-prompts/04-guidance-and-privacy-notice-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: Medium.

---

## Step 05: Sign In

### Goal

Replace the Sign In placeholder with the detailed visual page and basic walkthrough behaviour.

### Scope

- Implement email and password fields.
- Implement the Sign in action leading to All Records.
- Route password recovery and account creation links to Empty Page.
- Do not implement real authentication or credential validation.

### Deliverables

- Detailed Sign In page.
- Basic frontend continuation.
- Placeholder routing for unsupported authentication actions.

### Acceptance Criteria

- The page matches the supplied design.
- Labels and input types are accessible.
- Sign in reaches All Records.
- Unsupported links reach Empty Page.
- No authentication service, session, or credential store is introduced.

### Prompt Inputs Required

- Figma URL.
- Sign In PNG.

### Suggested Prompt File

`github-prompts/05-sign-in.md`

### Suggested Plan File

`github-prompts/05-sign-in-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: Medium.

---

## Step 06: All Records and Status-Based Navigation

### Goal

Implement the All Records page for James Smith and the agreed status-based routing behaviour.

### Scope

- Render records from mock data.
- Display Unsent, Submitted, Amended, and Late examples.
- Make the trip-end date the record link.
- Route Unsent to Create Draft Record.
- Route Submitted, Amended, and Late to Catch Record Details.
- Route Create a new catch record to Create Draft Record.
- Preserve header navigation to Account.

### Deliverables

- Detailed All Records page.
- Mock-record table or list.
- Status-based record navigation.

### Acceptance Criteria

- The page identifies James Smith as shown in the design.
- Navigation is based on the selected record's status, not row position or date.
- Every status reaches the agreed destination.
- Record data comes from editable mock JSON objects.
- The design remains usable at supported responsive widths.

### Prompt Inputs Required

- Figma URL.
- All Records PNG.
- Mock-data structure.
- Navigation Rules.

### Suggested Prompt File

`github-prompts/06-all-records-and-status-navigation.md`

### Suggested Plan File

`github-prompts/06-all-records-and-status-navigation-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 07: Catch Record Details and Empty Page

### Goal

Implement the read-only Catch Record Details screen and standardise the destination for visible but unsupported features.

### Scope

- Render the selected existing record from mock data.
- Implement the detail sections shown in the design.
- Keep the page read-only.
- Implement the reusable Empty Page.
- Send Edit, Download PDF, and other unsupported actions to Empty Page.
- Provide a safe return action from Empty Page.

### Deliverables

- Detailed Catch Record Details page.
- Reusable Empty Page.
- Unsupported-link routing.

### Acceptance Criteria

- Submitted, Amended, and Late records render the detail page.
- The detail page displays the selected mock record.
- Unsupported actions do not imply success and lead to Empty Page.
- Empty Page uses the common layout and offers a safe return path.

### Prompt Inputs Required

- Figma URL.
- Catch Record Details PNG.
- Relevant Empty Page presentation guidance, if available.
- Mock-data structure.

### Suggested Prompt File

`github-prompts/07-catch-record-details-and-empty-page.md`

### Suggested Plan File

`github-prompts/07-catch-record-details-and-empty-page-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: High.

---

## Step 08: Create Draft Record and Select Vessel

### Goal

Implement the first two detailed screens of the record-creation journey.

### Scope

- Implement the draft action page.
- Support Complete catch record.
- Send Delete catch record to Empty Page.
- Implement Select Vessel using assigned-vessel mock data.
- Offer OLGA as the walkthrough vessel.
- Do not implement Add Vessel or vessel assignment.

### Deliverables

- Detailed Create Draft Record page.
- Detailed Select Vessel page.
- Correct continuation into Trip Date.

### Acceptance Criteria

- Both creation entry points reach Create Draft Record.
- Complete catch record reaches Select Vessel.
- Selecting OLGA reaches Trip Date.
- Delete reaches Empty Page.
- Vessel options come from mock data.
- The user cannot add or assign vessels.

### Prompt Inputs Required

- Figma URL.
- Create Draft Record PNG.
- Select Vessel PNG.
- Mock vessel data.

### Suggested Prompt File

`github-prompts/08-create-draft-record-and-select-vessel.md`

### Suggested Plan File

`github-prompts/08-create-draft-record-and-select-vessel-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: Medium.

---

## Step 09: Trip Date Branching

### Goal

Implement the agreed same-date question and both supported branches.

### Scope

- Implement Did your trip start and finish on the same date?
- Yes goes directly to Departure Port.
- No goes to When did you leave?, then When did you return?, then Departure Port.
- Preserve branch-aware Back navigation.
- Use only basic walkthrough logic.

### Deliverables

- Detailed Trip Date page.
- Detailed Trip Departure Date page.
- Detailed Trip Return Date page.
- Branch handling and Back navigation.

### Acceptance Criteria

- Yes skips both date-entry pages.
- No visits both date-entry pages in order.
- Date inputs use an accessible GOV.UK date pattern.
- Back navigation reflects the branch used.
- No server persistence or complex date business rules are introduced.

### Prompt Inputs Required

- Figma URL.
- Same-date question PNG.
- Departure Date PNG.
- Return Date PNG.
- Navigation Rules.

### Suggested Prompt File

`github-prompts/09-trip-date-branching.md`

### Suggested Plan File

`github-prompts/09-trip-date-branching-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 10: Departure and Return Ports

### Goal

Implement both port-selection pages using mock port data.

### Scope

- Implement Departure Port.
- Implement Return Port.
- Use Hastings as walkthrough mock data.
- Use the GOV.UK accessible-autocomplete pattern only if already supported by the project; otherwise follow the closest existing approved pattern.
- Maintain branch-aware Back navigation from Departure Port.

### Deliverables

- Detailed Departure Port page.
- Detailed Return Port page.
- Mock port options.

### Acceptance Criteria

- Both pages match their references.
- Continue follows the agreed journey.
- Back links reach the correct preceding page.
- Port values come from mock data.
- Navigation does not depend specifically on Hastings.

### Prompt Inputs Required

- Figma URL.
- Departure Port PNG.
- Return Port PNG.
- Mock port data.

### Suggested Prompt File

`github-prompts/10-departure-and-return-ports.md`

### Suggested Plan File

`github-prompts/10-departure-and-return-ports-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: Medium.

---

## Step 11: Gear Selection and Pots Details

### Goal

Implement gear selection and the only supported gear-specific sublevel: Pots.

### Scope

- Render the designed gear options from mock data.
- Support selection of Pots.
- Implement Pots Details.
- Capture pots or traps hauled and left in water.
- Do not invent subjourneys for other gear types.
- Unsupported gear continuation may use Empty Page.

### Deliverables

- Detailed Gear Selection page.
- Detailed Pots Details page.
- Basic Pots-specific navigation.

### Acceptance Criteria

- Pots reaches Pots Details.
- Pots details reach Statistical Area.
- Fields use appropriate GOV.UK components and labels.
- Gear and sample values come from mock data.
- No additional gear business logic is introduced.

### Prompt Inputs Required

- Figma URL.
- Gear Selection PNG.
- Pots Details PNG.
- Mock gear data.

### Suggested Prompt File

`github-prompts/11-gear-selection-and-pots-details.md`

### Suggested Plan File

`github-prompts/11-gear-selection-and-pots-details-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 12: Statistical Area and Other Branch

### Goal

Implement the primary statistical-area page and the agreed Other fallback page.

### Scope

- Render nearby statistical areas from mock data.
- Allow direct selection of a displayed area.
- Route Other to the Alternative Statistical Area page.
- Allow selection or entry of a mock alternative area.
- Send both valid branches to Species Selection.
- Do not implement full geographic validation.

### Deliverables

- Detailed Statistical Area page.
- Detailed Alternative Statistical Area page.
- Branch-aware Back navigation.

### Acceptance Criteria

- Direct area selection reaches Species Selection.
- Other reaches Alternative Statistical Area.
- Alternative selection reaches Species Selection.
- Both pages use mock area data.
- Back navigation reflects the branch.

### Prompt Inputs Required

- Figma URL.
- Statistical Area PNG.
- Alternative Statistical Area PNG.
- Mock statistical-area data.

### Suggested Prompt File

`github-prompts/12-statistical-area-and-other-branch.md`

### Suggested Plan File

`github-prompts/12-statistical-area-and-other-branch-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 13: Species Selection and Species Weight

### Goal

Implement species selection and weight capture for the walkthrough species.

### Scope

- Render species from mock data.
- Support Atlantic cod (COD).
- Implement Species Weight.
- Capture above-minimum retained, below-minimum retained, and legally discarded weights.
- Route Add species and Remove species to Empty Page.

### Deliverables

- Detailed Species Selection page.
- Detailed Species Weight page.
- Mock species and weight data.

### Acceptance Criteria

- Atlantic cod reaches Species Weight.
- Weight fields match the reference design.
- Continue reaches Catch Not Landed.
- Add and Remove species reach Empty Page.
- Species and values come from mock data.

### Prompt Inputs Required

- Figma URL.
- Species Selection PNG.
- Species Weight PNG.
- Mock species data.

### Suggested Prompt File

`github-prompts/13-species-selection-and-species-weight.md`

### Suggested Plan File

`github-prompts/13-species-selection-and-species-weight-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: High.

---

## Step 14: Catch Not Landed

### Goal

Implement the Catch Not Landed question with the agreed happy-path answer.

### Scope

- Implement the Yes/No page.
- No leads to Check Your Answers.
- Yes leads to Empty Page because the Yes subjourney is outside scope.
- Do not implement not-landed species or weight screens.

### Deliverables

- Detailed Catch Not Landed page.
- Correct No and unsupported Yes destinations.

### Acceptance Criteria

- No reaches Check Your Answers.
- Yes reaches Empty Page without implying completion.
- The page matches the supplied design.
- No additional catch business logic is introduced.

### Prompt Inputs Required

- Figma URL.
- Catch Not Landed PNG.

### Suggested Prompt File

`github-prompts/14-catch-not-landed.md`

### Suggested Plan File

`github-prompts/14-catch-not-landed-plan.md`

### Reasoning Effort

- Planning: Low.
- Implementation: Medium.

---

## Step 15: Check Your Answers

### Goal

Implement the complete review screen using the mock journey data.

### Scope

- Render trip, ports, area, gear, Pots, species, weights, and not-landed data.
- Implement the declaration shown in the design.
- Implement the submit action leading to Confirmation.
- Link Change actions to implemented pages only where the return journey is safe and clear.
- Send unsupported Change actions to Empty Page.

### Deliverables

- Detailed Check Your Answers page.
- Summary sections driven by mock data.
- Declaration and submit action.

### Acceptance Criteria

- All agreed mock journey data is visible.
- GOV.UK Summary List patterns are used where appropriate.
- The declaration is accessible.
- Submit reaches Confirmation.
- Change links do not introduce unsupported persistence or editing logic.

### Prompt Inputs Required

- Figma URL.
- Check Your Answers PNG.
- All relevant mock-data shapes.
- Navigation Rules.

### Suggested Prompt File

`github-prompts/15-check-your-answers.md`

### Suggested Plan File

`github-prompts/15-check-your-answers-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 16: Confirmation

### Goal

Implement the final submitted-record confirmation screen.

### Scope

- Display the GOV.UK confirmation pattern shown in the design.
- Show a mock catch-record reference number.
- Include the designed What happens next content.
- Make View your catch records lead to All Records.
- Do not perform a real submission.

### Deliverables

- Detailed Confirmation page.
- Mock reference-number presentation.
- Return navigation to All Records.

### Acceptance Criteria

- The page matches the visual reference.
- The reference number comes from mock data.
- View your catch records reaches All Records.
- The UI does not claim that a real backend submission occurred outside the context of the walkthrough.

### Prompt Inputs Required

- Figma URL.
- Confirmation PNG.
- Mock reference data.

### Suggested Prompt File

`github-prompts/16-confirmation.md`

### Suggested Plan File

`github-prompts/16-confirmation-plan.md`

### Reasoning Effort

- Planning: Low.
- Implementation: Medium.

---

## Step 17: Account Page and Header Destinations

### Goal

Implement the Account page reached through the common header and finalise global header destinations.

### Scope

- Implement the designed Account page using mock data.
- Connect Your account to Account.
- Keep vessel assignment unavailable.
- Route unsupported account-management actions to Empty Page.
- Finalise Home, service name, Sign out, English, and Cymraeg destinations according to the Navigation Rules.

### Deliverables

- Detailed Account page.
- Final header navigation.
- Placeholder handling for unsupported account actions.

### Acceptance Criteria

- Your account consistently reaches Account.
- Account data comes from mock JSON objects.
- The user cannot add or assign vessels.
- Unsupported account actions reach Empty Page.
- Global header links have consistent destinations.

### Prompt Inputs Required

- Figma URL.
- Account PNG.
- Header PNG.
- Mock account data.
- Navigation Rules.

### Suggested Prompt File

`github-prompts/17-account-page-and-header-destinations.md`

### Suggested Plan File

`github-prompts/17-account-page-and-header-destinations-plan.md`

### Reasoning Effort

- Planning: Medium.
- Implementation: High.

---

## Step 18: End-to-End Navigation Verification

### Goal

Verify the implemented walkthrough against the Journey Map and Navigation Rules without adding new product scope.

### Scope

Test all agreed routes and branches:

- Guidance to Privacy Notice and back.
- Guidance to Sign In.
- Sign In to All Records.
- Create New and Unsent to Create Draft Record.
- Submitted, Amended, and Late to Catch Record Details.
- Trip Date Yes branch.
- Trip Date No branch.
- Statistical Area primary branch.
- Statistical Area Other branch.
- Pots journey.
- Species journey.
- Catch Not Landed No branch.
- Check Your Answers to Confirmation.
- Confirmation to All Records.
- Global header destinations.
- Unsupported actions to Empty Page.

Fix only defects within the agreed scope.

### Deliverables

- Automated route or journey tests where the existing project supports them.
- Manual verification checklist.
- Navigation defect fixes.

### Acceptance Criteria

- Every agreed route renders without errors.
- Every branch reaches the expected destination.
- Back navigation is coherent.
- No broken internal links remain.
- No new business features are introduced during defect correction.

### Prompt Inputs Required

- Happy Path Journey Map.
- Navigation Rules.
- Existing test conventions.

### Suggested Prompt File

`github-prompts/18-end-to-end-navigation-verification.md`

### Suggested Plan File

`github-prompts/18-end-to-end-navigation-verification-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 19: Accessibility and GOV.UK Design System Review

### Goal

Review the completed walkthrough for correct GOV.UK component use and baseline accessibility.

### Scope

- Review heading hierarchy.
- Review landmarks and page titles.
- Review labels, hints, legends, and fieldsets.
- Review keyboard operation and focus order.
- Review link and button semantics.
- Review colour and spacing customisations.
- Review table responsiveness.
- Review Back links and error-ready form structure.
- Replace avoidable custom markup with GOV.UK components.
- Do not add a full validation framework unless already present and required by the existing project.

### Deliverables

- Accessibility review notes.
- GOV.UK component corrections.
- Targeted regression tests where supported.

### Acceptance Criteria

- Pages use semantic headings and landmarks.
- Form controls have accessible names and grouping.
- Keyboard users can operate the walkthrough.
- Standard GOV.UK components are used wherever applicable.
- Custom CSS is limited and documented.
- Corrections do not alter the agreed journey.

### Prompt Inputs Required

- Figma URL.
- Relevant PNG page references.
- GOV.UK Design System URL.
- Existing linting and accessibility tools.

### Suggested Prompt File

`github-prompts/19-accessibility-and-gds-review.md`

### Suggested Plan File

`github-prompts/19-accessibility-and-gds-review-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

## Step 20: Visual Fidelity and Demo Readiness

### Goal

Perform the final page-by-page comparison with Figma and prepare a stable stakeholder walkthrough.

### Scope

- Compare every implemented page with its PNG reference and Figma source.
- Correct spacing, typography, component variants, content widths, alignment, and responsive layout.
- Verify mock data is coherent across all pages.
- Remove temporary layout-test artifacts if no longer required.
- Confirm Empty Page messaging is consistent.
- Confirm the application can be demonstrated from a clean start.
- Add a concise walkthrough README if useful within the existing project.

### Deliverables

- Visual-fidelity corrections.
- Demo-readiness checklist.
- Optional walkthrough README.
- Removal of obsolete temporary artifacts.

### Acceptance Criteria

- Each page has been visually compared with its supplied reference.
- The journey can be demonstrated end to end without manual URL entry.
- Mock names, records, vessel, ports, gear, areas, species, weights, and reference number remain internally consistent.
- No temporary broken links or debug content remain.
- The project builds and starts successfully using its existing commands.

### Prompt Inputs Required

- Figma URL.
- PNG reference for every implemented visual page.
- Happy Path Journey Map.
- Navigation Rules.

### Suggested Prompt File

`github-prompts/20-visual-fidelity-and-demo-readiness.md`

### Suggested Plan File

`github-prompts/20-visual-fidelity-and-demo-readiness-plan.md`

### Reasoning Effort

- Planning: High.
- Implementation: High.

---

# 5. Recommended Execution Order

Execute the GitHub prompts in numerical order.

Dependencies:

- Step 01 establishes the common shell.
- Step 02 establishes routes and placeholder navigation.
- Step 03 establishes mock data before detailed data-driven screens.
- Steps 04 through 17 replace placeholders with detailed pages.
- Step 18 verifies navigation after all pages are available.
- Step 19 reviews accessibility and GOV.UK usage after the journey is stable.
- Step 20 performs final visual and demo polish.

A step may be split into a smaller prompt if implementation planning reveals excessive scope. Do not combine later steps merely to reduce the number of prompts, because each prompt should remain reviewable and independently testable.

# 6. Mandatory GitHub Prompt Template Requirements

Every GitHub prompt generated from this plan must include:

1. Context and objective.
2. Explicit in-scope and out-of-scope sections.
3. Existing-project inspection instructions.
4. Required input artifacts.
5. Deliverables with safe relative paths.
6. Acceptance criteria.
7. Verification commands based on the existing project.
8. Plan filename.
9. Recommended reasoning effort for planning and implementation.
10. The instruction to save the approved plan immediately after plan approval, using the same base name as the prompt file.
11. `ARTIFACT-INSTRUCTION` and `ARTIFACT-CONTENT` blocks.
12. The exact closing sentence: `if you reach any ambiguity ask me to clarify`.

For visual steps, also include:

13. Figma URL placeholder.
14. Relevant PNG image placeholders.
15. Visual-source-of-truth and conflict-handling instructions.

# 7. Final Success Criteria

The implementation plan is complete when all twenty steps have been executed and the result provides:

- a reusable GOV.UK Nunjucks layout;
- a fully connected placeholder journey before detailed implementation;
- editable mock JSON data accessed through a shared interface;
- all agreed screens implemented in detail;
- the record-status, trip-date, and statistical-area branches;
- a read-only record-details route;
- consistent Empty Page handling for unimplemented features;
- an Account destination from the header;
- an end-to-end walkthrough from Guidance to Confirmation;
- verified GOV.UK component use and baseline accessibility;
- visual comparison against Figma and page-specific PNG references;
- no backend, API, database, or unsupported business logic.
