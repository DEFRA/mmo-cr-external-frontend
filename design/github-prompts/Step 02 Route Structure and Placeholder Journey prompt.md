# GitHub Copilot Prompt: Step 02 Route Structure and Placeholder Journey

## Recommended reasoning effort

- **Planning:** High
- **Implementation:** High

Treat this as a **Standard frontend change** unless repository inspection identifies a genuine architectural, session, authentication, cache, security, or cross-domain concern.

Use the **Frontend Developer** agent's lightweight planning and approval workflow. Do not invoke the Frontend Orchestrator or heavyweight Frontend Planner merely because this step contains several pages. The work uses one established frontend domain and the existing route, controller, Nunjucks, and test conventions.

Do not implement before the lightweight plan has been presented and explicitly approved.

After approval, the first implementation action must be to save the approved plan to:

```text
github-prompts/02-route-structure-and-placeholder-journey-plan.md
```

Then implement only the approved scope.

---

## ARTIFACT-INSTRUCTION

```text
artifact-type: github-copilot-implementation-prompt
artifact-path: github-prompts/02-route-structure-and-placeholder-journey.md
plan-path: github-prompts/02-route-structure-and-placeholder-journey-plan.md
project-status: existing-project
implementation-step: 02-route-structure-and-placeholder-journey
work-classification: standard
primary-agent: Frontend Developer
```

## ARTIFACT-CONTENT

### 1. Objective

Implement the complete route structure and a minimal placeholder page for every agreed Catch Record Web UI walkthrough destination.

Connect the placeholders so the complete journey can be navigated from **Guidance** to **Confirmation**, including the agreed branches and record-status routing.

This step establishes structure and navigation only. It must not implement the detailed Figma page designs, final page content, mock-data foundation, production validation, backend behaviour, or persistence.

### 2. Authoritative functional inputs

Read these approved project artifacts before planning:

```text
[HAPPY_PATH_JOURNEY_MAP]
[NAVIGATION_RULES_PATH]
[IMPLEMENTATION_PLAN_PATH]
```

Replace the placeholders with the repository or workspace paths for:

- the approved Happy Path Journey Map;
- the approved Navigation Rules;
- the approved Catch Record Web UI Implementation Plan.

These artifacts are the functional source of truth for this step.

If the three documents conflict, stop and ask for clarification rather than inventing a navigation rule.

### 3. Relationship to Figma and PNG references

This step is **not a detailed visual implementation task**. It creates minimal placeholder pages inside the common shell completed in Step 01.

Do not fetch or ingest the full Figma design or individual page PNGs during this step. Detailed page visual references will be supplied once, in the later page-specific implementation prompts.

For placeholder presentation:

- reuse the approved common layout from Step 01;
- use standard GOV.UK typography, links, buttons, radios, and form semantics only where needed to exercise navigation;
- do not attempt visual parity with the final page designs;
- do not add page-specific SCSS unless required to fix a clear accessibility defect;
- do not restyle or reopen the approved common shell.

If the common shell is missing or materially broken, report that dependency instead of rebuilding it inside this step.

### 4. Existing-project constraints

This project already exists.

Before planning or editing:

1. Read `.github/copilot-instructions.md`.
2. Read the relevant files under `.github/instructions/`, including Node/Nunjucks, routing, testing, accessibility, and security instructions.
3. Read the Frontend Developer agent definition.
4. Inspect the existing Hapi.js route structure.
5. Inspect the existing per-page folder convention, including `controller.js`, `controller.test.js`, `index.js`, and `index.njk` where applicable.
6. Inspect the common Nunjucks layout completed in Step 01.
7. Inspect any existing route-registration helpers, view-context builders, navigation helpers, catch-all/error routes, and tests.
8. Reuse established repository conventions and safe relative paths.
9. Do not scaffold a new project or create a parallel route architecture.
10. Do not introduce a client-side routing framework.

The core journey must work with server-rendered HTML and JavaScript disabled.

### 5. Required placeholder destinations

Create or adapt routes, controllers, Nunjucks templates, and tests for these destinations, using the final safe route names determined from the existing conventions and approved Navigation Rules:

1. Guidance.
2. Privacy Notice.
3. Sign In.
4. All Records.
5. Catch Record Details.
6. Create Draft Record.
7. Select Vessel.
8. Trip Date question.
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
23. Empty Page for unimplemented features.

