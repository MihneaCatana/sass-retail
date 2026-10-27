# Sales, inventory, and profitability

Status: core sales, inventory, and performance implementation delivered locally;
simulator stages 5–6 shelved on 2026-10-27 and removed from the app.
Date: 2026-10-25.
Owner: product owner to be assigned. No delivery dates or engineering estimates
are committed by this document.

## Product outcome

Help Romanian SMB owners understand what sold, maintain trustworthy stock, and
eventually see which products contribute to profit. Build the operational data
foundation before presenting financial conclusions or hypothetical graphs.

Delivery sequence:

1. Internal sales recording with inventory integration.
2. Returns and corrections.
3. Cost foundation.
4. Actual product performance and gross-profit analytics.
5. Deferred: interactive profitability simulator grounded in observed data.
6. Deferred: visual, history-based demand and preparation planning.

Target users are owners of independent shops, sweet shops, and salons. The buyer
is normally the owner; the operator may later be an employee. These remain
candidate segments: customer demand, adoption, and willingness to pay have not
been validated. Choose one primary pilot segment before optimizing its workflow.

## Starting point and boundaries

Storeboard currently has tenant workspaces, authentication, EN/RO interfaces,
products/services/consumables, exact measured quantities, stock movements,
reversals/history, catalog search, and server-side column sorting. See
../../plans/inventory-foundation.md and ../../qa/2026-10-25-qa-fixes.md.
The initial baseline had no sales module. The 2026-10-25 implementation adds
internal sales, corrections, standard costs, and estimated analytics. Simulator
stages were later shelved; see the implementation status below.
Receipt-backed actual valuation remains a future gate. See delivery status below.

Stage 1 is an internal operational sales log. It does not issue fiscal receipts,
invoices, e-Factura documents, or process payments. Recording a sale must not be
presented as satisfying fiscal or accounting obligations. Fiscal/POS integration
is a separate scope decision requiring current official-source research and
specialist validation for the target business before any compliance claim.

Currency is RON for the initial release. No multi-currency conversion, online
checkout, customer credit/debt, payment settlement, loyalty, promotions engine,
bookings, payroll, recipes, or automated service-consumable deduction is included.
Customer personal data is unnecessary for an anonymous internal sale.

## Shared product rules

- Workspace and actor come from verified authentication. All sales, costs,
  movements, returns, and analytics remain tenant-scoped under the established
  transaction/role model. DTOs belong in packages/shared-types.
- Initially, tenant-admin records/completes/corrects sales. Tenant members may
  read sales; employee write permissions and sensitive cost/profit visibility
  require deliberate policy decisions before those capabilities are enabled.
- Completed sale lines snapshot product identifier, display name, SKU, product
  type, unit, quantity, price, discount, and calculated amounts. Later catalog
  edits cannot rewrite history. Preserve relevant records rather than cascade
  deleting products referenced by completed sales.
- Use exact quantity and money arithmetic. Quantity precision follows inventory:
  whole pieces, at most three decimal places for measured units. Reject excess
  precision rather than silently rounding quantities.
- RON amounts are represented in bani. Define one documented rounding rule:
  calculate quantity times unit price exactly, round the line gross amount to
  the nearest ban (half up), then apply the entered line discount in bani.
  Sale total is the sum of final rounded line amounts. The server recalculates
  all values; the UI's total is a preview, not trusted input.
- Initial discounts are nonnegative fixed RON amounts per line, bounded by the
  line gross amount. Percentage and whole-sale discounts are deferred. Zero-price
  lines are allowed with explicit visibility; zero/negative quantities are not.
- Preserve creation/completion times in UTC, display in Europe/Bucharest, and
  filter reporting by explicit local date boundaries, including DST changes.
  No silent mixing of creation date, completion date, and correction date.
- Record a stable tax-basis identifier on sales from the start. Stage 1 totals
  are recorded operational amounts, not certified tax-exclusive revenue. Select
  and document the pilot's price/tax basis before rollout; do not guess VAT rates.
  Stage 4 financial metrics require compatible normalized sales/cost bases.
- Retries and duplicate clicks cannot complete a sale or return twice. A response
  lost after success must be recoverable through the same operation identifier.
- Financial history is append-only after completion: corrections link to the
  original operation. Every stock change links back to its sale/return line.

## Stage 1: sales MVP with the inventory bridge

### User value and journey

An owner selects goods or services, enters quantities and prices, reviews the
total, and records the completed sale. Tracked stock decreases automatically;
the owner no longer records the same event separately in inventory.

