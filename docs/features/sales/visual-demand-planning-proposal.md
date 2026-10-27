# Visual demand planning proposal

Status: shelved on 2026-10-27 at the user's request. The planner UI and API were
removed; this proposal is retained as historical context, not an active roadmap
commitment. QA-prefixed synthetic records created for inspection remain in the
workspace and affect stock and reports.

## Problem and intended outcome

An owner of a small sweets shop or independent retailer needs to decide what to
prepare for a particular day and which products are commonly bought together.
The current simulator only calculates a hypothetical amount from manually entered
price, cost, and quantity. It does not use sales history to estimate demand or
support a production decision.

The intended outcome is a daily plan grounded in the workspace's own completed
sales: an owner can inspect comparable-day demand, discover products frequently
bought in the same transaction, and create a hypothetical quantity plan that
accounts for the current tracked stock balance and a manually chosen buffer.

Hair salons have a different capacity and appointment problem. Do not treat
service occurrences as units to produce; validate that workflow separately.

## Product recommendation

Evolve the simulator into a **Demand planner** with a guided, connected visual
canvas inspired by node editors such as n8n. Keep the first release opinionated:
the canvas shows a small set of supported steps, rather than allowing arbitrary
automation graphs.

Proposed flow:

`Sales history -> Choose a date -> Compare similar days -> Explore related products -> Plan quantities`

Each node is a real, inspectable step. Selecting a node opens the relevant chart
and controls. Users can choose products, combine products into a plan, and see
how a date or product selection changes the result. On phones, the canvas becomes
a linear step list with the same relationships and actions.

This creates a more visual workflow while keeping the main job clear: plan the
day's quantities. Do not turn the screen into a generic automation builder before
owners demonstrate they need arbitrary nodes, branches, or reusable workflows.

## Proposed visualizations

1. **Seasonality heatmap:** comparable weekday by week, using quantity sold for
   one selected product. A day-by-day line chart shows the underlying history and
   the selected date's baseline. Do not combine unlike units into one quantity.
2. **Related products network:** nodes are products and links mean they appeared
   on the same completed sale. Link strength represents observed co-purchase
   frequency. Label this “often bought together,” not statistical causation or
   demand correlation. Provide an accessible ranked-pairs table alternative.
3. **Daily quantity plan:** compare historical baseline demand, current on-hand
   stock balance, target closing stock, and planned production quantity. A table provides
   exact amounts and units.

Chart types are decision-specific; avoid adding a chart gallery without a user
question attached to each view.

## Forecast and planning contract

- The initial baseline is descriptive: median quantity sold on the same weekday
  across the selected historical window. Call it a historical baseline or
  planning estimate, not an accurate forecast.
- Require a proposed minimum of eight comparable weekdays before showing that
  baseline. If history is insufficient, show how much history exists and explain
  what will become available as more sales are recorded. Validate this threshold
  with pilot owners before treating it as a product rule.
- Show the data window, count of comparable days, and whether returns/cancellations
  are excluded or netted. Use completed sale quantities and the existing
  Europe/Bucharest business-day convention.
- For a tracked finished good, calculate:

  `planned production = max(0, historical demand estimate + target closing stock + explicit buffer - current on-hand stock balance)`

- Show demand, stock, buffer, and production separately. Never call the production
  quantity “sales” or silently treat available stock as production capacity.
- The plan is hypothetical and does not create a sale, stock movement, production
  record, or cost change. Recording actual production and ingredient/recipe
  consumption requires a later, separate workflow.
- Product-pair counts use products present on the same completed transaction.
  Distinguish co-purchase counts from statistical correlation. Use separate units
  per product and never add kg, pieces, and services together.
- If a plan overlays cost/profit, preserve the current tax-basis and cost-coverage
  safeguards. Unknown costs remain unknown and no net-business-profit claim is
  made.

The eight-day-history threshold and any minimum basket count are hypotheses. A
pilot should verify whether the UI gives useful answers with each owner's real
data before thresholds are finalized.

## Minimum useful release

### In scope

- Owner selects a future date and one tracked finished good.
- App shows same-weekday sales history, data coverage, historical baseline, and
  current stock balance with clear loading, no-history, and error states.
- Owner adjusts a target closing quantity and optional explicit buffer; the plan
  recalculates the proposed production amount live.
- Owner adds another product to the plan and sees its own unit/baseline, without
  mixing its quantity with the first product.
- Product relationships show co-purchase pairs when transaction data supports
  them and offer a ranked list for keyboard/screen-reader users.
- The connected canvas works by keyboard and touch; node selection exposes
  controls without requiring drag-only interaction.
- Romanian and English labels, accessible chart summaries, and exact data tables.
- Tenant isolation, owner permissions, and no-write behavior are verified.

### Explicitly later

- Arbitrary user-built workflow graphs, saved reusable templates, and branches.
- Ingredient/recipe requirements, yield, waste learning, labor capacity, supplier
  lead times, and automatic purchase orders.
- Weather, holidays, promotions, or external calendar data.
- Hair-salon appointment demand, staffing, and service capacity.
- Automatic inventory changes or claims of guaranteed demand/profit.

## Evidence, validation, and measures

Current code already records completed sales with product lines and has product
performance and daily trends. The current performance API does not yet expose
comparable-weekday demand, transaction co-purchase pairs, or a production plan.
This feature therefore needs new tenant-scoped query/DTO work in addition to UI
design; the current calculator cannot supply these outputs by itself.

Pilot with sweet-shop/retail owners separately from salons. Ask an owner to plan a
real upcoming day using a prototype. Proposed usability signal: at least four of
five owners can explain the historical basis, identify a related product, and
produce a quantity plan without help in under two minutes. Treat this as a test
target, not customer evidence or a committed success threshold.

Measure plan completion, time to plan, edits to suggested quantities, and next-day
stockouts/leftovers where owners can provide those records. Record a baseline and
consent before claiming improvement. Guardrails include misleading low-history
estimates, overproduction, unit confusion, stock mismatch, and support burden.

## Delivery stages

| Stage | Outcome | Exit evidence |
| --- | --- | --- |
| Current | Shelved; no demand-planning experience is in the app | Revisit only when requested |
| Possible next step | Reconcile history and validate the planning decision with a sweets/retail owner | Correct figures across boundaries and owner can interpret the plan |
| Later | Arbitrary graph authoring, reusable templates, waste/lead time/production records, or salon capacity | Separate evidence for each extension and data-quality requirement |

## Historical implementation evidence

- The former `/app/sales/simulator` planner and `/api/sales/planning` endpoint
  were removed on 2026-10-27. The former profit simulator route was removed too.
- The previous UI showed weekday demand, same-sale product pairs, and hypothetical
  per-product preparation quantities. Those behaviors are not currently available.
- Angular production build, API typecheck, and focused aggregation/utility tests
  passed. The live frontend QA report is [here](../../qa/2026-10-26-demand-planner-frontend-qa.md).
  Browser interaction and customer decision value remain unverified.

Do not implement the Later items simply because they fit the node metaphor.
