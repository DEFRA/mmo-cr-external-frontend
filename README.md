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

### Reference Data Service

Species and gear pages retrieve reference catalogues from the Reference Data Service on the
frontend server. For host-run development, the service URL defaults to `http://localhost:3002`.
Start the local backend services and seed their data from the `mmo-cr-backend-local` repository
before opening these pages. The frontend requires `REFERENCE_DATA_SERVICE_TOKEN`; without it,
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
