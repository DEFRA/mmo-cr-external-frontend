# Catch Record Web UI: Happy Path Journey Map

## 1. Purpose

This document defines the agreed frontend walkthrough journey for the Catch Record Web UI.

The application has comprehensive business rules in the full service, but this implementation is intentionally limited to:

- a frontend-only walkthrough;
- an end-to-end happy path;
- mock data;
- basic branching where required to make the walkthrough coherent;
- GOV.UK Design System components rendered with Nunjucks;
- placeholder destinations for functionality that is visible but not implemented.

No backend, API, authentication service, or database is part of this implementation. All mock data must be held in editable JSON object files.

## 2. Journey overview

```text
Guidance
  |-- Privacy notice
  |     `-- Back to Guidance
  |
  `-- Start now
        `-- Sign in
              `-- All records for James Smith
                    |-- Create a new catch record
                    |     `-- Create draft record
                    |
                    |-- Select Unsent record date
                    |     `-- Create draft record
                    |
                    `-- Select Submitted, Amended or Late record date
                          `-- Catch record details
                                `-- Unimplemented actions open an Empty Page

Create draft record
  `-- Complete catch record
        `-- Select vessel
              `-- Did the trip start and finish on the same date?
                    |-- Yes
                    |     `-- Departure port
                    |
                    `-- No
                          `-- When did you leave?
                                `-- When did you return?
                                      `-- Departure port

Departure port
  `-- Return port
        `-- Gear selection
              `-- Pots details
                    `-- Statistical area
                          |-- Select an available area
                          |     `-- Species selection
                          |
                          `-- Select Other
                                `-- Alternative statistical area selection
                                      `-- Species selection

Species selection
  `-- Species weight
        `-- Is there any catch not being landed straight away?
              `-- No
                    `-- Check your answers
                          `-- Confirm and submit
                                `-- Confirmation
