# Sales frontend QA — 2026-10-25

## Result

Live frontend validation is **blocked by browser tooling**, not passed. No application defects were observed because no application screen could be reached. No UI inputs, credential submissions, test records, business mutations, or screenshots occurred.

Target: `http://localhost:8082/app/sales`. Actual rendered route, viewport, language, account role, and session state could not be observed.

## Tool evidence

1. `cua.getState()` returned `browsers: []`.
2. Supported recovery `cua.createBrowserTab('iab', 'http://localhost:8082/app/sales', {visible:true})` returned `Browser is not available: iab`.
3. Computer Use skill and its guidance, API and confirmations were read. The supported `@oai/sky` fallback listed one native Brave window. Attempting to select/read it returned: “Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.”
4. UI operations stopped as required. No screenshot was available to save or provide for independent designer review.

## Risk-based acceptance matrix

All 12 frontend cases below are **Blocked**. Expected results are acceptance criteria, not observed behavior.

| Priority | Case | Expected frontend evidence |
|---|---|---|
| P1 | Login/session and navigation | Authorized local login reaches sales; reload restores session; active navigation and deep links work. |
| P1 | Saved draft | Fresh QA-prefixed draft reloads with quantities, price, discount and tax basis intact; stock/history remain unchanged. |
| P1 | Mixed completion | QA measured product plus service completes with exact rounded totals; stock deducts goods only; linked history reflects before/after. |
| P1 | Insufficient stock | Completion explains failure, retains editable draft and creates no partial completion or stock deduction. |
| P1 | Partial returns | Restockable return adds only chosen goods quantities; non-restockable return changes sales totals without stock; service return never changes stock. |
| P1 | Full cancellation | Deliberate reason and stock choice produce original-sale correction, accurate remaining quantities/totals and linked history. |
| P1 | Historical snapshot | Later QA catalog name/price edit leaves completed sale snapshots unchanged. |
| P2 | Standard cost versions | Effective dates, source, basis and version are clear; newer version does not rewrite a previous completed sale. |
| P2 | Analytics | Date/product filters and source drilldowns work; estimated wording and unknown/incompatible cost coverage are explicit. |
| P2 | Simulator | Quantity/price/cost/fixed-cost changes update chart/table/break-even; nonpositive contribution has no finite break-even; saved records remain unchanged. |
| P2 | EN/RO | Labels, validation, money, quantities and Bucharest dates switch appropriately and persist after refresh; QA names remain unchanged. |
| P2 | Mobile/accessibility | Narrow-screen navigation, focus, labels and overflow are usable; hamburger exposes sections/languages/sign out. |

## Automated evidence boundary

The parent implementation agent reports **47 frontend tests, 62 API tests and 40 integration checks passing** on the final deployed implementation. These counts were supplied to this QA agent and were not independently rerun here. They do not establish rendered frontend behavior.

Transactional atomicity, concurrent/idempotent completion, tenant and role isolation, cumulative bani allocation, cost version attribution, and Bucharest/DST boundaries require API/integration evidence. Browser observations can demonstrate visible outcomes for a single journey but cannot establish these database invariants.

## Retained data and next action

No test fixtures were created and no cleanup is needed. Resume this matrix when a supported browser surface is available, using fresh unique `QA-` names/SKUs and only the authorized local account. Preserve resulting QA history and record exact balances and sale identifiers in the resumed report. Do not infer a release sign-off from this blocked run.