Provide a Sales list, new-sale editor, review/complete action, and sale detail.
Use draft and completed states. Drafts may be edited or discarded without stock
effect; completed records are read-only. A discarded draft is not a cancelled
completed sale. Initial sales have no implied paid/unpaid status.

### Scope and acceptance

- Add one or more catalog items, including mixed service and tracked lines.
  Default current catalog prices; permit owner price override with a reason.
- Repeated selection of the same item merges into one line in this release.
  Aggregate quantity validation still happens server-side.
- Save a draft without changing inventory. On reload, recover the saved draft
  with its current revision. Reject conflicting concurrent draft edits rather
  than silently overwriting another completion/edit.
- Review shows quantities/units, unit prices, discount, and total in RON.
  A stale stock warning must be actionable and retain the draft.
- Complete all sale lines and associated inventory deductions atomically. If
  any tracked item lacks stock, no line completes and no stock is deducted.
- Services produce sales lines but no physical stock movement. Consumables may
  be sold explicitly, but consumption implied by performing a service is deferred.
- Completing a sale with 0.250 kg from 1.500 kg leaves 1.250 kg and a sale-linked
  history entry. Two concurrent sales cannot oversell the same stock.
- Completion retries return the same sale and movements. A changed payload with
  the same operation key conflicts; no duplicate stock deductions are possible.
- Catalog price/name edits do not change a completed sale. Draft price refresh
  must be explicit; do not silently change the amount at completion.
- Generic stock reversal controls cannot independently reverse sale-owned
  movements; direct users to the linked sale correction flow. This prevents
  sales and inventory diverging through two unrelated correction paths.
- List/detail support EN/RO, mobile use, search/reference lookup, date filtering,
  paging, empty/loading/error states, readable actors, and keyboard interaction.

### Release gate

Verify completion/retry/concurrency/insufficient-stock behavior, workspace and role
boundaries, exact totals, and a real browser round trip on disposable test data.
Stage 1 can be tested internally on its own. Before live pilot use, ship at least
the full-cancellation recovery path from Stage 2 so entry mistakes are correctable.

## Stage 2: returns and corrections

### User value

Correct real mistakes and returned goods while preserving the original sale and
keeping stock and recorded sales totals consistent.

### Scope and acceptance

- First deliver full cancellation of a completed sale with a mandatory reason.
  Then add partial returns by original line and quantity. Draft deletion remains
  a separate, clearly named action.
- A return records its own actor/time/reference and links to original lines.
  Returned quantity cannot exceed sold quantity minus previous returns.
- Distinguish restockable goods from damaged/consumed/non-restockable returns.
  Only restockable quantities increase physical stock. Service corrections never
  manufacture stock. Full cancellation defaults must explain stock effects.
- Derive return amounts from original price/discount allocation, not today's
  catalog price. For repeated partial returns, allocate rounded bani cumulatively
  so a final full return equals exactly the original line amount.
- A cancelled or fully returned line cannot be returned again. Concurrent returns
  and retries cannot over-return or restore stock twice.
- Sales correction and any compensating stock movement commit atomically.
  Generic ledger reversal cannot bypass this flow.
- Show original amount, returned amount, remaining quantity, reason, and status.
  Partial/full return and cancellation are distinguishable in list and detail.
- Clearly say that the operational adjustment does not execute a card/cash refund
  or generate the fiscal correction document.

### Release gate

Verify full/partial/repeated returns, non-restockable returns, discount rounding,
mixed goods/services, concurrent returns, and stock/history reconciliation.

## Stage 3: cost foundation

### User value and decisions

Give owners a traceable cost basis for interpreting sales performance. Distinguish
purchase/production variable cost, service consumables, attributable labor, and
shared fixed overhead; these are not interchangeable measures.

Begin with owner-entered effective-dated standard unit costs for a pilot. Label
the resulting margin as estimated, even when sales quantities are actual. Missing
cost is unknown, never zero. A cost estimate alone is not actual cost of goods sold.

For actual realized gross-profit reporting, select and implement an inventory
costing approach (for example weighted average or FIFO) after learning the pilot's
receipts/accounting workflow. Document purchase receipts, opening-stock costs,
waste, returns, adjustments, and zero-stock behavior. Do not choose a method based
only on implementation convenience or imply accounting compliance.

### Acceptance and release gate

- Owner can enter a unit cost, unit/currency/basis, effective date, source category,
  and note. Retain versions and edit attribution; restrict cost access explicitly.
- Snapshot or reference the applicable cost version for every completed sale line.
  A subsequent cost edit does not silently recompute historical profit.
- Old sales lacking reliable cost remain uncovered or receive an explicitly
  labeled backfill/estimate with provenance; never fabricate historical cost.
