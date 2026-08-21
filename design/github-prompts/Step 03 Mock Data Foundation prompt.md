# GitHub Copilot Prompt: Step 03 Mock Data Foundation

## Recommended reasoning effort

- **Planning:** High
- **Implementation:** High

Treat this as a **Standard frontend change** unless repository inspection identifies a genuine architecture, security, session, cache, integration, or cross-domain concern.

Use the **Frontend Developer** agent's lightweight planning and approval workflow. Do not invoke the heavyweight Frontend Planner or Frontend Orchestrator merely because the data covers several pages. This step remains within the existing frontend application and introduces no external integration or persistence.

Do not implement before the lightweight plan has been presented and explicitly approved.

After approval, the first implementation action must be to save the approved plan to:

```text
github-prompts/03-mock-data-foundation-plan.md
```

Then implement only the approved scope.

---

## ARTIFACT-INSTRUCTION

```text
artifact-type: github-copilot-implementation-prompt
artifact-path: github-prompts/03-mock-data-foundation.md
plan-path: github-prompts/03-mock-data-foundation-plan.md
project-status: existing-project
implementation-step: 03-mock-data-foundation
work-classification: standard
primary-agent: Frontend Developer
```

## ARTIFACT-CONTENT

### 1. Objective

Create a small, reusable, editable mock-data foundation for the Catch Record Web UI frontend walkthrough.

The data layer must:

- store walkthrough data as constants in JSON-compatible objects or JSON files;
- expose one shared data-access interface, conceptually `getData(pageName)`;
- keep large mock objects out of Hapi route definitions and controllers;
- supply the data required by the agreed pages and navigation branches;
- return independent data values so one request or test cannot mutate the source data for another;
- be simple to replace or adapt in later implementation steps;
- introduce no API, database, repository, remote service, or production persistence.

This step must integrate the data foundation with the existing Step 02 placeholders only where necessary to prove that the interface works. Do not implement detailed page designs.

### 2. Authoritative functional inputs

Read these approved artifacts before planning:

```text
[HAPPY_PATH_JOURNEY_MAP_PATH]
[NAVIGATION_RULES_PATH]
[IMPLEMENTATION_PLAN_PATH]
[STEP_02_APPROVED_PLAN_PATH]
```

Replace the placeholders with safe repository-relative or workspace paths for:

- the approved Happy Path Journey Map;
- the approved Navigation Rules;
- the approved implementation plan;
- the approved Step 02 route and placeholder plan.

Also inspect the routes, controllers, templates, helpers, and tests delivered by Step 02.

These artifacts and the existing Step 02 implementation are the functional source of truth. If they conflict, stop and ask for clarification instead of inventing a data shape or navigation rule.

### 3. Visual design inputs

This is a data-foundation task, not a visual implementation task.

Do not fetch, ingest, or analyse Figma frames or page PNGs in this step. Page-specific visual assets will be introduced once in the later page implementation prompts.

Do not modify the approved Step 01 application shell or add page-specific visual styling.

### 4. Existing-project constraints

The project already exists.

Before planning or editing:

1. Read `.github/copilot-instructions.md`.
2. Read all applicable files under `.github/instructions/`, including Node/Nunjucks, testing, security, accessibility, and data-handling guidance.
3. Read the Frontend Developer agent definition.
4. Inspect the current Hapi.js route and controller conventions.
5. Inspect the project's module system, configuration, test setup, and file-naming conventions.
6. Inspect whether the repository already has fixtures, view-model builders, test-data factories, JSON imports, cloning helpers, or mock-data conventions.
7. Inspect the routes and placeholders created in Step 02.
8. Reuse suitable existing conventions rather than creating a parallel data architecture.
9. Do not scaffold a new project.
10. Do not change project dependencies unless an existing approved dependency cannot satisfy this scoped task and clarification is obtained first.

### 5. Data-layer design principles

Use the simplest design that satisfies the walkthrough.

#### 5.1 Editable source data

Store mock content in editable JSON-compatible constants or `.json` files according to the repository's existing conventions.

The data must be:

- readable by developers and testers;
- organised by page or small domain grouping;
- free from executable functions inside the source objects;
- free from environment-specific paths;
- free from secrets and real personal information;
- valid for the existing Node.js module and JSON-import conventions;
- easy to update without editing controllers.

Do not create one unstructured, monolithic object containing the entire application when smaller coherent files are clearer.

Do not fragment the data into one file per individual label when a small domain grouping is more maintainable.

#### 5.2 Shared accessor

Expose one shared interface equivalent to:

```text
getData(pageName)
```

