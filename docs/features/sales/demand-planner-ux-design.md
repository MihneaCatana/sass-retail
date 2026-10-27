# Demand planner UX design handoff

Status: shelved on 2026-10-27; the planner page and API were removed at the
user's request. This handoff is retained as historical context only.

Status: implementation-ready UX direction based on the proposal in
`visual-demand-planning-proposal.md`. Demand thresholds and customer value are
hypotheses until validated with Romanian shop owners.

## Design intent

Replace the standalone profit calculator as the main experience with a visual
planning flow that answers:

1. What did this product sell on comparable days?
2. Which other products appeared on those same sales?
3. Given a selected future date and current stock, how many units should I plan
   to prepare?

The reference is the clarity of a connected n8n flow: visible steps, inputs,
relationships, and outputs. Do not reproduce an unconstrained automation canvas.
The first release is a guided, fixed sequence. Every node has a known purpose and
an observable result; the graph is decoration only if its inputs can actually be
changed and its outputs respond.

Keep the Storeboard forest navigation, lime active state, white work surface,
thin dividers, Angular Material controls, locale-aware RON and quantity display,
and Romanian/English parity from `apps/web/DESIGN.md`.

## Page layout

### Header and planning controls

- H1: **Plan the day** / **Planifică ziua**.
- Supporting copy: “Compare sales on similar days and build a plan for a future
  date. Stock and sales are not changed.” / “Compară vânzările din zile similare
  și pregătește un plan pentru o zi viitoare. Stocul și vânzările nu se modifică.”
- Put selected future date and history window in one compact toolbar above the
  graph. Default to the next calendar day in `Europe/Bucharest`; never silently
  assume today's date is a planning date.
- History window options can be 8, 12, or 26 weeks, with the data count displayed.
  A window choice must not imply a seasonality result when data is sparse.

### Guided node flow (desktop)

Use one connected row on a wide content area, with four working nodes:

`Completed sales -> Similar weekdays -> Bought together -> Quantity plan`

Each node shows a short title, the state/result needed for the next step, and one
clear action. Connectors are thin neutral lines with a directional cue; selected
nodes use a visible green outline and text, not color alone. Keep node content
compact, with no nested cards or overflowing labels. A node's action opens its
details in a shared inspector region below the flow; do not attach floating labels
or popovers that cover neighboring nodes.

When the available content width is below 58rem, wrap nodes into a two-column
sequence. At or below 40rem, render the same nodes as a vertical numbered-free
step list with connectors between them. The graph should never force page-level
horizontal scrolling. Use container queries so the app's 15rem desktop sidebar is
accounted for; the viewport width alone does not describe available page width.

### Node contents and interactions

#### Completed sales

- Shows selected history range, count of included completed sales, and date
  boundaries.
- Clarifies that drafts are excluded. Exclude cancelled/returned amounts according
  to a documented event-date rule; provide a short help link/inline description.
- Action: **Change period** / **Schimbă perioada**.
- Loading, API error, retry, and no completed sales states stay inside the node.

#### Similar weekdays

- Shows the comparison weekday for the selected future date and the number of
  comparable historical dates available.
- The default metric is the median quantity sold on that weekday for the selected
  product, shown as **Historical baseline** / **Bază istorică**. Never call this a
  guaranteed forecast or “what you will sell.”
- Clicking this node reveals two linked views: a weekday-by-week heatmap and a
  daily quantity trend. Selecting a heatmap cell filters the trend to that
  weekday; selecting a product updates both views.
- Each view has a short text summary and exact table alternative with date,
  quantity, and unit. Do not combine unlike units.
- Proposed data rule: require at least eight comparable weekdays to calculate a
  baseline. Below that threshold, show the observed count and dates plus the
  message **Not enough history for a baseline yet** / **Nu există încă suficient
  istoric pentru o bază de comparație**. Never substitute zero.

#### Bought together

- Shows observed product pairs from completed sale transactions. A line means the
  products appeared on the same sale; line weight is the count of those sales.
- Use the label **Often bought together** / **Cumpărate frecvent împreună**.
  Avoid statistical “correlation,” causation, or recommendation language.
- The main view is a modest product relationship graph, with no more than 8
  selected products visible at once. Selecting a product highlights its observed
  pairs. Clicking an edge reveals its transaction count and the share of eligible
  sales containing both products, with denominator and period shown.
- Provide a ranked pair table as an accessible alternative. Each product row
  includes name and its own unit. A visible **Add to plan** / **Adaugă în plan**
  action adds the other product to the quantity plan; it never merges quantities
  across pieces, kilograms, litres, or services.
- No pairs/insufficient data state explains that the view is based on products
  recorded on the same completed sale. Do not invent a related product.

#### Quantity plan

- Shows the selected date and one row per product with separate unit context.
- For tracked finished goods, show four distinct quantities:
  **Historical baseline**, **Current stock**, **Target at close**, and
  **Suggested to prepare**.
- Calculation:

  `suggested to prepare = max(0, historical baseline + target at close + explicit buffer - current stock)`

- User can edit target-at-close and an optional buffer per item. Changes update the
  visual comparison immediately. Keep the raw historical baseline visible so the
  user can judge the adjustment.
- Use a compact horizontal bar or stacked comparison showing current stock,
  baseline demand, target closing stock, and additional preparation quantity.
  Provide an exact localized table alongside it. The graph must not hide the
  formula, assumption, date range, or unit.