Do not assume that every destination needs a new file. Reuse or adapt an existing placeholder only when doing so preserves clear page ownership and the repository's one-route-folder-per-page convention.

### 6. Placeholder page contract

Each placeholder page must contain only the minimum needed to establish and verify the journey:

- the approved common shell;
- a unique document title;
- one page-level heading matching the destination name;
- a short sentence stating that the detailed page will be implemented in a later step;
- the minimum semantic form control, link, or button needed to exercise each agreed outgoing route;
- a GOV.UK Back link where the Navigation Rules define one;
- no detailed Figma-derived body content;
- no final data presentation;
- no page-specific decorative styling.

Use descriptive link text. Do not use generic text such as `Click here`.

Use buttons for form submission and links for navigation. Do not make links look like controls that perform an unimplemented state change.

### 7. Recommended route identifiers

Use the existing project conventions first. Where no convention conflicts, use stable lowercase kebab-case routes equivalent to:

```text
/                              Guidance
/privacy-notice                Privacy Notice
/sign-in                       Sign In
/records                       All Records
/records/{recordId}            Catch Record Details
/draft                         Create Draft Record
/select-vessel                 Select Vessel
/trip-date                     Trip Date question
/trip-departure-date           Trip Departure Date
/trip-return-date              Trip Return Date
/departure-port                Departure Port
/return-port                   Return Port
/gear-selection               Gear Selection
/pots-details                  Pots Details
/statistical-area              Statistical Area
/statistical-area-other        Alternative Statistical Area
/species-selection             Species Selection
/species-weight                Species Weight
/catch-not-landed              Catch Not Landed
/check-answers                 Check Your Answers
/confirmation                 Confirmation
/account                       Account
/not-implemented               Empty Page
```

Hapi route parameters must use the syntax supported by the installed project version. Do not copy Express route syntax into Hapi.js.

If the project already has `/home`, `/about`, or temporary Step 01 routes, preserve them unless the approved plan explicitly replaces or removes them. Do not remove the Step 01 test route unless requested by the implementation plan.

### 8. Required navigation behaviour

#### 8.1 Guidance and Privacy Notice

- Guidance is the application entry route.
- Guidance provides **Privacy notice** leading to Privacy Notice.
- Privacy Notice Back leads to Guidance.
- Guidance provides **Start now** leading to Sign In.

#### 8.2 Sign In

- The minimal Sign In continuation leads to All Records.
- Forgotten password and Create account lead to Empty Page.
- Do not implement real authentication.

#### 8.3 All Records

The placeholder must expose four clearly identified sample record links so all routing rules can be exercised without the Step 03 mock-data layer:

- Unsent.
- Submitted.
- Amended.
- Late.

For this step, use the smallest local placeholder representation compatible with later replacement by mock data. Do not create the final common mock-data service yet.

Navigation rules:

- **Create a new catch record** leads to Create Draft Record.
- Unsent record date leads to Create Draft Record.
- Submitted record date leads to Catch Record Details.
- Amended record date leads to Catch Record Details.
- Late record date leads to Catch Record Details.

Do not route based on row position, visible date, or creator. If minimal route parameters or query values are required to represent the four branches, keep the logic explicit, constrained, and easy to replace in Step 03.

#### 8.4 Catch Record Details

- Back leads to All Records.
- Edit Catch Record leads to Empty Page.
- Download PDF leads to Empty Page.
- Other unsupported actions lead to Empty Page.

#### 8.5 Create Draft Record and Select Vessel

- Complete catch record leads to Select Vessel.
- Delete catch record leads to Empty Page.
- Create Draft Record Back leads to All Records.
- Selecting the placeholder assigned vessel leads to Trip Date.
- Select Vessel Back leads to Create Draft Record.
- Do not add an Add Vessel route.

#### 8.6 Trip Date branch

- Yes leads directly to Departure Port.
- No leads to Trip Departure Date.
- Trip Departure Date Continue leads to Trip Return Date.
- Trip Return Date Continue leads to Departure Port.
- Trip Date Back leads to Select Vessel.
- Trip Departure Date Back leads to Trip Date.
- Trip Return Date Back leads to Trip Departure Date.

The placeholder implementation must preserve enough non-sensitive navigation state to support branch-aware Back behaviour from Departure Port:

- after Yes, Departure Port Back leads to Trip Date;
- after No, Departure Port Back leads to Trip Return Date.