```

## 3. Screens in scope

### 3.1 Guidance

The Guidance page is the application entry point.

The page must provide:

- the detailed guidance content shown in the design;
- a **Start now** action leading to Sign in;
- a temporary **Privacy notice** link above the footer.

The temporary Privacy notice link exists so the walkthrough can access the privacy content while the design is being corrected.

### 3.2 Privacy Notice

The Privacy Notice page is reached from Guidance.

Its Back link must return to Guidance.

### 3.3 Sign In

The Sign In page presents the designed sign-in form.

For the walkthrough, successful continuation uses basic frontend behaviour and leads to All Records. Full authentication is out of scope.

### 3.4 All Records for James Smith

The All Records page displays mock catch records with the statuses:

- Unsent;
- Submitted;
- Amended;
- Late.

The clickable trip-end date determines the destination:

- Unsent leads to Create Draft Record;
- Submitted leads to Catch Record Details;
- Amended leads to Catch Record Details;
- Late leads to Catch Record Details.

The **Create a new catch record** action also leads to Create Draft Record.

The header menu option **Your account** links to the Account page. The Account page is not part of the core record-creation sequence, but the header navigation must point to it when that page is implemented.

### 3.5 Catch Record Details

This is a read-only presentation of an existing catch record.

Links or actions for functionality outside the walkthrough, such as editing or downloading, must lead to a reusable Empty Page rather than implementing the underlying feature.

### 3.6 Create Draft Record

This page asks what the user wants to do with the draft record.

The supported walkthrough choice is:

- Complete catch record.

Draft deletion is not part of the happy path.

### 3.7 Select Vessel

The user selects from vessels assigned to the user by an administrator through the separate admin application.

For this walkthrough:

- use mock assigned-vessel data;
- use **OLGA** as the selected vessel;
- do not provide functionality for adding a vessel;
- do not imply that the user has permission to manage vessel assignment.

### 3.8 Trip Date Journey

The page asks whether the trip started and finished on the same date.

#### Yes branch

Selecting Yes goes directly to Departure Port.

The walkthrough assumes the relevant date for this branch without requiring separate start and return date pages.

#### No branch

Selecting No follows this sequence:

1. When did you leave?
2. When did you return?
3. Departure Port.

This is a supported secondary branch required to demonstrate the agreed navigation logic.

### 3.9 Departure Port

The user selects the departure port from mock port data.

The walkthrough uses **Hastings**.

### 3.10 Return Port

The user selects the return port from mock port data.

The walkthrough uses **Hastings**.

### 3.11 Gear Selection

The available gear options are presented using the design.

The walkthrough selection is **Pots**.

The design implies that different gear choices may eventually have their own additional questions. For this implementation, only Pots has a supported sublevel.

### 3.12 Pots Details

This page captures the Pots-specific values shown in the design, including:

- total pots or traps hauled;
- total pots or traps left in the water.

The mock values should remain editable in the relevant JSON object file.

### 3.13 Statistical Area

The page presents the statistical areas relevant to the selected departure port.

The primary happy path is to select one of the displayed areas and continue.

If the user selects **Other**, the application shows the alternative statistical-area page, where an area can be selected or entered using the design pattern.

The alternative page is a supported branch because it explains the relationship between the two statistical-area designs.

### 3.14 Species Selection

The page displays species available for the selected gear.

The walkthrough selection is **Atlantic cod (COD)**.

Adding or removing vessel species is not part of the happy path.

### 3.15 Species Weight

The page captures the supported weight values for the selected species:

- weight above minimum size retained;
- weight below minimum size retained;
- weight legally discarded.

The sample values must come from editable mock JSON data.

### 3.16 Catch Not Landed

The page asks whether any catch will not be landed straight away.

The happy-path answer is **No**.

The Yes branch and its additional species and weight pages are outside the agreed happy path.

### 3.17 Check Your Answers

This page summarises the mock information collected during the journey.

It must include:

- trip details;
- ports;
- statistical area;
- gear and Pots details;
- selected species and weights;
- not-landed answer;
- the declaration and submit action shown in the design.

For the walkthrough, Change links may navigate to their corresponding implemented page where practical. Any unsupported action must use the Empty Page.

### 3.18 Confirmation

The confirmation page indicates that the catch record has been submitted and displays a mock reference number.

The page is the end of the implemented creation journey.

## 4. Supporting pages

### 4.1 Empty Page

A reusable Empty Page must be available as the destination for visible links whose functionality is deliberately not implemented.

It should clearly state that the page or feature is not included in the current frontend walkthrough and provide a safe way to return.

### 4.2 Account Page

The main header option **Your account** must link to the Account page.

The Account page is a supporting navigation destination and not part of the core create-record happy path. Account-management subfeatures may use the Empty Page until separately implemented.

## 5. Out of scope

The following are not part of this journey implementation:

- real authentication;
- backend services or APIs;
- database persistence;
- complete fisheries business rules;
- vessel assignment or vessel creation;
- skipper-management journey;
- deleting a draft;
- editing or amending a submitted record;
- PDF download;
- gear-specific subjourneys other than Pots;
- adding or removing gear;
- adding or removing species;
- adding or removing ports;
- the Catch Not Landed Yes branch;
- full validation and error-state coverage;
- production submission.

## 6. Definition of a complete walkthrough

The frontend walkthrough is complete when a user can:

1. enter through Guidance;
2. open Privacy Notice and return to Guidance;
3. continue through Sign in;
4. open All Records;
5. demonstrate the status-based record navigation;
6. start or resume an Unsent draft;
7. select the assigned vessel;
8. complete either supported trip-date branch;
9. select departure and return ports;
10. select Pots and enter Pots details;
11. select a statistical area, including the Other fallback when demonstrated;
12. select Atlantic cod and enter weights;
13. answer No to catch not landed;
14. review the answers;
15. submit the mock record;
16. reach the Confirmation page.