- Copy says **Suggested to prepare** / **Cantitate recomandată pentru pregătire**,
  not “must produce.” Results are planning suggestions and not actual records.
- Primary action is **Review plan** / **Revizuiește planul**. It opens an in-page
  summary for reading or printing; it does not create inventory movements, sales,
  production records, purchases, or costs.

### Relationship and combination behavior

- Co-purchase insights are based on line items inside the same completed sale ID,
  never on two items selling on the same date alone.
- The user combines products by adding related items to the plan; the planner then
  computes each product separately using its own unit and historical baseline.
- Selecting a product in any node updates the selected-product details and the
  relationship graph, but does not silently add it to the plan. Use the explicit
  Add to plan action.
- If the workspace has fewer transactions than the proposed threshold, suppress
  the graph and show the eligible transaction count. Treat all thresholds as
  research hypotheses and tune them with pilot data.

## Interaction states

| State | Expected behavior |
| --- | --- |
| No product | Show graph structure and a single select-product prompt; no quantity result. |
| Loading | Keep node titles and previous filters visible; show a local status without shifting adjacent nodes. |
| Insufficient comparable days | Keep actual history available; suppress the baseline and the derived prepare suggestion. |
| No co-purchase pairs | Show explanatory empty state and a ranked-table header with no fake edge. |
| API error | Inline alert in the affected node, retry action, preserve selected date/products. |
| Invalid target/buffer | Field-level localized error; other products and actual-history views remain visible. |
| Ready plan | Show date, period, number of comparisons, baseline, stock, and formula context next to the output. |
| Read-only role | No plan mutation action; keep history view available only if role policy allows it. |
| Plan review | Read-only summary with no save/record effect; clear statement that the plan is hypothetical. |

Historical data, co-purchase counts, and plan changes must remain tenant-scoped.
The first release can stay owner-only because the existing performance view is
admin-only. Role expansion is a separate product decision.

## Accessibility and responsive behavior

- Make each node a semantic section with a heading and a real button for selection.
  Expose selected state with `aria-current`/`aria-pressed` as appropriate.
- Connectors are decorative and hidden from assistive technology; reading order
  follows the actual analysis sequence.
- Every chart has a concise localized accessible name and a nearby exact data
  table. Node selection and adding products must work by keyboard and touch, not
  drag alone.
- Avoid overlay tooltips for essential values. Use inline help or a disclosure
  that stays in document flow.
- Focus moves to the inspector heading when a node action opens its detail panel;
  closing/returning restores focus to that node action.
- At 390px, nodes become a vertical list; fields and chart summaries stack; only
  the chart's data region may scroll horizontally. Long Romanian copy wraps and
  no field label overlaps another control.
- Verify at desktop 1440px and the actual app content width beside the sidebar,
  390px phone width, keyboard-only operation, 200% zoom, and EN/RO text.

## Copy / i18n key suggestions

All content belongs in `core/i18n/translations.ts` (or the sales dictionary
module), with complete EN and RO pairs:

| Key | English | Romanian |
| --- | --- | --- |
| `sales.planDay` | Plan the day | Planifică ziua |
| `sales.planningDate` | Planning date | Data planificării |
| `sales.historyWindow` | History window | Interval istoric |
| `sales.salesHistoryNode` | Completed sales | Vânzări încheiate |
| `sales.similarDaysNode` | Similar weekdays | Zile similare |
| `sales.boughtTogetherNode` | Bought together | Cumpărate împreună |
| `sales.quantityPlanNode` | Quantity plan | Plan cantități |
| `sales.historicalBaseline` | Historical baseline | Bază istorică |
| `sales.comparableDays` | Comparable days | Zile comparabile |
| `sales.notEnoughHistory` | Not enough history for a baseline yet | Nu există încă suficient istoric pentru o bază de comparație |
| `sales.oftenBoughtTogether` | Often bought together | Cumpărate frecvent împreună |
| `sales.addToPlan` | Add to plan | Adaugă în plan |
| `sales.currentStock` | Current stock | Stoc curent |
| `sales.targetAtClose` | Target at close | Stoc dorit la închidere |
| `sales.buffer` | Extra buffer | Rezervă suplimentară |
| `sales.suggestedToPrepare` | Suggested to prepare | Cantitate recomandată pentru pregătire |
| `sales.planIsHypothetical` | Planning suggestion only. It does not change sales or stock. | Sugestie de planificare. Nu modifică vânzările sau stocul. |

## Design acceptance checks

1. At first view, an owner can tell which date is planned, which history feeds the
   result, and the next analysis step.
2. Selecting a product updates its weekday history and co-purchase relationships.
3. Adding a related product creates a separate quantity row with its own unit.
4. A prepare suggestion appears only with sufficient history and a tracked stock
   balance; missing inputs never become zero silently.
5. The amount can be reconciled to baseline + closing target + buffer - current
   stock, clamped at zero and shown per product.
6. The graph never claims causation, reliable forecast accuracy, actual production,
   or an inventory change.
7. No overlapping labels/helpers, keyboard-only interaction, and complete EN/RO
   labels at desktop, sidebar-constrained, and phone widths.
8. A no-history tenant and a tenant with sparse/co-purchase data receive truthful
   empty states rather than placeholder values.