Use the simplest existing project-supported server-side mechanism. Do not introduce a new session/cache architecture for this walkthrough step. If branch-aware Back behaviour cannot be achieved without an architectural change, stop and ask for clarification.

#### 8.7 Ports and gear

- Departure Port Continue leads to Return Port.
- Return Port Back leads to Departure Port.
- Return Port Continue leads to Gear Selection.
- Gear Selection Pots choice leads to Pots Details.
- Unsupported gear continuation leads to Empty Page if exposed.
- Pots Details Back leads to Gear Selection.
- Pots Details Continue leads to Statistical Area.

#### 8.8 Statistical Area branch

- Direct displayed-area selection leads to Species Selection.
- Other leads to Alternative Statistical Area.
- Alternative Statistical Area Continue leads to Species Selection.
- Statistical Area Back leads to Pots Details.
- Alternative Statistical Area Back leads to Statistical Area.

Species Selection Back must return to the immediately preceding statistical-area branch when this can be achieved without introducing new architecture. Use the same constrained mechanism approved for branch-aware navigation.

#### 8.9 Species, catch not landed, review, and confirmation

- Species Selection Continue leads to Species Weight.
- Add species and Remove species lead to Empty Page.
- Species Weight Back leads to Species Selection.
- Species Weight Continue leads to Catch Not Landed.
- Catch Not Landed No leads to Check Your Answers.
- Catch Not Landed Yes leads to Empty Page.
- Catch Not Landed Back leads to Species Weight.
- Check Your Answers Back leads to Catch Not Landed.
- Submit leads to Confirmation.
- Confirmation View your catch records leads to All Records.

#### 8.10 Account and shared header

- The existing **Your account** header link leads to Account.
- Account unsupported actions lead to Empty Page.
- Do not implement account-management functionality.
- Do not change the approved Step 01 visual shell.

#### 8.11 Empty Page

The Empty Page must:

- use the common shell;
- state that the feature is not implemented in the current walkthrough;
- avoid claiming that any operation succeeded;
- provide a safe return link;
- support a constrained return target only where it can be safely validated against known internal routes;
- never accept or redirect to arbitrary external URLs.

### 9. Routing and controller requirements

- Follow the project's one-route-folder-per-page convention where applicable.
- Use thin controllers.
- Keep navigation decisions in a small named helper when more than one controller requires the same rule.
- Do not put route decision logic in Nunjucks templates.
- Do not put large inline placeholder data structures in route definitions.
- Validate route parameters and query values at boundaries using the project's Hapi/Joi conventions.
- Return the correct response for unknown or unsupported record status values.
- Do not leak server internals or stack traces.
- Preserve Nunjucks auto-escaping.
- Do not log personal data, credentials, or sensitive values.
- Do not create a database, API client, repository layer, or persistence service.

### 10. Testing requirements

Write tests alongside the implementation.

At minimum, test:

- every route returns the expected successful status and page heading;
- Guidance to Privacy Notice and Sign In destinations;
- Privacy Notice Back destination;
- Sign In continuation;
- Create New destination;
- Unsent destination;
- Submitted destination;
- Amended destination;
- Late destination;
- unsupported record status behaviour;
- Catch Record Details unsupported actions;
- Create Draft Record choices;
- vessel continuation;
- Trip Date Yes branch;
- Trip Date No branch;
- both date-page transitions;
- branch-aware Departure Port Back behaviour;
- Gear Selection Pots route;
- unsupported gear fallback if exposed;
- direct statistical-area route;
- Other statistical-area route;
- branch-aware Species Selection Back behaviour where implemented;
- Species Selection unsupported actions;
- Catch Not Landed No destination;
- Catch Not Landed Yes fallback;
- Check Your Answers submission destination;
- Confirmation return destination;
- Account route;
- Empty Page safe-return handling;
- invalid parameter and query handling.

Meet the project's coverage requirements without writing low-value duplicate tests.

### 11. Accessibility and progressive enhancement

All placeholder pages must:

- work without client-side JavaScript;
- contain a unique page title and one clear `h1`;
- use semantic forms, fieldsets, legends, labels, links, and buttons;
- preserve the common skip link and landmarks;
- maintain visible focus;
- support keyboard navigation;
- avoid colour-only meaning;
- use descriptive link text;
- use the GOV.UK Back Link pattern where defined;
- avoid inaccessible placeholder controls.

This step does not require final validation errors for every future form, but the markup must remain compatible with GOV.UK error-summary and field-error patterns later.

