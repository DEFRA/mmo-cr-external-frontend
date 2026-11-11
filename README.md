# mmo-cr-external-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_mmo-cr-external-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_mmo-cr-external-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_mmo-cr-external-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_mmo-cr-external-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_mmo-cr-external-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_mmo-cr-external-frontend)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd mmo-cr-external-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Microsoft Entra sign-in

The application uses Microsoft Entra External ID for web sign-in in production.
Register a separate web application for this frontend; do not reuse the iOS PoC
registration. Configure its web redirect URIs to include the exact callback and
post-logout URLs used below. The app uses the authorization-code flow with PKCE
and keeps its client credential on the server.

Configure these environment variables for local Entra testing and in the
deployment secret store:

```text
AUTHENTICATION_MODE=entra
ENTRA_TENANT_SUBDOMAIN=<external-tenant-subdomain>
ENTRA_CLIENT_ID=<web-app-client-id>
ENTRA_CLIENT_SECRET=<server-side-web-app-secret>
ENTRA_REDIRECT_URI=https://<frontend-host>/auth/callback
ENTRA_POST_LOGOUT_REDIRECT_URI=https://<frontend-host>/signed-out
```

Never commit `ENTRA_CLIENT_SECRET` or put it in browser code. The local development and test default is `AUTHENTICATION_MODE=mock`;
production and other deployment environments default to Entra and refuse to
start with mock authentication or incomplete Entra configuration. The
Entra-hosted sign-in journey handles password entry,
verification and password reset. The frontend stores only the signed-in flag and
basic account display details in its server-side session, not tokens.

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

On `/species-selection`, each optional weight's add/remove link appears below
its corresponding input when expanded.

### Catch answers per gear

After gear selection, the web journey repeats statistical area, species and live
weights for each selected gear in selection order. Saving species proceeds
directly to the next gear's statistical area. After the final gear, the
catch-not-landed question is asked once for the trip, followed by one
species-not-landed page when the answer is Yes. That page offers the distinct
species caught across all selected gears and records one trip-level weight per
species. Trip dates, vessel and ports also remain shared.
Gear-scoped screens carry a validated `gearId` query parameter; forms post to the
same URL so Back, refresh, and separate tabs retain the intended gear.

The `journey` session stores area, caught-species and weight answers in
`catchDetailsByGearId`, keyed by the reference-data gear ID. `catchNotLanded` and
`speciesNotLanded` remain at the trip level; older per-gear unlanded answers are
not used as trip-level answers. Gear measurements remain in `gearMeasurementDetails`
(with the existing dedicated `potsDetails` fields). Vessel species favourites
remain shared; removing a vessel species clears its selections and weights from
every gear. Removing or deselecting a gear removes its catch answers from the trip.

Check answers shows shared trip details once, followed by a separate group named
after each gear containing its measurements, statistical area and caught species.
On tablet and desktop, the preview uses standard GOV.UK summary-list rows with
bold labels, separate value and Change columns, and horizontal row dividers.
On mobile, it uses stacked label/value rows with right-aligned Change links, without
additional gear-details, area or species subsection headings. Trip-level
species-not-landed answers appear once after all gear groups, not duplicated
under each gear.
Change links target the relevant gear and return to the review; dependent answers
and newly added gears must be completed before confirmation. The check-answers
content matches the mobile review: vessel and ports, gear measurements with
concise labels, area, species and all recorded weights, followed by
species and weight kept onboard when applicable, and Save and continue. Trip
dates and declaration text are not
displayed on this page; captured answers remain stored. Record details and
amendment review retain their existing content and declaration. Existing
positive-weight validation is unchanged.
Every selected gear shows all its recorded measurements, including length/width.
Dimension labels omit explanatory examples: "Gear dimension by number" and
"Gear dimension by length or width of the gear". Optional below-minimum and
discarded weights appear only when recorded, separately for each gear.

Legacy single-gear session answers can be assigned to that one gear. Legacy
multi-gear trip-level answers are not copied or arbitrarily assigned: the area
page explains that the fisher must complete each gear's catch answers. Read-only
record details support the grouped structure while retaining legacy record display.

