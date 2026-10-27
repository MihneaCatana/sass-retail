# Profit simulator UX design handoff

Status: shelved on 2026-10-27; the simulator page was removed at the user's
request. This handoff is retained as historical context only.

Status: implementation-ready proposal for Stage 5. This is a frontend design
handoff; it does not change the simulator's financial or accounting claims.

## User and task

The workspace administrator wants to answer a quick question such as “If I sell
one more cake/service at this price, what is left after its unit cost?” They may
then explore a larger quantity or fixed-cost scenario. The first answer should
not require understanding break-even charts or confirming a long list of
assumptions.

## Page composition

Keep the existing Storeboard working surface, page title, forest-green actions,
light neutral surfaces, thin dividers, typography, and spacing tokens. Remove the
large generic model disclaimer from the top of the page; move the concise
hypothetical-data note beside the result, with the full model caveat in Advanced.

1. **Page header**: “Profit simulator” and one sentence that it estimates a
   product/service scenario and does not change business records.
2. **Item selector**: existing searchable product picker. Once selected, show
   the item name and localized unit. Keep the selected item easy to change.
3. **Quick estimate form**: three inputs in this order: planned quantity (default
   `1`), selling price per unit, variable cost per unit. Price is prefilled from
   the catalog. Prefill the latest effective standard cost when available, with
   source and effective date visible beside it. If no usable cost exists, leave
   it empty; never substitute zero. Each amount is RON and each quantity carries
   the selected item's unit.
4. **Quick result**: update while the user edits. Show estimated revenue,
   difference per unit, and total difference for the planned quantity. Use
   signed/tabular amounts and a text label so color is supplemental. Make this
   the visual focal point without adding nested cards for every value.
5. **Advanced scenario**: a collapsed disclosure labelled “Explore more
   scenarios” (or Romanian equivalent). Inside: scenario fixed cost, quantity
   range, the current chart with break-even, and exact-value table. Keep inputs
   and current quick values intact when opening or closing the disclosure.

No save action is needed. Calculations remain hypothetical and must not write to
catalog prices, costs, stock, sales, or performance reports.

## Behavior and calculation labels

- Quick formula: revenue = quantity × entered selling price; difference per unit
  = entered selling price − entered variable cost; total difference = quantity ×
  per-unit difference. Keep integer-cent arithmetic and the existing quantity
  precision rules. This is an arithmetic comparison of the entered values.
- Do not call the quick result “gross profit”, “profit margin”, or “net profit”.
  Product catalog prices currently have no reliable stored tax basis. A
  tax-exclusive cost therefore cannot be assumed comparable to the catalog
  price. If basis is missing or differs, show “Difference based on entered
  amounts” and an adjacent explanation that tax bases may differ. When the user
  explicitly confirms that price and cost use a consistent basis, advanced
  scenario output may retain “estimated scenario profit”; do not claim actual
  realized profit.
- Cost provenance is not a manual prefill task. Automatically put an eligible
  latest effective cost into the variable-cost field. Show source and effective
  date as helper metadata. If cost loading fails, preserve the selected item and
  price, show retry, and leave cost empty. If there is no effective cost, explain
  that the field needs an explicit assumption.
- Quick result is useful before cost entry: show estimated revenue and an
  “Add a cost to compare” prompt in place of difference figures. Do not make the
  page appear broken or show an invalid-scenario alert while a user is still
  starting.
- In Advanced, fixed cost defaults to zero only as an explicit scenario input
  with a label that makes its one-time scenario scope clear. The quantity range
  is distinct from available stock, production capacity, or actual sales.
- If unit contribution is zero or negative, show the existing no-finite-
  break-even message. Explain the result is a simplified estimate; capacity,
  waste, labor, and tax conversion are outside this model.

## States

- **No item selected**: picker and a short instruction; no empty result panel.
- **Cost loading**: localized status near the cost field; don't block item or
  price edits.
- **Cost fetch error**: inline alert with retry, retaining user-entered values.
- **No usable cost**: blank input plus a concise helper explanation.
- **Invalid field**: field-adjacent localized validation (required/positive
  quantity; nonnegative RON amounts; supported decimal precision). Keep other
  valid results visible where possible, and don't replace inputs with a global
  error alert.