### 12. Out of scope

Do not implement:

- detailed Figma page designs;
- full Guidance or Privacy Notice copy;
- real Sign In behaviour;
- final All Records table styling or data source;
- final Catch Record Details content;
- the Step 03 shared mock-data layer or `getData(pageName)`;
- final form validation and error states;
- database or API persistence;
- authentication, authorisation, or production sessions;
- vessel administration;
- skipper management;
- gear-specific flows other than the Pots placeholder route;
- Catch Not Landed Yes subjourney;
- record editing, PDF generation, account creation, password recovery, or localisation;
- page-specific SCSS or visual-fidelity work;
- CI/CD, infrastructure, or dependency upgrades;
- unrelated refactoring.

### 13. Planning requirements

Produce a lightweight approval-ready plan with exactly these sections:

1. **Objective**
2. **Implementation Plan**
3. **File/Component Impact**
4. **Validation Plan**
5. **Risks, Assumptions and Sources**

The plan must:

- confirm the final route names after repository inspection;
- identify existing routes, controllers, helpers, and templates that will be reused or changed;
- describe how placeholder pages will be generated without introducing an over-generalised abstraction;
- identify the minimal approach to record-status routing;
- identify the minimal approach to branch-aware Back navigation;
- describe the safe Empty Page return strategy;
- list tests by behaviour rather than by implementation detail;
- preserve the approved Step 01 shell;
- identify any genuine blocker before requesting approval.

Do not change files during planning.

After explicit approval, save the approved plan first to:

```text
github-prompts/02-route-structure-and-placeholder-journey-plan.md
```

Then implement only the approved scope.

### 14. Acceptance criteria

This step is complete when:

- all 23 agreed destinations exist or are safely mapped to an appropriate existing equivalent;
- every route renders without Hapi.js or Nunjucks errors;
- the common Step 01 shell wraps every placeholder page;
- the complete creation journey can be followed from Guidance to Confirmation without manually entering URLs;
- Guidance to Privacy Notice and back works;
- Guidance to Sign In works;
- Create New and Unsent lead to Create Draft Record;
- Submitted, Amended, and Late lead to Catch Record Details;
- Catch Record Details unsupported actions lead to Empty Page;
- Trip Date Yes goes directly to Departure Port;
- Trip Date No visits both date pages before Departure Port;
- branch-aware Back behaviour works using the approved minimal approach;
- Pots leads to Pots Details;
- direct statistical-area selection reaches Species Selection;
- Other reaches Alternative Statistical Area and then Species Selection;
- Species Selection reaches Species Weight;
- Catch Not Landed No reaches Check Your Answers;
- Catch Not Landed Yes reaches Empty Page;
- Check Your Answers reaches Confirmation;
- Confirmation returns to All Records;
- Your account reaches Account;
- all unsupported actions consistently use Empty Page;
- all placeholder navigation works with JavaScript disabled;
- changed behaviour has appropriate Vitest coverage;
- project lint, format, test, build, and security checks pass;
- no detailed page design, final data layer, backend, database, or unsupported business logic has been introduced;
- the approved plan is saved at the required path.

### 15. Validation

Use the repository's established scripts and Definition of Done. Run the applicable equivalents of:

```text
npm run lint:js
npm run lint:scss
npm run format:check
npm test
npm run build:frontend
npm run security-audit
npm run dev
```

Use the built-in browser to verify:

- the complete primary journey;
- the Trip Date Yes branch;
- the Trip Date No branch;
- record-status destinations;
- the Statistical Area direct branch;
- the Statistical Area Other branch;
- Empty Page destinations;
- Account navigation;
- keyboard operation;
- narrow and wide viewport behaviour;
- JavaScript-disabled navigation.

This step is not a page-level visual-fidelity review. Verify that the approved common shell remains intact and that placeholders use standard accessible GOV.UK presentation without adding detailed design work.

Stop the development server after verification.

### 16. Completion report

Report:

- saved plan path;
- final route map;
- files created, modified, or removed;
- placeholder-page approach;
- record-status routing approach;
- branch-aware navigation approach;
- Empty Page safety approach;
- tests and quality checks run with results;
- browser routes and branches checked;
- JavaScript-disabled and keyboard results;
- any deviations from the approved Journey Map or Navigation Rules;
- blockers or follow-up work for Step 03 and later detailed-page steps.

if you reach any ambiguity ask me to clarify