With `CATCH_RECORDING_ENABLED=false` (the default), these pages retain the
session-backed walkthrough. Initial draft creation, status retrieval and the
Your catch records list use the backend independently of this flag.
Set `CATCH_RECORDING_ENABLED=true` to persist journey sections, open/resume saved
records, and submit records as described below.

### Reference Data Service

Species, vessel, gear, port and map-land reads use the Reference Data Service from the frontend
server. For host-run development, the service URL defaults to `http://localhost:3002`. Start the
local backend services and seed their data from the `mmo-cr-backend-local` repository before
opening these pages. The frontend requires `REFERENCE_DATA_SERVICE_TOKEN`; without it,
reference-data-backed pages return `503`. For example, stop and restart the frontend with a
non-empty local development token accepted by the local Authentication Service stub:

```bash
REFERENCE_DATA_SERVICE_TOKEN=local-dev-token npm run dev
```

The local stub accepts any non-empty bearer token; this example is for local development only.
The token must be provided to the frontend process at startup. Setting it in another terminal
does not update an already-running frontend.

Gear selection and favourite gear lookup use the active Reference Data Service catalogue through
`GET /api/v1/reference-data/gears`; selected records are validated through
`GET /api/v1/reference-data/gears/{id}`. The service supplies mobile measurement definitions and
required/variable measurement IDs. The committed local gear seed has three active items, so the
available types differ from the former 12-item frontend walkthrough catalogue. The existing Pots
fields remain a frontend compatibility option unless Pots is included in the active API dataset.
The synthetic compatibility option is not offered when live catch recording is enabled;
all saved gear and measurement selections must have authoritative Reference Data IDs.
Old session favourites migrate only when their names match one unique API gear; unmatched IDs are
not accepted as API gear selections.

Vessel selection reads active vessels from `GET /api/v1/reference-data/vessels?view=mobile`
and confirms the selected GUID with `GET /api/v1/reference-data/vessels/{id}`. The committed
local seed contains ACHILLES and SEA SPRAY as active vessels; the old OLGA placeholder is not
an approved API vessel. This reference catalogue is not filtered to a signed-in user's fleet;
account-specific access requires a separate fleet/role integration.

Gear selection and add/remove gear lookups use `GET /api/v1/reference-data/gears` and item
validation uses `GET /api/v1/reference-data/gears/{id}`. The API supplies measurement definitions
and applicable measurement IDs; the local seed currently has three gear records, unlike the old
12-item frontend walkthrough catalogue. Pots remains a local compatibility option for its existing
dedicated catch measurement fields; it is not a reference-data gear unless present in the active
API collection. Legacy gear favourites migrate only when a unique API name/code match exists.

Port selection uses the Reference Data Service's active `ports` collection and saves its exact
port codes. Older session favourites stored as name-based slugs are converted only when their
names match one unique active API port. Unmatched slugs remain in session but are not offered
as valid choices; users must search for and reselect an approved port. The committed local seed
contains only Plymouth, Newlyn and Padstow. To load the full 624-port local catalogue (including
Hull) after starting and seeding the backend stack, run this from the frontend repository root:

```bash
curl --fail-with-body -X PUT http://localhost:3002/api/v1/reference-data/ports \
  -H 'Authorization: Bearer local-dev-token' \
  -F 'file=@../mmo-cr-backend-local/datafiles/ports.json;type=application/json'
```

This updates only the local Reference Data Service; the frontend continues to accept only active
API ports. The upload is idempotent if this version is already active.

The statistical-area map loads its land and port layers only from the Reference Data Service,
through same-origin frontend endpoints that keep the bearer token out of browser JavaScript:

| Browser endpoint      | Reference Data endpoint                | Map layer               |
| --------------------- | -------------------------------------- | ----------------------- |
| `GET /map-data/land`  | `GET /api/v1/reference-data/map/land`  | Coastline polygons      |
| `GET /map-data/ports` | `GET /api/v1/reference-data/map/ports` | Port markers and labels |

