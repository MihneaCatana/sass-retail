# Sales implementation

Implement docs/features/sales/PRODUCT.md in the local app, 2026-10-25.
Preserve the existing dirty worktree and all user data.

## Delivery boundary

Deliver usable sales drafts/completion, inventory integration, cancellation and
partial returns, effective-dated standard cost versions, product performance with
cost coverage and explicitly estimated profit, and an interactive simulator.
Do not invent FIFO/weighted-average actual costing: actual realized profit remains
gated by the product specification. No payment/fiscal processing or VAT rules.
Sales store an explicit price basis (unspecified, tax_inclusive, tax_exclusive).
Only compatible tax_exclusive cost/sales snapshots qualify for estimated gross
profit; missing/incompatible costs stay unknown. Admin-only costs/analytics and
mutations, tenant-member sales reads. Store money as bani, quantity as integer
thousandths for calculations and numeric(15,3) in persistence.

## Implementation ownership and sequence

1. Root writes shared contracts in packages/shared-types/src/sales.ts, exporting
   them from index.ts. Implementers may propose contract changes to root.
2. Backend agent owns API sales module, migrations >=0005, inventory link/reversal
   safeguards, integration tools, API tests. No frontend edits.
3. Frontend agent owns sales/cost/analytics/simulator views, routes/nav/i18n and
   frontend tests. Read shared contracts; no API/migration edits.
4. Root integrates and deploys via existing Docker/migration flow without resets.
5. Independent designer agent validates against DESIGN.md and product journeys;
   findings are corrected. QA agent exercises frontend with authorized account,
   QA-prefixed products/sales, no existing-business mutations. Record results.

## Core correctness

- Deterministic product-row locking and one tenant transaction for completion or
  return plus all stock movements. Reject insufficient stock without partial writes.
- Revision checking for drafts; completed lines retain snapshots. Completion and
  return keys are tenant-scoped idempotent with payload-conflict detection.
- No generic reversal of sale-owned stock movements. Link movements to sales and
  preserve product references. Returns use original line values and cumulative
  bani allocation; restockability explicit, service stock unchanged.
- Effective-dated standard costs are versioned; cost snapshots are chosen at
  completion. Later edits do not rewrite historical profit.
- Event-date reporting for returns, Europe/Bucharest date filters, deterministic
  paging, localized UI errors, read-only permissions, keyboard/mobile behavior.
- Simulator is client-only hypothetical state: clear assumptions, no mutations,
  positive-contribution break-even rounded to valid quantity increments, table
  alternative to graph and no false profitability for missing costs.

## Validation

Unit tests for quantity/money/partial return rounding, validation, revision and
permissions; integration checks against disposable tenants for completion,
insufficient stock, concurrent/retried writes, partial/full return, immutability,
cost snapshots/coverage and tenant isolation. Production API/web builds and
typechecks. Browser tests for draft save/reload, completion/balance/history,
return, costs, reporting, simulator, language and mobile. Document any untested
cases and any customer-validation gate that code tests cannot establish.

## Delivery evidence (2026-10-25)

- Tenant migration 0005 applied through the existing migration runner; local
  API/web images rebuilt and healthy at localhost:8082. No database reset.
- API: 62 unit tests pass. Web: 47 unit tests pass and production build passes.
- `tools/scripts/verify-sales.ts`: 40 integration assertions pass against the
  deployed API using disposable workspaces, including concurrency/retry,
  overselling rollback, original-value fractional returns, immutable snapshots,
  role/tenant boundaries and product-specific sales drilldown.
- `tools/scripts/verify-sales-math.ts`: shared exact-money checks pass.
- Independent [designer source review](../features/sales/DESIGN-VALIDATION.md)
  completed and findings were corrected. Rendered approval remains pending.
- [Frontend QA](../qa/2026-10-25-sales-frontend-qa.md): all 12 planned browser
  cases blocked. IAB unavailable; native Computer Use stopped because it could
  not verify the browser URL. No UI test records or screenshots were created.
  Reopen a connected browser and rerun these journeys before marking the ticket done.
- Known delivery boundary: standard costs support estimated gross profit only.
  Actual valuation, pilot demand, fiscal processing and production-readiness
  gates are not established by these tests.
- Scale follow-up: performance aggregation currently reads tenant historical
  sales/corrections in memory. Move aggregation into bounded database queries
  before high-volume rollout; no load-test capacity is claimed here.
- Build passes with budget warnings: initial bundle about 583 kB (500 kB warning
  budget), shared sales CSS about 4.82 kB (4 kB warning budget), and existing
  sign-in CSS about 4.61 kB. No failing build budget was suppressed.
