# Inventory foundation: coding-agent implementation plan

Status: Implementation in progress, 2026-10-25. Core code and migration are
implemented; final HTTP verification is blocked by the existing Keycloak web
client omitting the access-token subject. See the execution record below.

## Outcome and scope

Give a Romanian shop or salon owner a balance they can trust and explain:
receive stock, record consumption or waste, correct mistakes, and inspect history.
This implements the three previously recommended Now items as one coherent slice:
precise quantities, stock movements/history, and distinct service behavior.

Evidence: current product form rounds stock, PostgreSQL stores integer stock,
PUT overwrites balances without a reason, and service items share stock controls.
See apps/web/src/app/features/products/product-edit.ts and apps/api/src/modules/products/.
Expected customer benefits are hypotheses; customer demand has not been validated.

Exclude low-stock notifications, import/export, categories, barcode scanning,
supplier management, bookings, recipes, expiry/batches, accounting/fiscal documents,
valuation/profit reporting, multi-location stock, and new staff permissions.
Keep tenant-admin mutations and tenant-member reads for this increment.

## Decisions for implementation

### Quantity and money

- Support up to three decimal places for ml/l/g/kg and whole numbers for unit.
- Never silently round excess precision, negative stock, NaN, or infinity.
- Preserve the existing upper stock bound of 1,000,000 units.
- Use PostgreSQL numeric(15,3) for exact quantity storage. Use integer thousandths
  for application arithmetic and validation within the safe integer range; avoid
  floating-point equality checks and implicit JavaScript rounding.
- Existing Product.stock can remain a JSON number for compatibility if quantities
  are validated/canonicalized at the boundary and arithmetic is exact internally.
  Document conversion between the numeric driver strings and API quantities.
- Keep priceCents as integer money. Label price in RON in this Romanian-market
  slice; do not add currency conversion or VAT/compliance claims.

### Tracked goods versus services

- endproduct and consumable are stock-tracked; service is not.
- New services have zero stock, no movement action, no stock/unit entry controls,
  and a localized not-applicable indicator in the stock column.
- Reject nonzero stock submitted for new services.
- Do not silently destroy legacy service quantities. Migration must preserve
  their previous stored value in a clearly labeled legacy/opening snapshot;
  service balances are not presented as operational stock. Document how the
  migration represents and neutralizes that legacy value with an explicit
  migration-origin history record rather than dropping evidence.
- Prevent product type or unit changes that would reinterpret existing quantities
  or movement history. A new item is the recovery path for this initial version;
  reject incompatible changes with a localized explanation.

### History and operations

- One tenant-local stock_movements table: id, product id, kind, signed delta,
  before/after quantities, reason, verified actor subject, timestamp, optional
  reversal reference, idempotency key, and unit snapshot.
- Movement kinds: opening, receive, consume, waste, adjust, reversal; migration
  records identify their system origin without pretending a human created them.
- Preserve existing balances through migration opening entries. Zero opening
  balances may also be recorded for a consistent history baseline.
- Receive adds a positive quantity; consume/waste subtract positive quantities;
  adjust uses an explicitly signed nonzero delta plus mandatory reason.
- A reversal appends the exact opposite of an existing eligible movement and
  references it. Do not edit or delete history. Reject double reversal and
  reversals that would produce negative stock; explain recovery.
- Metadata edits must not overwrite stock. Opening stock is accepted only at
  creation and written atomically with its opening history record. For backward
  compatibility a PUT may accept an unchanged stock value; reject changed stock
  and direct callers to the movement endpoint.
- Product deletion must not remove history: reject deletion of products with
  history using a clear conflict response. Full archive UI is deferred.

### Atomicity, permissions, and retries

- Use the existing verified JWT actor/tenant, role middleware, withTenantDb,
  Drizzle transaction client, shared DTO package, and migration runner.
- Lock the product row for mutation, calculate/check the resulting balance,
  insert movement and update balance in the same transaction. Metadata updates
  and deletion must cooperate with this lock and cannot race history safeguards.
- Every user-submitted movement has a client-generated UUID idempotency key.
  Scope uniqueness to the tenant. An identical replay returns the original
  result; reuse with a different product or payload is a conflict. Handle races
  transactionally without leaving a failed transaction in use.
- Record actor from req.auth, never from a trusted-looking body field. Follow
  repository tenancy conventions; do not create auth bypasses or new DB roles.
- Validate IDs, bounded text, kind, quantity, and page sizes server-side. Return
  stable error codes that UI translations can map, without database details.

## Delivery steps

### 1. Contracts and data migration

Inspect the current dirty worktree first; preserve unrelated user work.
Read AGENT.md, TECH_DEBT.md, PRODUCT.md, DESIGN.md, and applicable Angular skills.
Add a new tenant migration after 0003, never rewrite applied migrations.
Convert stock exactly, create history/indexes/constraints, and backfill balances.
Ensure tenant roles have required DML access through existing grant conventions.
Down migration must refuse lossy rollback when fractional quantities/history exist;
document the supported roll-forward recovery rather than dropping business history.
Add shared movement DTOs, kinds, input types, pagination, and stable errors.

### 2. API and transaction behavior

Extend products repository/service without duplicating provisioning logic.
Suggested endpoints (adapt naming consistently with existing routes):

- GET /api/products/:id/movements?page=1&pageSize=20
- POST /api/products/:id/movements
- POST /api/products/:id/movements/:movementId/reverse

Reads are for tenant members; mutations remain tenant-admin only.
Add guarded service behavior, unit/type-change rules, stock overwrite protection,
history-preserving delete behavior, and exact arithmetic.