Both proxies validate the GeoJSON `metadata.dataset`, revalidate with ETags, and serve the last
good layer after a transient upstream failure. There is no bundled fallback: if either layer is
unavailable, the map shows its error state with a Retry button. The bundled
`src/client/public/offline-map/land.json` and `ports.json` files are no longer read by the browser
map; the build still generates them because land is used to calculate `overlapsSea` for the
subrectangle catalogue and `ports.json` backs server-side port data.

The alternative-area search also reads `GET /api/v1/reference-data/map/statistical-areas` and
resolves selected API features through `GET /api/v1/reference-data/map/statistical-areas/{id}` via
same-origin `/map-data/statistical-areas` proxy routes. API subrectangle results are merged with
the bundled subrectangle catalogue, which remains the offline fallback and supplies the nearby
map geometry/choices when the service dataset is incomplete.

When running this frontend with Docker Compose, its `cdp-tenant` network is external and shared
with the backend Compose project. Start the backend Compose project first, set
`REFERENCE_DATA_SERVICE_TOKEN` in the shell used by Compose, then start the frontend, for example:

```bash
REFERENCE_DATA_SERVICE_TOKEN=local-dev-token docker compose up --build -d your-frontend
```

The container
uses `http://mmo-cr-reference-data-service:3001`; do not use `localhost` for a backend container.
Production must supply the deployed service URL and an approved bearer-token credential through
the platform secret/configuration mechanism. The local Authentication Service stub is not real
authentication and must never be used in production.

### Catch Recording draft creation

Saving a valid vessel selection now creates a persistent draft through
`POST {CATCH_RECORDING_SERVICE_URL}/v1/catch-records` before continuing to the trip date.
The backend generates the record ID and friendly reference. The frontend keeps the returned
`id` as `catchRecordId`, the reference and the version in the existing journey session.
When the user opens Check your catch record, the frontend retrieves that ID through
`GET {CATCH_RECORDING_SERVICE_URL}/v1/catch-records/{catchRecordId}` without displaying
a record status and progress section on the review page. Catch details and the submission
declaration remain unchanged. The canonical record body is not copied into the session during this summary read.

The Check your catch record trip summary follows the design's unnumbered
“Trips details” heading: vessel (without a Change action), departure date, return
date, departure port, return port and statistical sub area. Multiple gears retain
separate, gear-labelled sub-area rows with gear-scoped Change links. Gear and
species details remain in their existing sections.

| Variable                             | Purpose                                                                                           | Default |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------- |
| `CATCH_RECORDING_SERVICE_URL`        | Service base URL, including any gateway path prefix                                               | Unset   |
| `CATCH_RECORDING_ENABLED`            | Enable live details, section persistence, lifecycle actions and downloads; listing is always live | `false` |
| `CATCH_RECORDING_SERVICE_TOKEN`      | Separately configured dev/mock caller bearer token; not the Reference Data Service credential     | Unset   |
| `CATCH_RECORDING_SERVICE_TIMEOUT_MS` | Request timeout, including response reading                                                       | `5000`  |
| `ENVIRONMENT`                        | Deployment environment; mock authentication is allowed only in `local`, `dev` and `test`          | `local` |

For the development gateway, use
`https://mmo-cr-catch-recording-service.api.dev.cdp-int.defra.cloud/catch-recording-service`
as the base URL. Supply the approved mock caller token through the environment/secret mechanism,
never through browser code or a committed file. Docker Compose passes these settings to the
frontend container. The frontend server must have network and TLS access to the gateway.

This is **dev/mock integration only**, not real user authentication. The simulated sign-in
does not issue user tokens. A shared mock token is not per-user identity or record isolation.
Deployments must set `ENVIRONMENT` accurately; other environments
reject mock-authenticated draft creation. Real per-user authentication is required before
production integration.

The selection page prepares a stable idempotency key in the session. Failed creation retains
that key and its vessel so a retry can recover the same draft instead of creating duplicates.
Reposting the same vessel after success reuses the saved ID. A different vessel is rejected,
including after an uncertain creation result. The **Create a new catch record** button posts
to `/records/new` to clear the current journey and begin a separate draft; it does not delete
the previous backend draft. Idempotency protection is scoped to the current session/journey.

