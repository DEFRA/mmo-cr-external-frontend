# Catch Record Web UI: Navigation Rules

## 1. Purpose

This document is the source of truth for navigation in the frontend-only Catch Record Web UI walkthrough.

It defines:

- page destinations;
- supported decision branches;
- Back-link behaviour;
- record-status routing;
- placeholder handling for features that are not implemented.

The application uses mock data and basic frontend logic only. It has no backend or database. Any data needed for navigation decisions must be stored in editable JSON object files or simple frontend state consistent with the existing project.

## 2. Route naming principles

When routes are implemented:

- use lowercase kebab-case paths;
- use meaningful, stable names;
- do not expose implementation details in URLs;
- keep route names aligned with page purposes;
- follow the existing project routing conventions where they conflict with the examples below.

The paths in this document are recommended route identifiers. The existing project structure must be inspected before implementation, and established conventions should be preserved.

## 3. Core route map

```text
/                              -> Guidance
/privacy-notice                -> Privacy Notice
/sign-in                       -> Sign In
/records                       -> All Records
/records/:recordId             -> Catch Record Details
/draft                         -> Create Draft Record
/select-vessel                 -> Select Vessel
/trip-date                     -> Same-date question
/trip-departure-date           -> When did you leave?
/trip-return-date              -> When did you return?
/departure-port                -> Departure Port
/return-port                   -> Return Port
/gear-selection               -> Gear Selection
/pots-details                  -> Pots Details
/statistical-area              -> Statistical Area
/statistical-area-other        -> Alternative Statistical Area
/species-selection             -> Species Selection
/species-weight                -> Species Weight
/catch-not-landed              -> Catch Not Landed
/check-answers                 -> Check Your Answers
/confirmation                  -> Confirmation
/account                       -> Account
/not-implemented               -> Empty Page
```

Route parameters are optional for the walkthrough if the existing project uses static mock routes. If a record identifier is used, it must resolve against editable mock JSON data.

## 4. Global header navigation

The common header must apply these rules:

- **Record your catch** service name leads to Guidance or the existing service home convention.
- **Home** leads to Guidance.
- **Your account** leads to Account.
- **Sign out** may lead to Sign In or Empty Page, depending on the agreed implementation status when the header is completed.
- **English** and **Cymraeg** may lead to Empty Page while language switching is unimplemented.

No real sign-out or localisation behaviour is required in the walkthrough.

## 5. Guidance and privacy navigation

### Guidance

- **Start now** leads to Sign In.
- **Privacy notice** leads to Privacy Notice.

### Privacy Notice

- **Back** leads to Guidance.

This Back destination is intentional because Guidance is the source of the temporary Privacy notice link.

## 6. Sign-in navigation

### Sign In

- Successful frontend continuation leads to All Records.
- **Forgotten your password?** leads to Empty Page.
- **Create an account** leads to Empty Page.
- Any other unsupported authentication link leads to Empty Page.

No credentials are validated against a real authentication service.

## 7. All Records navigation

The All Records page uses the selected mock record's status to determine the destination.

### Create action

- **Create a new catch record** leads to Create Draft Record.

### Unsent record

- Clicking the trip-end date for an **Unsent** record leads to Create Draft Record.

### Existing record details

Clicking the trip-end date for any of these statuses leads to Catch Record Details for the selected mock record:

- **Submitted**;
- **Amended**;
- **Late**.

### Status-routing rule

```text
if action is create-new:
    go to Create Draft Record
else if selected record status is Unsent:
    go to Create Draft Record
else if selected record status is Submitted, Amended or Late:
    go to Catch Record Details
else:
    go to Empty Page or use the project's safe fallback
```

The application must not infer the destination from table position, displayed date, or record creator. The selected record's mock status is the decision input.

## 8. Catch Record Details navigation

The page is read-only for the walkthrough.

- **Back** leads to All Records.
- **Edit catch record** leads to Empty Page.
- **Download PDF** leads to Empty Page.
- Any unsupported detail-page action leads to Empty Page.

If multiple mock records use the detail page, the page should render the selected record's mock data.

## 9. Create Draft Record navigation

Supported choice:

- **Complete catch record** leads to Select Vessel.

Unsupported choice:

- **Delete catch record** leads to Empty Page.

Back behaviour:

- **Back** leads to All Records.

Both creation entry points use this page:

- Create a new catch record;
- selection of an Unsent record.

## 10. Vessel navigation

### Select Vessel

- Selecting **OLGA** and continuing leads to Trip Date.
- **Back** leads to Create Draft Record.

Only vessels assigned through mock data are selectable. There is no Add Vessel route in this application.

## 11. Trip-date branching

### Same-date question

Question: Did your trip start and finish on the same date?

- **Yes** leads directly to Departure Port.
- **No** leads to Trip Departure Date.
- **Back** leads to Select Vessel.