### 3. Usable web flow

- List shows localized quantity + unit, product type, RON price, and a stock/history
  action for tracked items. Preserve search/pagination and role visibility.
- Product creation supports precise opening stock; metadata edit displays current
  balance read-only with a route to stock actions. Service creation hides stock
  controls and does not retain a hidden stale quantity when switching type.
- Add a product stock page with current balance, receive/consume/waste/adjust
  controls, reason, history with actor/time/before/after, and reversal action.
- Keep a stable idempotency key across retries of the same submission; a new
  intent gets a new key. Refresh balance/history after success; preserve input
  and give actionable recovery on failure. Disable accidental duplicate submits.
- Match Storeboard green/lime Material styling, mobile menu, keyboard/focus
  behavior, and English/Romanian translations, including errors and empty states.
- Format numbers/dates with the active locale; verify Romanian quantity entry
  behavior. Do not promise comma-decimal support unless it is actually tested.

### 4. Verification

Acceptance matrix:

| Scenario | Required result |
| --- | --- |
| Opening 1.500 kg, consume 0.250 kg | Balance 1.250 kg, two linked-in-order history entries |
| Enter 0.0001 kg or 1.5 pieces | Rejected without rounding or changing balance |
| Consume more than available | Clear rejection; no balance/history change |
| Two simultaneous valid movements | Serialized results; both reflected exactly once |
| Retry same idempotency key/payload | Original movement returned; no second change |
| Reuse key with changed payload | Conflict; original unchanged |
| Reverse movement twice | First succeeds if valid; second rejected |
| Edit product name with stale stock | Stock cannot be silently overwritten |
| Service create/movement | Nonzero creation rejected; movement rejected; UI shows no stock |
| Change unit/type after stock activity | No reinterpretation of balances/history |
| Delete item with history | Conflict; history retained |
| Tenant B requests A product/history | No disclosure or mutation |
| Tenant-user attempts mutation | Forbidden; member history read succeeds |
| Existing/fresh tenant migrations | Balances preserved; history baseline present; no data reset |

Run meaningful API/web unit tests, typecheck, lint, production builds, and existing
product/auth regression suites appropriate to touched code. Add an integration
verification script or extend verify:products to exercise a fresh test tenant,
movement concurrency, idempotency, and isolation against PostgreSQL. Clean up only
test tenants created by that script using the existing provisioning lifecycle.
Inspect desktop and mobile behavior with a bounded UI check. Never use production
or the user's existing workspace to manufacture test movements.

### 5. Local rollout and handoff

Verify migrations on disposable data first. Rebuild local API/migrations/web
images, apply new migrations using the established deployment flow, recreate
containers, and restart nginx after upstream recreation. Do not reset databases,
delete existing workspaces, or change Keycloak realm data. Use escalation tools
when Docker access requires them. If migration preflight finds incompatible data,
report the concrete rows/counts without exposing secrets and preserve the data.
Update the phase log and ticket documentation accurately; do not call incomplete
verification passed. Report changed files, checks, migration behavior, remaining
limitations, and how to try the new flow.

## Product validation after delivery

Proposed pilot: three shops and three salons for two weeks, assessed separately.
Measure time to record a movement, physical-versus-recorded discrepancy, repeated
weekly usage, support effort, and owner willingness to continue/pay. Collect a
baseline before setting improvement claims. This is a proposed research activity,
not authorization to recruit or message customers. Low-stock/import work enters
Next after stock accuracy and routine use are demonstrated.

## Execution record (2026-10-25)

- Added exact quantity parsing, numeric storage, immutable movement API/history,
  serialized updates, retry keys, reversals, service separation, and localized UI.
- Disposable legacy migration verification passed: preserved stock, explicit
  service snapshots, rerun idempotency, and refusal of lossy rollback.
- PostgreSQL repository verification passed under the DML-only API connection:
  exact subtraction, concurrent changes, repeated keys, reversals, forbidden
  overwrites/deletion, service rejection, and tenant isolation.
- API tests: 52 passed; web tests: 38 passed. API/tools typecheck and scoped lint
  passed. Production images built; migration deployed locally without a reset.
- HTTP verification created and removed only fresh disposable test tenants. It
  reached fractional product creation but movement failed because req.auth.sub
  was absent from an otherwise signed Keycloak access token. This is NOT a passed
  end-to-end test. The current web client explicitly selects profile/email/roles
  and omits basic; Keycloak 25+ supplies sub via basic's Subject mapper.
- Prepared a fail-closed subject check, realm-export basic scope addition, and
  `tools/scripts/configure-web-subject.ts`. The latter attaches the existing basic
  scope to the existing retail-web client without changing users or sessions.
  This runtime repair has NOT been executed because the plan prohibits changes
  to Keycloak realm data. Obtain approval for that bounded prerequisite, then
  run the helper, rebuild/recreate API/web, refresh the user's login, and rerun
  verify:inventory, verify:products, and auth verification.
- Full interactive desktop/mobile stock submission verification remains pending
  the subject repair. The coding subagent could not access the parent browser tab.

Quantity boundary: API JSON retains numeric quantities; values are converted by
decimal-digit parsing to safe integer thousandths. Database numeric driver strings
are read as bounded quantities; all arithmetic uses thousandths. New services
have no opening movement; legacy services retain an opening snapshot and an
explicit system adjustment to zero. Reversal entries and system/opening entries
are not themselves reversible. Stock-tracked products have an opening history
entry even at zero, so their unit/type becomes fixed and deletion is blocked.