Missing configuration, API failures, malformed responses and timeouts show the existing error
page without continuing the journey; server errors use the existing request logger.
For `/records` and other pages, HTTP 5xx failures are logged as `Request failed`
with the error stack, request method, path and status code. ECS logs expose the
stack as `error.stack_trace`; stack traces are not rendered in the error page.
Logging must be enabled (`LOG_ENABLED=true`) at `LOG_LEVEL=error` or a more verbose
level such as `info`. Use `LOG_FORMAT=pino-pretty` locally or `LOG_FORMAT=ecs`
for structured deployment logs. Network failures wrapped by the API client retain
the generic service-error stack, not the original network exception.

#### Full catch-record integration

Set `CATCH_RECORDING_ENABLED=true` and restart the frontend to use the live flows.
The Your catch records page always calls `GET /v1/catch-records`, even when this
flag is false. It requires the service URL and caller token, supports status
filtering and displays only the caller's returned records. With the flag off,
non-draft references are read-only and do not link to fixture-backed details.
Draft references open `/draft?recordId={id}`, the "What do you want to do with
your draft record?" page, independently of the flag. Listing does not enable
journey saves or submission.
The separate Catch Recording and Reference Data settings above are both required.
Bearer credentials remain on the frontend server; the browser posts ordinary forms
to the frontend, which calls the backend.

