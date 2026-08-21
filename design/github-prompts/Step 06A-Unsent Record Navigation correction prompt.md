# GitHub Copilot Prompt: Step 06A Correct Unsent Record Navigation

## Recommended reasoning effort

- **Planning:** Low
- **Implementation:** Medium

Treat this as a **Standard, tightly scoped navigation correction**.

Use the **Frontend Developer** agent's lightweight planning and approval workflow. Do not invoke the heavyweight Frontend Planner or Frontend Orchestrator unless repository inspection identifies a genuine architectural or security concern.

The All Records page design and record data are already implemented. Do not redesign the page or rebuild the routing architecture.

Do not implement before the lightweight plan has been presented and explicitly approved.

After approval, the first implementation action must be to save the approved plan to:

```text
design/github-prompts/Step 06A-correct-unsent-record-navigation-plan.md
```

Then implement only the approved correction.

---

## ARTIFACT-INSTRUCTION

```text
artifact-type: github-copilot-correction-prompt
artifact-path: design/github-prompts/06a-correct-unsent-record-navigation.md
plan-path: design/github-prompts/Step 06A-correct-unsent-record-navigation-plan.md
project-status: existing-project
implementation-step: 06a-correct-unsent-record-navigation
work-classification: standard
primary-agent: Frontend Developer
```

## ARTIFACT-CONTENT

### 1. Objective

Correct the status-based navigation from the **All Records** page.

The current behaviour is incorrect:

```text
Unsent record date
  -> What do you want to do with your draft record?
```

The required behaviour is:

```text
Unsent record date
  -> Catch Record Details
```

After this correction, clicking the trip-end date of any existing record must open Catch Record Details, regardless of whether the record status is Unsent, Submitted, Amended, or Late.

The separate **Create a new catch record** action must continue to open Create Draft Record.

### 2. Authoritative corrected navigation rule

Use this mapping as the source of truth:

```text
Create a new catch record -> Create Draft Record

Existing record date:
Unsent                   -> Catch Record Details
Submitted                -> Catch Record Details
Amended                  -> Catch Record Details
Late                     -> Catch Record Details
```

The distinction is now based on the user action:

- creating a new record starts the draft-creation journey;
- opening any existing record displays that record's details.

Do not route an existing Unsent record to Create Draft Record.

### 3. Inputs to inspect

Before planning or editing, read and inspect:

```text
[NAVIGATION_RULES_PATH]
[IMPLEMENTATION_PLAN_PATH]
[STEP_06_APPROVED_PLAN_PATH]
[STEP_07_APPROVED_PLAN_PATH]
[STEP_21_APPROVED_PLAN_PATH]
```

Replace the placeholders with safe repository-relative or workspace paths for:

- the current Navigation Rules;
- the current implementation plan;
- the approved All Records plan;
- the approved Catch Record Details plan or current implementation notes;
- the approved Edit Catch Record journey plan, if implemented.

Also inspect:

- `.github/copilot-instructions.md`;
- applicable files under `.github/instructions/`;
- the Frontend Developer agent definition;
- the All Records route, controller, template, view-model builder, helpers, and tests;
- the Catch Record Details route and record-ID validation;
- the Create Draft Record route;
- mock records and canonical status values from the shared data layer;
- any shared status-to-destination helper;
- any end-to-end or navigation tests that encode the old Unsent behaviour;
- any project documentation that states Unsent opens Create Draft Record.

If repository behaviour differs from these corrected requirements, treat this prompt as the approved change request.

### 4. Visual design scope

This is a navigation correction, not a visual implementation task.

Do not fetch or ingest Figma frames or PNG references.

Do not change:

- the All Records layout;
- the records table;
- pagination placement;
- typography;
- spacing;
- status labels;
- the common shell;
- the Catch Record Details visual design.

The existing trip-end date link must remain visually unchanged. Only its safe destination and related logic/tests should change.

### 5. Required implementation behaviour

#### 5.1 Existing record links

For each record displayed on All Records:

- use the stable record ID as the record identifier;
- clicking the trip-end date opens Catch Record Details for that record;
- preserve the selected record ID;
- validate the record ID at the route boundary;
- render the selected mock record in Catch Record Details;
- do not determine the destination from row position, visible date, creator name, CSS class, or client-side JavaScript.

All supported existing statuses share the same details destination:

```text
Unsent
Submitted
Amended
Late
```

A status mapping helper is no longer needed merely to choose between Create Draft Record and Catch Record Details if all existing records share one destination. Simplify safely where appropriate, but do not perform broad refactoring.

#### 5.2 Create action

Preserve this behaviour exactly:

```text
Create a new catch record
  -> Create Draft Record
```

Do not route the create action to Catch Record Details.

Do not create a mock record before opening Create Draft Record.

#### 5.3 Catch Record Details

Ensure Catch Record Details can render an Unsent record using the same route architecture used for Submitted, Amended, and Late records.

Requirements:

- use the selected Unsent record's mock data;
- preserve record-status display;
- preserve existing Back navigation to All Records;
- preserve existing supported and unsupported action behaviour;
- preserve the Step 21 Edit Catch Record journey if already implemented;
- do not introduce new Unsent-specific actions unless explicitly present in approved design and scope;
- do not redirect Unsent records back to the draft-action page.

If Catch Record Details currently rejects Unsent as an unsupported status, extend the approved status allowlist to include Unsent and update tests.

#### 5.4 Unknown records and statuses

- Unknown record IDs must retain the existing safe not-found or error behaviour.
- Unexpected status values must retain the project's approved safe handling.
- Do not construct a redirect from a submitted status value.
- Do not accept arbitrary return URLs.
- Do not expose stack traces or internal implementation details.

### 6. Data requirements

Use the existing shared mock-data accessor.

Do not:

- duplicate the Unsent record in a route-local object;
- mutate the record status;
- convert the Unsent record into a new draft;
- add a backend, database, API, repository, session, cache, or persistence layer;
- modify unrelated mock records.

If the Unsent record lacks fields required by Catch Record Details, add only the smallest coherent fictional detail data necessary for the existing details view and update the shared data tests.

Do not fabricate new business rules.

### 7. Controller and helper requirements

- Keep controllers thin.
- Keep routes fixed and internal.
- Keep record lookup and validation outside Nunjucks.
- Remove or update only the obsolete status-routing branch that sends Unsent to Create Draft Record.
- Prefer one common existing-record details destination over four duplicated status branches.
- Preserve Nunjucks auto-escaping.
- Preserve existing safe error handling.
- Do not add client-side routing.
- Do not use status display labels as trusted route values.

### 8. Documentation consistency

Update relevant repository documentation if it currently states:

```text
Unsent -> Create Draft Record
```

The corrected rule is:

```text
Unsent -> Catch Record Details
```

Update only directly affected documentation, such as:

- navigation rules;
- route maps;
- implementation notes;
- test descriptions;
- comments that explain the old branch.

Do not rewrite approved historical plan artifacts. Plans are records of prior approved work. Add a concise correction note or update current living documentation instead.

### 9. Accessibility and progressive enhancement

Preserve the existing accessible trip-end date link.

Requirements:

- link text remains descriptive or retains accessible hidden context identifying the record;
- keyboard focus remains visible;
- route works without JavaScript;
- table semantics remain unchanged;
- no entire-row JavaScript click handler is introduced;
- the new destination does not change tab order or visual presentation;
- Catch Record Details remains accessible for the Unsent record.

### 10. Security requirements

- Validate record IDs through existing Hapi/Joi or route-boundary conventions.
- Use fixed internal destinations.
- Do not accept arbitrary redirects.
- Do not trust client-submitted status values.
- Resolve status from the selected mock record when status validation is required.
- Preserve Nunjucks auto-escaping.
- Do not log unnecessary record data.
- Use safe errors without stack traces.

### 11. Testing requirements

Update tests to reflect the corrected navigation.

At minimum, test:

#### All Records navigation

- Create a new catch record still leads to Create Draft Record;
- Unsent record date now leads to Catch Record Details;
- Submitted record date leads to Catch Record Details;
- Amended record date leads to Catch Record Details;
- Late record date leads to Catch Record Details;
- each details link contains or resolves the correct stable record ID;
- no existing record date leads to Create Draft Record;
- navigation works without JavaScript.