The exact filename and export style must follow project conventions.

The accessor must:

- accept a stable, documented page or data-set key;
- return the mock data associated with that key;
- avoid exposing the mutable source object directly;
- define explicit behaviour for unknown keys;
- remain synchronous unless the existing project has a compelling established asynchronous convention;
- contain no route navigation logic;
- contain no Nunjucks rendering logic;
- contain no business calculations beyond minimal data normalisation required by the existing view convention.

Prefer a clear key-to-data mapping over dynamic filesystem path construction.

Do not allow user-controlled input to become a file path or module name.

#### 5.3 Immutability between consumers

A controller, helper, template preparation function, or test must not be able to mutate shared source data for later requests.

Use an approach compatible with the supported Node.js version and the actual data types. Plain JSON-compatible data may use safe structured cloning or another established repository pattern.

Do not introduce a large third-party cloning dependency.

Tests must prove that mutations to one returned value do not affect:

- the source object;
- a later `getData` call;
- another test.

#### 5.4 Unknown-key behaviour

Choose and document one predictable behaviour for an unknown page name, based on project conventions:

- throw a clear development error with no sensitive detail; or
- return a safe empty object where that is already the established convention.

Do not silently return unrelated data.

Do not expose filesystem paths, stack traces, secrets, or internals to rendered users.

Tests must cover the chosen behaviour.

### 6. Required mock-data coverage

Create enough coherent mock data to support all agreed walkthrough pages and branches. Use JSON-safe values.

#### 6.1 Service and account identity

Include:

- service name: `Record your catch`;
- record-list owner: `James Smith`;
- account email matching the approved walkthrough example or a clearly fictional equivalent;
- fictional contact details only where later Account-page implementation requires them.

Do not use real personal information.

#### 6.2 Assigned vessel

Include the assigned vessel:

```text
Name: OLGA
Registration: FIN-126-U
```

Represent vessel assignment as existing data. Do not include an Add Vessel permission or user-driven vessel assignment capability.

#### 6.3 Catch-record list

Include at least four mock records so every Step 02 status branch can be demonstrated:

- one Unsent record;
- one Submitted record;
- one Amended record;
- one Late record.

Each record should have a stable fictional identifier and the fields currently required by the placeholder and later All Records implementation, including where applicable:

- record ID;
- trip-end date;
- vessel name or vessel reference;
- status;
- created-by display value;
- submitted or amended metadata only where required later.

Keep status values canonical and documented. Route decisions must not depend on display labels, array position, visible date, or creator name.

#### 6.4 Read-only catch-record details

Include one coherent detail record for the supported read-only Catch Record Details page, with:

- reference number;
- vessel;
- departure and return dates;
- departure and return ports;
- statistical area;
- gear;
- Pots-specific values;
- species;
- weight values;
- not-landed answer and related display data where used by the design.

Use internally consistent values across the record list, details, check-answers summary, and confirmation data where the same record concept is represented.

#### 6.5 Draft action and assigned-vessel selection

Include data required to render:

- Complete catch record;
- Delete catch record;
- assigned-vessel choices containing OLGA.

Actions may be represented as view data only if that matches existing conventions. Do not encode route destinations inside content JSON unless the repository already has an approved navigation-data pattern.

#### 6.6 Trip dates

Include stable example trip dates for:

- same-date walkthrough branch;
- different-date walkthrough branch;
- departure date;
- return date.

Use an unambiguous machine-readable value for logic and a separate display value only where needed. Do not build a general date-formatting service in this step.

#### 6.7 Ports

Include a small mock port list containing:

- Hastings;
- a few fictional or approved design-example alternatives where useful for later selection controls.

If using real port names from the supplied design, treat them as public reference data, not personal data.

Provide a stable ID or code when the later control should not rely on display text.

#### 6.8 Gear and Pots details

Include the gear options required by the walkthrough design, with:

- a stable gear ID;
- display label;
- enough metadata to identify Pots as the only gear with an implemented sublevel.

Include the walkthrough Pots values:

- total pots or traps hauled;
- total pots or traps left in water.

Do not invent subjourney questions for other gear types.

#### 6.9 Statistical areas

Include:

- a small list of nearby statistical areas;
- stable area IDs/codes;
- one selected area for the primary branch;
- an alternative area example for the Other branch.

Do not add geographic calculations or validation.

#### 6.10 Species and weights

Include species options containing:

```text
Atlantic cod (COD)
Haddock (HAD)
Salmon (SAL)
```

Include stable IDs or codes and the walkthrough weight values for Atlantic cod:

- weight above minimum size retained;
- weight below minimum size retained;
- weight legally discarded.