| Backend operation                                        | Frontend integration                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /v1/catch-records`                                  | Your catch records, optional status filter, up to 100 records                              |
| `POST /v1/catch-records`                                 | Create a draft after valid vessel selection                                                |
| `GET /v1/catch-records/{id}`                             | Saved details, section status/progress, explicit draft resume                              |
| `PATCH /v1/catch-records/{id}`                           | Save completed trip sections and successful gear/caught-species and unlanded-species forms |
| `DELETE /v1/catch-records/{id}`                          | Delete an eligible never-submitted draft from the draft action page or live details        |
| `GET /v1/catch-records/{id}/history`                     | History link on the details page, up to 100 events                                         |
| `POST /v1/catch-records/{id}/submission`                 | Submit from Check your catch record; confirmation uses the returned reference              |
| `POST /v1/catch-records/{id}/edit-start`                 | Return a submitted record to Draft after a valid edit reason                               |
| `GET /v1/catch-records/{id}/submissions`                 | Submission history and available artifact links on details                                 |
| `GET /v1/catch-records/{id}/submissions/{number}/{type}` | Download JSON/PDF through the frontend server                                              |
| `PUT /v1/catch-records/{id}`                             | Save all reviewed client-owned answers when Submit is clicked, before submission           |
| `POST /v1/catch-records/{id}/completion`                 | Feature-flagged staff action on submitted record details; backend permission required      |

List pagination is local pagination of the returned bounded set, not navigation
over every database record. The API does not expose a cursor or total for older
records. The list does not invent a Created by value. Details and history use
backend snapshots rather than walkthrough fixtures; API failures never fall back
to fixture records.

Resuming a draft explicitly replaces the active journey with the record's
client-owned sections and version. The current web journey supports one association
per gear type: records containing repeated instances of the same gear are readable
but cannot be resumed/amended here, avoiding silent loss of associations.
Both saved-draft entry points GET the selected record before resuming; the
trip-date Yes/No choice and departure/return date inputs prefill from those saved
answers, as do ports, gear measurements and per-gear species weights. Resuming
does not create another record or add its answers to favourites.
Saved statistical areas are restored per gear from the draft GET response.
The map opens centred on the saved selectable area with its highlight and
selection status restored; manual entry preselects the matching nearby option
or prefills Other when the saved area is outside that list. Records with no
saved area remain unselected.
Pair-fishing is retained when resuming but has no new editing UI.
For submitted records, **Edit catch record** opens the reason page without a
backend mutation. Saving a valid reason (1–2000 characters) starts the amendment
with the version and session action key captured on that page. It returns the
same record to Draft, retaining its reference and answers, and opens **Edit catch
record for [vessel]** with real Change links and the submission timestamp/actor
provided by the backend (or an explicit Not available value).

The current backend edit-start contract accepts no reason field. The reason is
therefore retained only in the frontend amendment session, not persisted as
backend audit data. No backend endpoint or payload field has been invented.
Changed answers use the existing section-save APIs and return to the amendment
review. Resubmission requires the declaration checkbox and review key, then uses
the existing version-checked PUT/submission sequence below. It does not create
another record. The amendment session is cleared only after successful submission;
API failures remain visible and version conflicts require reopening the record.
On the draft action page, selecting **Delete catch record** and pressing **Save
and continue** sends a server-side DELETE with the version captured when the page
was opened. The backend physically deletes an eligible caller-owned, never-submitted
draft from MongoDB and retains a draft-abandonment audit event. The frontend returns
to the records list only after a successful 204 response, clearing the active journey
only when it belongs to that deleted draft. Failed deletion keeps the journey and
surfaces the error; a version conflict requires reopening the draft. Drafts with
previous submissions cannot be deleted. **Complete catch record** reloads and resumes
the same saved draft without creating or submitting a record; it requires
`CATCH_RECORDING_ENABLED=true` so subsequent answers are persisted.
Saved gear/species selections missing from the current active catalogue block web
editing rather than being silently removed by walkthrough reference-ID migration.
Statistical-area codes must resolve to a Reference Data feature before saving;
an offline-only map selection cannot be persisted until Reference Data includes it.
The frontend searches with `query={code}` (supported by the deployed API) and
matches the selected code exactly. The deployed dataset is the raw ArcGIS export,
which Catch Recording resolves through `/map/statistical-areas/{OBJECTID}`, so the
saved `statisticalArea.id` is the stringified `OBJECTID` matched on `sub_code`.
Canonical features (feature `id` plus `properties.code`) are used only when
`OBJECTID` is absent. Features with neither are rejected; the frontend never
invents reference IDs.
Same-day trip dates use the Europe/London calendar date.
The trip API requires a complete section, so date and port answers are staged in
the session until the date decision, required dates and both ports are available.
Submission is blocked while trip changes remain unsaved. On an older same-day
trip, port edits send the recorded dates explicitly rather than asking the backend
to recalculate them as today. New gear association IDs are generated by the backend;
the frontend retrieves and retains them after saving, rather than inventing IDs.

Mutations use the version from the journey or displayed record as `If-Match`.
Conflicts are not automatically retried with a refreshed version. A failed section
save that may have reached the backend restores the previous local answers and requires reopening the record from
Your catch records before further edits or submission. This also covers a timeout
after a possible write and partial success when removing species affects both
gear and unlanded-species sections; section PATCH calls are not an atomic transaction.
Reference-data lookup or payload validation failures before the first write restore
the previous local answers but do not lock the journey: correct the selection or
restore the dependency and retry Save and continue.
Clicking Submit first replaces the draft through PUT using the reviewed version.
The replacement contains only vessel, trip, pairFishing, gears and speciesNotLanded;
existing pair-fishing data is preserved, with no pair-fishing editing UI.
The replacement version then becomes the expected submission version. If PUT fails,
reopen the record before continuing because PUT has no idempotent retry contract.
Reference Data failures before PUT do not lock the journey.
Submission uses a separate stable idempotency key and that replacement version,
retained on uncertain failures so a repeated submit can recover the same result
without repeating PUT.
Successful section changes reset that submission key.

`CATCH_RECORDING_COMPLETION_ENABLED=true` (default `false`) together with
`CATCH_RECORDING_ENABLED=true` exposes **Mark submitted record as complete** on
submitted record details. This is a staff-only deployment switch, not authorisation:
the backend must grant the configured caller completion permission. Do not enable it
for an ordinary external-user deployment or use a privileged shared token there.
The action posts to `/records/{id}/complete` using the displayed version and a
session action key, then redirects to refreshed details after success.
Draft/complete records cannot use the action; backend permission denials remain errors.
This lifecycle completion action is unrelated to **Complete catch record** on the
draft page, which only resumes a draft. Pair-fishing PATCH remains client-only.
Tests mock all writes; validating this integration does not create, amend, delete
or submit deployed records.

### Catch-record heading reference

Submitted records open a read-only summary from either the reference or trip-end
date link in Your catch records. Trip, gear, measurements and species values come
from the saved backend snapshots, not the current journey or reference-data
fixtures. Edit catch record retains the version-bound amendment action; Download
PDF uses the latest submission that has a PDF artifact. The submitted summary
does not display the history and older-downloads disclosure.
The submitted summary keeps the unnumbered Figma layout, independently of
Check Your Answers. A single “2. Gear used” heading introduces named gear
subheadings. Each gear shows its type, saved majority-catch area, caught species
and measurements using the snapshot measurement names without appended units.
One “3. Species caught” heading follows, with each species named in a subheading,
its “Caught with” gear and three weight rows. Weight labels include (kg), while
values remain numeric, including zero and decimal weights. The same species caught
with different gears remains separate. Species not landed appears once afterwards.
Species blocks identify the gear used so measurements and species weights cannot
be confused between gears. Trips details shows the vessel, departure/return
dates and ports, followed by the saved statistical sub area. Multiple gears have
separate gear-labelled sub-area rows; missing saved areas show Not entered.
Edit catch record and
Download PDF remain at the end of the summary.

The frontend displays the lifecycle as Submitted → edit → Draft → resubmit →
Amended. Persisted `DRAFT` records always display Draft, including records that
were submitted before. Persisted `SUBMITTED` records display Submitted after
their first submission and Amended after two or more submissions. Later edit
cycles follow the same rule. Backend lifecycle rules and stored statuses are
unchanged; routing, edit eligibility and PDF access still use the persisted status.
Late and Complete labels are preserved.

The list API does not include `numberOfSubmissions`, so the frontend retrieves
saved details for submitted records on the current page (at most ten extra GETs).
The label uses the validated backend submission count, not session history, and
therefore survives sign-out and fresh sessions. Failed detail reads are surfaced
instead of guessing Submitted. The backend's own `displayStatus` continues to use
its existing convention; this is intentionally a frontend presentation rule.

Journey pages display **New catch record** above the question until vessel
submission creates the draft. They then display the backend catch-record
reference in that position, including on validation errors and resumed records.
Starting a new record clears the previous reference. Saved-draft actions show
the reference of the opened draft, independently of any active trip.
Trip Add port pages retain the original departure/return question and search
layout; only account or standalone favourites pages use the favourites heading.
With live integration enabled, new records and drafts without selected ports
use AllPorts search for departure and return when there are no favourites.
With favourites, both steps use the existing favourites radio-list design.
AllPorts saves the trip answer directly and continues to return selection or
gears; it never adds the selected port to favourites.

A draft with the same saved departure and return port offers the Yes/No shortcut,
even if that port is not a favourite. Yes continues to gears; No opens normal
departure selection without repeating the shortcut. A previous trip or a single
favourite never triggers the shortcut for a new record. Drafts with different
ports, or only a departure port, use normal selection with each step's own saved
answer preselected. AllPorts prefills the search input; favourites lists include
the saved answer even if it is no longer a favourite, without saving it as one.
The departure-port and return-port favourites screens show only Save and continue,
without an Add port button. Account favourites are managed separately.
Review Change links preserve their return destination through AllPorts.

### Vessel favourites

With `CATCH_RECORDING_ENABLED=true`, gear, port and species favourites are
persisted using the existing backend vessel-profile APIs:

- `GET/POST /v1/vessels/{vesselId}/favourite-ports`, POST `{ portId }`
- `GET/POST /v1/vessels/{vesselId}/favourite-gears`, POST `{ gearId }`
- `GET/POST /v1/vessels/{vesselId}/favourite-species`, POST `{ speciesId }`
- `DELETE` the corresponding collection path followed by the reference item ID.

The account repeats its existing vessel-details block for each vessel supplied by
the vessel catalogue. Every Add/Remove action carries `vesselId`; multistep gear
and skipper forms retain that context. Separate `accountJourney:{vesselId}`
form states prevent interleaved account tabs from changing each other's vessel or
the active catch record. Trip pages load favourites for their selected vessel.
Writes require a vessel but do not require a catch record.

**Favourites and skippers are vessel-owned, not private user preferences.**
The backend enforces access; authorized users of the same vessel share its saved
lists, including across sign-out and browser sessions. The existing server-side
authentication settings are unchanged; simulated sign-in is not production
identity or a new source of vessel authorization. No backend changes are required.
`vesselFavourites` is only a vessel-keyed frontend cache refreshed from backend
GETs, not the durable source of truth.

Gear measurement defaults are still session-only because the existing backend
favourite-gear API stores IDs only. They are scoped to the vessel and cleared on
sign-out/session expiry; they are not copied when switching vessels.
Within that session, the journey prefills each missing measurement from the
selected vessel's favourite defaults, including when a gear already has an empty
measurement entry. Explicit trip values (including zero or a cleared input) take
priority. Submitting the selection saves the displayed values as catch answers
without changing the favourite defaults.

Reference Data still supplies port, gear and species catalogues and validates
user selections. Ports are saved by stable reference ID, projected to codes for
trip forms and disambiguated labels for account display. Gear defaults are saved
only after measurement validation. Duplicate selections are rejected; unavailable
catalogues and saved species or port references produce visible errors, not mock
data or an API-success fallback.
Empty backend profiles remain empty rather than being seeded with example account
values. Personal account details remain walkthrough content; vessel labels come
from Reference Data and saved skippers use the vessel APIs below.

Preferences are separate from trip answers and account form state. Starting,
resuming or changing a trip does not reset them or turn recorded selections into
favourites. Removing a favourite does not remove selected gears, port selections,
species weights or other catch answers and does not PATCH the catch record.
Already-selected trip items stay visible on selection pages after favourite
removal. Selecting a trip port does not implicitly add a favourite.
Adding gear or species while an active catch record is open also does not change
favourites. These additions are offered only within that record's journey;
gear measurements are saved as trip answers, not favourite defaults. Starting
or resuming another record discards these journey-only choices. Account
Add/Remove actions continue to manage favourites explicitly.

When live integration is disabled, the existing walkthrough behaviour is unchanged.

### Vessel skippers

With `CATCH_RECORDING_ENABLED=true`, the account skipper journey uses the selected
vessel's saved skippers:

| Backend operation                                    | Frontend integration                                        |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `GET /v1/vessels/{vesselId}/skippers`                | Refresh saved skippers on Your account and Remove skipper   |
| `POST /v1/vessels/{vesselId}/skippers`               | Save at confirmed submission on Check skipper details       |
| `DELETE /v1/vessels/{vesselId}/skippers/{skipperId}` | Remove selected entries using backend-generated skipper IDs |

These are authenticated server-side calls using the existing Catch Recording
settings. They require a selected vessel, not an active catch record or
`If-Match`. GET/POST return `{ vesselId, skippers: [...] }`; DELETE returns 204.
The frontend validates the returned vessel, skipper IDs and entry shapes.

The existing first/last-name form sends a combined `name` (maximum 100 characters)
with optional `email` (maximum 254 characters) and `phoneNumber` (maximum 30
characters). Details remain pending and vessel-scoped until confirmation; the
account displays only saved backend entries, not unconfirmed form data.
Creation uses a stable `Idempotency-Key` across retries of the same details.
Changed details get a new key. The backend generates IDs and enforces vessel
access and case-insensitive name duplicate prevention within each vessel.
There is no update endpoint: adding the same name does not edit an existing
skipper's contacts.

Saved skippers are vessel-owned contact entries only: creating one does not send
an invitation, link an account or grant access to the service. The live
confirmation page states this explicitly. Removing entries does not modify
catch records or revoke account access. Empty profiles show no fixture skippers;
API errors are surfaced without success redirects or fixture fallbacks.
Multiple deletions are separate operations, with successful removals reflected
locally if a subsequent deletion fails. Reload to reconcile an uncertain result.
With live integration disabled, the session-only Add skipper walkthrough remains
unchanged and the new Remove skipper route is unavailable.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag mmo-cr-external-frontend`

Build:

```bash
docker build --target development --no-cache --tag mmo-cr-external-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 mmo-cr-external-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag mmo-cr-external-frontend .
```

Run:

```bash
docker run -p 3000:3000 mmo-cr-external-frontend
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