#### Catch Record Details

- an Unsent record ID renders Catch Record Details successfully;
- the selected Unsent record data and status render;
- Back leads to All Records;
- existing Edit Catch Record behaviour remains correct;
- unsupported actions retain their existing destinations;
- unknown IDs retain safe handling;
- unexpected statuses retain safe handling.

#### Regression

- All Records table order, labels, pagination, and visual markup remain unchanged;
- Create Draft Record remains reachable from Create a new catch record;
- Submitted, Amended, and Late behaviour does not regress;
- shared mock data is not mutated;
- existing Step 06, Step 07, and Step 21 tests remain green after required assertion updates;
- no backend or persistence is introduced.

Prefer focused navigation and controller assertions over brittle full-page snapshots.

### 12. Out of scope

Do not implement:

- a visual redesign of All Records;
- pagination changes;
- status-label changes;
- editing an Unsent record directly from the list;
- a new Unsent-specific page;
- automatic draft creation;
- record persistence;
- APIs or databases;
- sessions or caches;
- authentication or authorisation;
- changes to other record statuses;
- changes to the Create Draft Record design;
- changes to the Edit Catch Record journey beyond regression protection;
- CI/CD or infrastructure changes;
- dependency upgrades;
- unrelated refactoring.

### 13. Planning requirements

Produce a lightweight approval-ready plan with exactly these sections:

1. **Objective**
2. **Implementation Plan**
3. **File/Component Impact**
4. **Validation Plan**
5. **Risks, Assumptions and Sources**

The plan must:

- identify the current All Records link-generation code;
- identify the obsolete Unsent-to-Create-Draft branch;
- identify the Catch Record Details record-status allowlist;
- identify any Unsent mock-data fields missing from the details view;
- list every test and living-documentation reference that encodes the old behaviour;
- confirm that Create a new catch record remains unchanged;
- confirm that visual markup and pagination are unchanged;
- confirm that Step 21 Edit Catch Record behaviour is preserved;
- describe safe unknown-ID and status handling;
- ask only genuinely unresolved questions.

Do not edit files during planning.

After explicit approval, save the approved plan first to:

```text
design/github-prompts/Step 06A-correct-unsent-record-navigation-plan.md
```

Then implement only the approved correction.

### 14. Acceptance criteria

This correction is complete when:

- clicking an Unsent record date opens Catch Record Details;
- Catch Record Details renders the selected Unsent record;
- Unsent no longer opens What do you want to do with your draft record?;
- Create a new catch record still opens Create Draft Record;
- Submitted, Amended, and Late still open Catch Record Details;
- all existing-record links use stable validated record IDs;
- no visual changes are made to All Records, its table, or its pagination;
- Catch Record Details Back and Edit behaviours remain correct;
- unknown IDs and unexpected statuses retain safe handling;
- relevant tests and living documentation reflect the corrected rule;
- lint, format, tests, build, and security checks pass;
- no backend, database, API, session, cache, persistence, or unrelated functionality is introduced;
- the approved plan is saved under `design/github-prompts/` with the filename beginning `Step 06A-`.

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

- Create a new catch record -> Create Draft Record;
- Unsent record date -> Catch Record Details;
- Submitted record date -> Catch Record Details;
- Amended record date -> Catch Record Details;
- Late record date -> Catch Record Details;
- Catch Record Details Back -> All Records;
- Edit Catch Record regression for the selected details page;
- JavaScript-disabled navigation.

Confirm that All Records has no unintended visual or pagination changes.

Stop the development server after verification.

### 16. Completion report

Report:

- saved plan path;
- files changed;
- obsolete routing branch removed or updated;
- final existing-record navigation rule;
- Catch Record Details changes required for Unsent, if any;
- mock-data changes, if any;
- tests updated and results;
- living documentation updated;
- lint, format, build, and security results;
- browser routes checked;
- confirmation that Create a new catch record remains unchanged;
- confirmation that no visual changes or persistence were introduced.

if you reach any ambiguity ask me to clarify