Use numeric values for calculations or form defaults and explicit unit metadata where needed. Do not store numbers only as preformatted text if later pages need numeric inputs.

#### 6.11 Catch not landed

Include the happy-path answer:

```text
No
```

The Yes subjourney remains out of scope. Data may include the Yes option for rendering a binary question, but do not create species-not-landed workflow data beyond what existing placeholders need.

#### 6.12 Check Your Answers

Provide or compose a coherent read-only data shape that later supports these sections:

- trip details;
- ports;
- statistical area;
- gear and Pots details;
- species and weights;
- Catch Not Landed answer.

Avoid duplicating the same value in multiple source files when a clear shared domain object can supply it. Equally, do not introduce a complicated domain model merely to avoid a small amount of intentional display data.

#### 6.13 Confirmation

Include a fictional mock reference number consistent with the approved walkthrough, for example:

```text
A1234520260727150815
```

Clearly identify the value as mock data in developer-facing documentation. The rendered page may present the value normally as part of the walkthrough.

### 7. Suggested data keys

Determine final names from repository conventions. A clear accessor may support keys equivalent to:

```text
service
account
allRecords
catchRecordDetails
createDraftRecord
selectVessel
tripDates
ports
gearSelection
potsDetails
statisticalAreas
speciesSelection
speciesWeights
catchNotLanded
checkAnswers
confirmation
```

Do not make callers depend on physical filenames.

Document the supported keys in code comments, tests, or a concise developer document according to existing repository practice.

### 8. Integration with Step 02 placeholders

Integrate only enough routes or controllers to prove that the shared accessor works end to end.

At minimum:

- All Records must receive its four record-status examples from the shared data layer instead of route-local arrays or hard-coded template records.
- Select Vessel must receive OLGA from the shared data layer.
- Gear Selection must receive gear options from the shared data layer.
- Statistical Area must receive area options from the shared data layer.
- Species Selection must receive species options from the shared data layer.
- Confirmation must receive its mock reference from the shared data layer.

Where Step 02 introduced temporary local placeholder values that now belong in shared mock data, replace those values cleanly.

Do not convert all placeholders into detailed final pages. Keep templates minimal.

Do not put route destinations into source data merely to reduce controller code. Navigation continues to follow the approved Navigation Rules and should remain explicit in controllers/helpers.

### 9. File and module boundaries

Use existing safe relative paths and naming conventions. The implementation should result in the equivalent of:

```text
src/server/common/data/
  get-data.js
  get-data.test.js
  pages-or-domains/*.js-or-json
```

The exact paths and extensions are illustrative only.

Prefer:

- data files for static mock values;
- one accessor module;
- small helper or view-model modules only when the existing project clearly needs them;
- colocated tests consistent with project conventions.

Avoid:

- a new service container;
- dependency injection infrastructure;
- a repository pattern;
- database-shaped abstractions;
- API response emulation layers;
- schema frameworks not already used by the project;
- a general-purpose fixture library;
- dynamic imports based on caller input;
- excessive getters for individual primitive values.

### 10. Security and privacy requirements

- Use fictional mock personal information only.
- Do not copy real user data into source control.
- Do not include secrets, credentials, tokens, or environment values.
- Do not log mock account or record details unnecessarily.
- Do not use caller-controlled strings as filesystem paths.
- Preserve Nunjucks auto-escaping.
- Validate route or query identifiers independently of the mock-data accessor.
- Do not mistake mock data for trusted external input in later production code.
- Clearly document that this layer is for the frontend walkthrough only.

### 11. Testing requirements

Write Vitest tests alongside the implementation, following project instructions.

At minimum, test:

- every supported data key returns the expected top-level shape;
- the required James Smith record-list data exists;
- each canonical status exists exactly as required for the walkthrough;
- OLGA and FIN-126-U exist in assigned-vessel data;
- Hastings exists in port data;
- Pots is marked as the only implemented gear sublevel;
- statistical-area primary and Other examples are available;
- Atlantic cod, Haddock, and Salmon are available with stable codes;
- Atlantic cod weight values use the intended numeric shape;
- Catch Not Landed defaults to No for the walkthrough;
- the confirmation reference is returned;
- unknown-key behaviour is explicit and tested;
- one returned object can be mutated without changing a later return value;
- source constants remain unchanged after consumer mutation;
- Step 02 integrated routes render using shared data;
- record-status navigation still reaches the Step 02 destinations;
- no regressions occur in existing tests.

Avoid brittle full-object snapshots where focused assertions communicate the contract more clearly.

