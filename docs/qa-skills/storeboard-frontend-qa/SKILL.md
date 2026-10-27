---
name: storeboard-frontend-qa
description: Test Storeboard features through the live frontend as an end user, including login, navigation, Romanian/English UI, products, inventory movements, validation, and mobile behavior. Use for QA-agent exploratory testing and regression reports; not as permission to fix code, reset data, or run backend-only tests in place of browser evidence.
---

# Storeboard frontend QA

Find reproducible user-visible failures and provide evidence of what actually
worked. Test through rendered controls and report pass, fail, blocked, or not
tested separately. A source-code assertion or passing unit test is not a browser
test result.

## Establish the run

Read the repository's AGENT.md, apps/web/DESIGN.md, current feature routes,
and the applicable feature plan or acceptance criteria. Inventory criteria live in
docs/plans/inventory-foundation.md. Inspect actual app capabilities rather than
testing roadmap placeholders as if implemented. Read the relevant browser tool
documentation before interacting. Use supported browser controls, not shell-driven
GUI automation or hidden application-state manipulation.

Record date, base URL, actual route, viewport, language, and visible role/context.
Use the URL/account supplied by the user. Credentials may be entered only into
the intended local app or its expected Keycloak login page. Never place passwords,
tokens, session cookies, or full auth callback URLs in skill files, reports,
screenshots, console dumps, or shell commands. If already signed in, do not claim
the supplied credentials were tested; either exercise the authorized login cycle
or report session restoration only. Stop repeated login attempts after a clear
credential failure, challenge, or lockout indication.

## Data and scope

Use unique names/SKUs beginning QA- with a run identifier. Record every created
item and resulting balance in the report. Do not edit existing business products,
consume their stock, change roles, create accounts, reset databases, or modify
Keycloak configuration to make a test pass. Work in a supplied test environment
and account; report unexpected external hosts before sending credentials.

For explicitly authorized feature testing in the local test account, create and
modify clearly labeled test products using normal UI flows. Test reversal only on
movements created in this run. Preserve test records with history and list them
for the user. Destructive cleanup or deleting existing records requires its own
authorization; do not treat cleanup as necessary to hide test evidence. Follow
the browser tool's confirmation requirements for all mutations.

Testing does not authorize code/configuration fixes, deployments, external tickets,
customer messages, paid actions, or broad security probing. If a backend/config
issue blocks a flow, capture the visible symptom and continue independent checks.

## Exercise the frontend

Start with a concise risk-based matrix; adapt to the request and available role:

- Authentication: sign in, callback reaches app, refresh restores session, sign
  out when in scope. Avoid reusing printed callback secrets as evidence.
- Navigation: section links, back links, deep-link refresh, active destination;
  phone hamburger includes sections/languages/sign out, closes on selection and
  Escape, and exposes correct expanded/focus state.
- Localization: EN/RO switches text and labels, persists on refresh, formats
  quantities/prices/dates, and does not translate user-entered names/SKUs.
- Catalog: loading/empty versus no-results, search with exact and absent names,
  paging where enough data exists, create/edit and readable RON/unit/type display.
- Validation: required input, duplicate SKU, negative amounts, overprecision,
  whole-piece constraints, and actionable error recovery. A disabled submit
  button alone does not prove server-side validation.
- Inventory: on a new measured QA product, opening 1.500 kg then consumption
  0.250 kg yields 1.250 kg and corresponding history; receive/waste/adjust,
  insufficient-stock failure, refresh persistence, and a deliberate reversal.
  Verify kind, delta, before/after, actor/time/reason, and reversal status.
- Services: no stock operation or misleading balance; new-service form hides or
  disables irrelevant stock entry. Do not reinterpret legacy quantities.
- Roles: evaluate controls for the current account. Without a separate authorized
  staff/admin/second-tenant account, report those role/isolation cases not tested.
- Interaction: keyboard focus/order, explicit labels, pending/error/success states,
  long Romanian copy, phone overflow, and desktop composition.

Use normal UI actions for writes and read-only DOM inspection for diagnostics.
Do not fetch internal APIs, inject auth state, invoke component methods, force
disabled controls, or alter storage to manufacture browser results. Client-side
double-click/pending-state checks do not establish database idempotency or
concurrency; report those as requiring integration tests if not separately run.

Take fresh UI observations after navigation or state changes. Read only bounded,
relevant console errors and redact sensitive data. Capture representative
screenshots after fields no longer contain credentials. Save evidence in a run
folder under docs/qa/ when the browser supports saving; otherwise describe the
observed evidence and disclose that screenshots were not saved. Never invent a
screenshot path.

## Report and stop

Write docs/qa/<run-id>.md for a full run unless the user requests another format.
Include environment, tested scope, case matrix with expected/observed result and
status, created test data, and limitations. For failures include severity,
preconditions, exact UI steps, expected/actual, reproducibility, and evidence.
Separate observed fact from suspected cause and identify whether a code finding
is source-only. Do not reproduce secrets or personal details unnecessarily.

Prioritize data corruption/blocking core tasks above cosmetic defects. Reproduce
a failure once when safe, then continue other tests; do not loop indefinitely.
Restore temporary viewport settings and leave the app in a usable state. Summarize
the most important failures, pass/blocked counts, and test records left behind.
Do not call a feature verified if its write failed or its final state was never
observed. Recommend the next fix, but implement it only when authorized.