- **Ready quick estimate**: live results and concise hypothetical label.
- **Advanced collapsed/open**: semantic disclosure with `aria-expanded` and
  `aria-controls`; preserve state and values across toggles.
- **Read-only role**: preserve existing admin-only notice and don't fetch costs.
- **No result mutation**: state near results explicitly says this is a scenario,
  not a recorded sale or forecast guarantee.

## Responsive and accessibility

- Desktop: quick form uses a compact three-column row when space permits; result
  summary follows immediately. Advanced chart/table stay below, inside the same
  working surface.
- Phone (390px): stack fields and result values in reading order; ensure labels,
  units, source/date metadata, and long Romanian text wrap. No page-level
  horizontal scroll. If the detailed table needs it, scroll only its region.
- Use Material outlined fields and supported button/disclosure controls, semantic
  headings, explicit labels and units. Keep focus visible and touch targets at
  least 44px. Keyboard can select an item, edit every input, and toggle Advanced
  without a pointer.
- Announce refreshed quick results politely (`aria-live="polite"`/status) without
  announcing on every keystroke if it becomes noisy. Errors use `role="alert"`.
  The chart remains a static accessible image with a descriptive localized name;
  preserve the exact-value table as its accessible data alternative.
- Test EN and RO, especially “cantitate vândută planificată”, RON values and
  `piece/kg/l` units, at 390px and desktop. Respect reduced motion; no animation
  is required.

## Translation keys to add or adapt

Use `core/i18n/sales-translations.ts` with matching EN/RO entries. Suggested
keys (names can match the implementation's established convention):

| Key | English | Romanian |
| --- | --- | --- |
| `sales.quickEstimate` | Quick estimate | Estimare rapidă |
| `sales.plannedQuantity` | Planned quantity | Cantitate planificată |
| `sales.sellingPricePerUnit` | Selling price per unit (RON) | Preț de vânzare pe unitate (RON) |
| `sales.costPerUnit` | Variable cost per unit (RON) | Cost variabil pe unitate (RON) |
| `sales.estimatedRevenue` | Estimated revenue | Venit estimat |
| `sales.differencePerUnit` | Difference per unit | Diferență pe unitate |
| `sales.totalDifference` | Total difference | Diferență totală |
| `sales.differenceBasedOnEnteredAmounts` | Difference based on entered amounts | Diferență pe baza valorilor introduse |
| `sales.taxBasisMayDiffer` | Price and cost may use different tax bases; this is an arithmetic estimate. | Prețul și costul pot avea baze fiscale diferite; aceasta este o estimare aritmetică. |
| `sales.addCostToCompare` | Add a cost to compare | Adaugă un cost pentru comparație |
| `sales.costSourceDate` | Latest standard cost · {source} · effective {date} | Cel mai recent cost standard · {source} · în vigoare de la {date} |
| `sales.exploreScenarios` | Explore more scenarios | Explorează mai multe scenarii |
| `sales.scenarioRange` | Quantity range | Interval de cantitate |
| `sales.scenarioOnly` | Hypothetical scenario; no sales, costs, or stock are changed. | Scenariu ipotetic; vânzările, costurile și stocul nu se modifică. |

Reuse existing chart, break-even, table, access, retry, and unit translations where
they remain accurate. Long key labels above are suggestions; coding may choose
shorter key names but must keep both locales complete.

## Design acceptance checks

1. A user can get a first estimate after selecting an item and reading the
   prefilled quantity, price, and available cost without opening Advanced or
   checking a confirmation box.
2. Missing cost never displays or calculates as zero; revenue can still display.
3. Result language does not imply compatible tax basis, accounting profit,
   margin, or forecast certainty.
4. Opening/closing Advanced does not reset any quick or advanced inputs.
5. Advanced chart/table retain clear units, break-even edge-case handling, and a
   table alternative.
6. All visible and assistive text is localized; keyboard/mobile use remains
   practical and no business data is changed.