Meet the repository's coverage targets, including the core-logic threshold where the accessor or view-data helper is classified as core logic.

### 12. Documentation requirements

Add concise developer documentation in the most appropriate existing location.

Document:

- the purpose of the mock-data layer;
- that it is walkthrough-only and non-persistent;
- where source files live;
- how to request a data set through `getData(pageName)` or the approved equivalent;
- supported keys;
- unknown-key behaviour;
- immutability expectations;
- how to add or edit mock values;
- the prohibition on real personal data and secrets.

Do not create a new top-level README if an existing developer document is more appropriate.

### 13. Out of scope

Do not implement:

- detailed Figma page designs;
- page-specific SCSS;
- real authentication or authorisation;
- production sessions or cache state;
- APIs or HTTP clients;
- databases or repositories;
- file writes or persistence;
- final form submission handling;
- complete validation and error-state designs;
- final view-model architecture for every future page;
- geographic calculations;
- fisheries quota or regulatory business logic;
- vessel administration;
- skipper management;
- gear subjourneys other than representing Pots data;
- Catch Not Landed Yes subjourney;
- record editing or PDF generation;
- localisation;
- CI/CD or infrastructure changes;
- unrelated refactoring;
- dependency upgrades without explicit approval.

### 14. Planning requirements

Produce a lightweight approval-ready plan with exactly these sections:

1. **Objective**
2. **Implementation Plan**
3. **File/Component Impact**
4. **Validation Plan**
5. **Risks, Assumptions and Sources**

The plan must:

- summarise existing mock-data or fixture conventions found in the repository;
- state whether source values will use `.json` files or exported JSON-compatible constants and why;
- define the proposed supported data keys;
- show the proposed high-level data-file grouping;
- define unknown-key behaviour;
- define how independent return values will be guaranteed;
- identify the Step 02 controllers/templates that will receive data in this step;
- confirm navigation logic will remain outside the data source;
- list tests by contract and behaviour;
- identify any ambiguity requiring clarification;
- avoid proposing APIs, databases, repositories, sessions, or speculative production abstractions.

Do not edit files during planning.

After explicit approval, save the approved plan first to:

```text
github-prompts/03-mock-data-foundation-plan.md
```

Then implement only the approved scope.

### 15. Acceptance criteria

This step is complete when:

- mock walkthrough data is stored outside route definitions and Nunjucks templates;
- source data uses editable JSON files or JSON-compatible constants consistent with project conventions;
- one shared accessor equivalent to `getData(pageName)` supplies the data;
- the accessor uses a fixed explicit key mapping rather than caller-controlled dynamic paths;
- all supported keys are documented;
- unknown-key behaviour is predictable and tested;
- returned data cannot mutate shared source values or later responses;
- the data covers James Smith, OLGA, the four record statuses, ports, gear, Pots values, statistical areas, species, weights, Catch Not Landed, check answers, and confirmation reference;
- values used across records, details, review, and confirmation are internally coherent;
- Step 02's selected placeholder routes consume the shared data successfully;
- Step 02's navigation rules still pass;
- no detailed visual-page implementation has been introduced;
- no API, database, repository, remote call, filesystem write, session, or production persistence has been introduced;
- fictional data only is committed;
- Vitest coverage is added for accessor behaviour, immutability, data contracts, and integrated routes;
- lint, format, tests, frontend build, and security checks pass;
- the approved plan is saved at the required path.

### 16. Validation

Use the repository's established scripts and Definition of Done. Run the applicable equivalents of:

```text
npm run lint:js
npm run lint:scss
npm run format:check
npm test
npm run build:frontend
npm run security-audit
```

Start the application only if required to smoke-test the Step 02 pages receiving shared data. If started, verify at minimum:

- All Records displays the four mock status examples;
- Select Vessel displays OLGA;
- Gear Selection displays Pots;
- Statistical Area displays mock areas;
- Species Selection displays Atlantic cod, Haddock, and Salmon;
- Confirmation displays the mock reference;
- navigation remains functional with JavaScript disabled.

This step does not require Figma or PNG visual comparison. Confirm only that the approved common shell and placeholder presentation remain intact.

Stop the development server after verification.

### 17. Completion report

Report:

- saved plan path;
- files created, changed, or removed;
- final source-data organisation;
- supported accessor keys;
- unknown-key behaviour;
- cloning or immutability approach;
- Step 02 routes integrated with shared data;
- tests and coverage results;
- lint, format, build, and security results;
- any temporary placeholder data intentionally left outside the shared layer and why;
- any follow-up considerations for Step 04 and later detailed-page implementations.

if you reach any ambiguity ask me to clarify