### Trip Departure Date

- Continue leads to Trip Return Date.
- Back leads to Trip Date.

### Trip Return Date

- Continue leads to Departure Port.
- Back leads to Trip Departure Date.

The Yes branch deliberately skips both separate date-entry pages.

## 12. Port navigation

### Departure Port

- Continue leads to Return Port.
- Back returns to the page appropriate to the trip-date branch:
  - Trip Date when the user selected Yes;
  - Trip Return Date when the user selected No.

This branch-aware Back behaviour may be implemented with simple frontend state or the existing project's preferred mechanism.

### Return Port

- Continue leads to Gear Selection.
- Back leads to Departure Port.

The walkthrough uses Hastings for both ports, but navigation must not depend on that value.

## 13. Gear navigation

### Gear Selection

- Selecting **Pots** and continuing leads to Pots Details.
- Back leads to Return Port.

Other gear options may remain visible to match the design. Because only Pots has an implemented sublevel, selecting unsupported gear must not create invented business logic. If unsupported selection is allowed, continue should lead to Empty Page.

### Pots Details

- Continue leads to Statistical Area.
- Back leads to Gear Selection.

## 14. Statistical-area navigation

### Statistical Area

- Selecting one of the displayed areas and continuing leads to Species Selection.
- Selecting **Other** reveals or leads to Alternative Statistical Area, following the selected implementation pattern.
- Back leads to Pots Details.

### Alternative Statistical Area

- Selecting or entering a valid mock area and continuing leads to Species Selection.
- Back leads to Statistical Area.

Only basic walkthrough behaviour is required. Full geographical validation is out of scope.

## 15. Species navigation

### Species Selection

- Selecting **Atlantic cod (COD)** and continuing leads to Species Weight.
- Back leads to the statistical-area page used immediately before it:
  - Statistical Area for the primary branch;
  - Alternative Statistical Area for the Other branch.

- **Add species** leads to Empty Page.
- **Remove species** leads to Empty Page.

### Species Weight

- Continue leads to Catch Not Landed.
- Back leads to Species Selection.

Weight values use mock data and basic form behaviour only.

## 16. Catch-not-landed navigation

### Catch Not Landed

- **No** and Continue lead to Check Your Answers.
- **Yes** is outside the agreed happy path and leads to Empty Page unless the Yes branch is implemented under a later scope.
- Back leads to Species Weight.

## 17. Review and submission navigation

### Check Your Answers

- Confirming the declaration and selecting the submit action leads to Confirmation.
- Back leads to Catch Not Landed.

Change links should behave as follows:

- use the corresponding implemented journey page when the return journey can be handled safely;
- otherwise lead to Empty Page;
- do not invent editing, persistence, or recalculation rules.

### Confirmation

- **View your catch records** leads to All Records.
- Back navigation should not be presented as the primary action after submission.

The displayed reference number is mock data.

## 18. Account navigation

### Account

- Reached through **Your account** in the common header.
- Back leads to the preceding page where the existing project supports reliable return navigation; otherwise, Home leads to Guidance.
- Account-management actions not included in the walkthrough lead to Empty Page.

The application user cannot add vessels. Vessel assignment belongs to the separate admin application.

## 19. Empty Page rules

The Empty Page is the standard destination for visible but unimplemented functionality.

The Empty Page must:

- identify the selected feature as not implemented in the current walkthrough;
- avoid implying that an operation succeeded;
- offer a Back link or return action;
- preserve the common header and footer;
- avoid introducing new business logic.

Examples include:

- password recovery;
- account creation;
- record editing;
- PDF download;
- draft deletion;
- language switching;
- adding or removing gear, ports, species, or skippers;
- unsupported gear subjourneys;
- Catch Not Landed Yes branch.

## 20. Navigation verification checklist

The route and placeholder implementation is complete when the following can be demonstrated:

- Guidance to Privacy Notice and back;
- Guidance to Sign In;
- Sign In to All Records;
- Create New to Create Draft Record;
- Unsent date to Create Draft Record;
- Submitted date to Catch Record Details;
- Amended date to Catch Record Details;
- Late date to Catch Record Details;
- Catch Record Details unsupported actions to Empty Page;
- Draft to Vessel;
- Vessel to Trip Date;
- Trip Date Yes directly to Departure Port;
- Trip Date No through both date pages to Departure Port;
- Departure Port to Return Port;
- Return Port to Gear Selection;
- Pots to Pots Details;
- Pots Details to Statistical Area;
- displayed statistical area to Species Selection;
- Other to Alternative Statistical Area and then Species Selection;
- Species Selection to Species Weight;
- Species Weight to Catch Not Landed;
- Catch Not Landed No to Check Your Answers;
- Check Your Answers to Confirmation;
- Confirmation to All Records;
- Your account to Account;
- all unsupported links to Empty Page.