- Normalize cost units and tax basis to sales before comparing them. Validate
  measurable quantities and allocated costs without introducing binary-float drift.
- Return cost reversal references the original cost allocation; distinguish
  non-restockable losses from goods returned to inventory.
- Expose cost coverage and estimated/actual status. Sign off the metric definitions
  and reconciliation examples before enabling any profitability claim.

## Stage 4: actual product performance and profitability

### User value

Answer which products sold, which contributed gross profit, and how performance
changed over a chosen period. Revenue analytics can launch before complete cost
coverage, but uncovered profit must remain visibly unknown.

### Metric contract

- Gross recorded sales: completed line amounts before subsequent returns.
- Net recorded sales: completed sales less cancellation/return amounts in the
  selected period, with the reporting time convention clearly stated.
- Quantity sold/returned: separate quantities per product and unit. Do not sum kg,
  litres, pieces, and service occurrences into one misleading quantity.
- Net revenue: only use this term once the agreed tax-exclusive basis is available;
  otherwise label the figure net recorded sales amount.
- Gross profit: compatible net revenue less recognized cost of goods/services
  sold, incorporating defined return adjustments. Estimated unit costs yield an
  estimated gross profit label, not actual realized profit.
- Gross margin: gross profit divided by net revenue; zero/negative denominators
  display not-applicable with an explanation rather than an invalid percentage.
- Gross profit is not net business profit. Rent, payroll, and other overhead are
  excluded unless explicitly allocated and described in a separate metric.

### Acceptance and release gate

- Filter by product/type, date range, and unit context; sort and drill down to the
  supporting sale, return, and cost records. Totals reconcile to source records.
- Show revenue/quantity trends and product comparison; avoid a chart without a
  useful decision. Provide an accessible table alternative and EN/RO labels.
- Show cost-coverage percentage and exclude unknown-cost lines from profit totals
  with an explicit partial-total warning. Separate known actual from estimated
  results; never treat uncovered lines as zero cost.
- Decide whether returns are reported by event date or original-sale cohort;
  the initial operational report uses correction event date, labeled clearly.
  Explain negative periods caused by returns from earlier sales.
- Verify changing source catalog data cannot alter historical figures. Test period
  boundaries, DST, discounts, partial returns, missing costs, and negative results.

## Stage 5: deferred profitability simulator

Decision 2026-10-27: shelved and removed from the app. This section records the
previous proposal only; it is not a current capability or committed roadmap item.

### User value

Explore what could happen if quantity, selling price, discount, cost, or a defined
fixed cost changes. Separate hypothetical scenarios from recorded performance.

### Scope and acceptance

- Select one product/service. Prefill available historical price/cost assumptions
  with source/date and their actual/estimated classification. Require confirmation
  of missing assumptions; never infer cost as zero.
- Adjust quantity sold, price, variable unit cost, and scenario fixed cost. Show
  revenue, total scenario cost, estimated scenario profit, and margin over quantity.
- Base formula: quantity * (price - variable unit cost) - scenario fixed cost,
  using consistent currency/tax basis. Explain assumptions near the chart.
- Break-even quantity is fixed cost / positive unit contribution, rounded up to
  the permitted quantity increment. Nonpositive contribution has no finite
  break-even under this model; show that explicitly.
- Graph includes readable axes/units, keyboard-operable inputs, exact-value table,
  and a clear estimated-scenario label. Price/cost changes do not mutate catalog,
  inventory, sale history, or previously reported actual performance.
- Distinguish quantity available, quantity produced, and quantity sold. Capacity,
  bulk-price changes, waste, and labor time are later optional model extensions;
  do not silently pretend the constant-cost model accounts for them.
- Saved scenarios, if implemented, preserve assumptions and model version and
  remain distinct from business records. Do not promise forecast accuracy.

### Release gate

Observe pilot owners making a concrete pricing, purchasing, or production decision
with the prototype. Check whether the inputs are available and the graph changes
their decision; visual appeal alone is insufficient evidence of value.

## Stage 6: deferred visual demand planning

Decision 2026-10-27: shelved and removed from the app. The proposal and QA data
remain historical; this is not a current capability or committed roadmap item.

The demand planner extends the price/cost simulator into a guided connected
workspace for owners planning a future day. It shows historical same-weekday
quantities, observed products on the same completed sale, and per-product
preparation suggestions that account for tracked stock, a target closing amount,
and an explicit buffer. The complete product proposal and UX contract are
[visual demand planning](visual-demand-planning-proposal.md) and
[the designer handoff](demand-planner-ux-design.md).

