# 1. Shared CI workflows live in mmo-cr-devops-common

Date: 2026-09-18

## Status

Accepted

## Context

The Copilot analytics pipeline — a GitHub Actions workflow plus two PowerShell scripts that
classify commits and publish metrics to the dashboard — was implemented inline in this repository.
The same pipeline is needed by every MMO Catch Recording service. Copying roughly 350 lines of
workflow and script into each repository would mean fixes have to be applied N times and would
drift in practice.

DEFRA's software development standards require services to be built in the open with maintainable,
centrally analysed code. A shared implementation supports that; N copies do not.

## Decision

Cross-repository CI logic for MMO Catch Recording is implemented once in
`DEFRA/mmo-cr-devops-common` as a **reusable workflow** (`on: workflow_call`), with any scripts it
needs stored alongside it. Consuming repositories keep only a thin caller that supplies their
triggers and their own configuration.

Specific consequences of how GitHub implements reusable workflows shaped the design:

- **Configuration stays with the consumer.** A reusable workflow resolves `vars` and `secrets`
  against the *caller*, never against the repository hosting it. `COPILOT_ANALYTICS_INGEST_URL` and
  `COPILOT_INGEST_TOKEN` therefore remain repository settings here and are passed in as an input and
  a named secret. They can later move to DEFRA organisation-level settings with no code change.
- **The shared repository is checked out explicitly.** `actions/checkout` inside a called workflow
  checks out the caller, so the reusable workflow checks itself out a second time using the
  `job.workflow_repository` and `job.workflow_sha` contexts. This pins the scripts to the exact
  commit of the workflow being run, so YAML and scripts cannot drift apart.
- **Safety gates moved into the reusable workflow.** `continue-on-error` and `if` are not both
  usable on a job that calls a reusable workflow (`continue-on-error` is unsupported there), so the
  "analytics must never fail a pull request" guarantee and the fork/Dependabot exclusion are
  enforced by the job that does the work. Consumers inherit them and cannot omit them.
- **Callers reference `@main`.** Chosen for simplicity while there are few consumers. A consumer
  that needs insulation from upstream change can pin a commit SHA instead.

## Consequences

**Positive**

- One implementation to fix, review and secure; improvements reach every consumer immediately.
- A new service adopts analytics with roughly 25 lines of YAML and two repository settings.
- Safety and security gates cannot be accidentally dropped by a consumer.

**Negative / risks**

- `@main` means an upstream change takes effect with no review gate on the consumer side. Mitigated
  by the shared job being `continue-on-error`, and revisitable by adopting a `v1` tag.
- `mmo-cr-devops-common` becomes a shared dependency of every pipeline; a breaking change there is a
  cross-service incident.
- The `job.workflow_*` contexts are relatively recent GitHub additions, and tooling such as
  actionlint does not yet recognise them. The reusable workflow falls back to
  `DEFRA/mmo-cr-devops-common@main` if they are unavailable, and fails fast with an explicit error
  if the shared checkout still does not resolve.
- Consumers must still be configured with the ingest variable and secret individually until those
  move to organisation level.