The initial historical baseline is a median over at least eight comparable
transaction weekdays. This threshold is a hypothesis, not a validated forecast
rule. Product relationships mean co-purchases in the same sale, not causation or
statistical time-series correlation. Suggestions are hypothetical: they do not
create production records, purchases, sales, costs, or stock movements. Services,
recipes, waste learning, and capacity planning are outside this stage.

The API is tenant-scoped and read-only, and the first UI is owner-only. Browser
QA, realistic-history reconciliation, and customer decision-value validation
remain release gates. Do not describe local implementation as a reliable forecast.

## Measurement and rollout

Use Now/Next/Later stage gates, not invented deadlines. Pilot with one accessible
segment first; keep salon service-duration and sweet-shop production concerns as
separate research threads. Local development verification is not production launch
approval. Resolve applicable deployment readiness debt in TECH_DEBT.md before a
live business rollout, including tested backup/restore and authentication setup.

Proposed two-week pilot measures (targets require owner agreement):

| Measure | Definition/source | Decision supported |
| --- | --- | --- |
| Activation | Pilot workspaces completing a first real sale / enrolled workspaces | Can users begin? |
| Repeat use | Activated workspaces recording sales on multiple operating days / activated workspaces | Does it fit daily work? |
| Task time | Median observed start-to-completion time for comparable sales, including failed attempts | Is recording practical? |
| Reconciliation | Sampled sale lines with correct linked stock effect / sampled tracked sale lines | Can operators trust it? |
| Recovery | Observed mistaken entries corrected successfully / observed mistaken entries | Can users recover? |
| Cost coverage | Net sales amount with a usable cost basis / eligible net sales amount, with zero/negative periods handled explicitly | Is profit reporting defensible? |
| Commercial signal | Owner commitment to continue/pay after a concrete trial | Is value sufficient? |

Collect baselines through observation and consented interviews before claiming
improvement. Do not log customer identity or full sale contents merely to count
events. Guardrails: duplicate completion, oversold stock, missing movements,
incorrect return totals, unexplained cost gaps, and support effort.

## Implementation handoff and open decisions

This document authorizes no code or deployment by itself. Each stage needs a
coding plan, shared contracts, forward tenant migrations, meaningful tests,
browser QA, rollout notes, and truthful completion status before handoff.
Use apps/web/DESIGN.md and the designer/QA skills for interaction requirements.

Resolve before the relevant stage:

1. Pilot segment and operator; whether manual sales recording replaces an existing
   task or duplicates an existing POS entry. If duplication is unacceptable,
   investigate importing/integrating existing sales before a custom checkout.
2. Pilot price/tax basis and wording (Stage 1); no hardcoded legal rates/deadlines.
3. Staff sales permissions and visibility of financial data (before staff rollout).
4. Cost-capture sources and valuation method (Stage 3 actual-cost gate).
5. Service labor/capacity model and sweet-shop recipes/waste model (only when
   evidence supports extending Stage 5).

Internal product hypotheses and tests must remain separate from customer evidence.
Do not automatically build all stages if pilot findings favor a different
next step.

## Implementation status (updated 2026-10-27)

| Stage | Local implementation | Remaining gate |
| --- | --- | --- |
| 1 | Saved/revisioned drafts, mixed product/service sales, review, atomic completion and stock links, search/filter/paging | Live frontend QA and pilot workflow validation |
| 2 | Full cancellation, partial returns, explicit restocking, original-price cumulative rounding, retry protection | Live recovery-journey QA |
| 3 | Immutable effective-dated standard costs and completion-time snapshots | Receipt-backed valuation method and actual costing remain unimplemented |
| 4 | Event-date performance, product/type/date filters, sales drilldown, compatible-basis estimated profit and cost coverage | Live frontend QA and agreed pilot metric reconciliation; no actual realized profit claim |
| 5 | Shelved; simulator page and UI code removed | Revisit only when requested |
| 6 | Shelved; planner page, planning API, and UI code removed | Revisit only when requested |

Automated evidence: 62 API tests, 47 frontend tests, production builds, shared
exact-money checks and 40 deployed-API integration assertions pass. The integration
script uses disposable workspaces and is wired into CI; local success is not a
claim that remote CI has run.

Independent designer source review found issues that were corrected. The former
demand planner had source-level/build/test checks, but no interactive browser QA
or customer decision-value validation. Both simulator experiences were removed
at the user's request. QA-prefixed synthetic sales and products created to inspect
the planner remain in tenant `lenovo` and affect stock and reports. See [design review](DESIGN-VALIDATION.md),
the [implementation plan](../../plans/sales-implementation.md),
[demand planner UX](demand-planner-ux-design.md), and
[planner QA report](../../qa/2026-10-26-demand-planner-frontend-qa.md).
