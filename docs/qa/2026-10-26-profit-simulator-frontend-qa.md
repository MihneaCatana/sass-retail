# Profit simulator frontend QA - 2026-10-26

## Run context

- Date: 2026-10-26
- Environment: local app at `http://localhost:8082`
- Route: `/app/sales/simulator`
- Browser evidence: in-app browser, rendered UI and accessibility tree
- Visible viewport: 1270 x 720 (desktop); a 390px viewport could not be set through the available browser controls
- Language/role: English and Romanian tested; signed-in workspace administrator
- Data: read-only seeded catalog items. No products, costs, sales, or stock records were created or changed.
- Build: parent reported a successful web rebuild/recreate before this run. Updated bundle was visible after reload.

## Granular case matrix

| ID | Area | Steps / expected | Observed | Status |
| --- | --- | --- | --- | --- |
| SIM-01 | Sign-in and route | Sign in to local workspace, open simulator route | Callback settled into the app and simulator route; no persistent signing state in this run | Pass |
| SIM-02 | Initial state | Open simulator before choosing an item | Product picker and instruction visible; no result/error panel until selection | Pass |
| SIM-03 | Default assumptions | Select Baclava | Quantity 1, catalog price 5.00 RON, latest standard cost 3.00 RON populated; source, date, and tax-exclusive basis shown | Pass |
| SIM-04 | Quick result | With 1 x 5.00 price / 3.00 cost, observe estimate | Revenue 5.00 RON; per-unit difference +2.00 RON; total difference +2.00 RON | Pass |
| SIM-05 | Live calculation | Change quantity to 3 | Revenue updated to 15.00 RON and total difference to +6.00 RON without submit | Pass |
| SIM-06 | Missing cost | Select measured QA item with no cost | Cost field stayed blank; revenue remained visible (12.50 RON at quantity 1); comparison asked for a cost rather than treating it as zero | Pass |
| SIM-07 | Measured units | Set that item's quantity to 0.25 | Quantity accepted and revenue recalculated to 3.13 RON | Pass |
| SIM-08 | Invalid quantity | Enter quantity 0 | Result disappeared; field showed localized positive-quantity guidance | Pass |
| SIM-09 | Whole-piece precision | Enter 1.5 for a piece item | Result disappeared; field showed allowed-precision guidance | Pass |
| SIM-10 | Invalid selling price | Enter 5.001 RON | Result disappeared and selling-price helper changed to the 2-decimal validation message | Pass |
| SIM-11 | Invalid variable cost | Enter -1 and then 3.001 RON | Comparison fell back to "Add a cost to compare", but the field helper continued showing the latest cost provenance; no visible amount-validation text appeared | Fail (P2) |
| SIM-12 | Advanced disclosure | Toggle Advanced by keyboard Space | Expanded/collapsed state changed; hidden controls left the accessibility tree when collapsed | Pass |
| SIM-13 | State retention | Set fixed cost 10 RON and range 20, collapse and reopen | Both values and basis checkbox state remained intact | Pass |
| SIM-14 | Advanced confirmation | Change assumptions, then confirm consistent tax basis | Chart/table only appeared after confirmation; editing fixed cost reset confirmation | Pass |
| SIM-15 | Break-even and table | Price 5, cost 3, fixed 10, range 20 | Break-even showed 5 pieces; at 20, table showed revenue 100.00, cost 70.00, estimated scenario profit 30.00 RON | Pass |
| SIM-16 | Break-even edge case | Set unit cost equal to price, confirm basis | Explicit no-finite-break-even message appeared for nonpositive contribution | Pass |
| SIM-17 | Tax-basis wording | Use tax-exclusive standard cost with catalog price | Quick result says difference based on entered amounts and warns tax bases may differ; does not claim gross/net profit or margin | Pass |
| SIM-18 | Localization | Switch EN to RO, inspect controls/results, reload route | Romanian strings and decimal comma displayed; locale persisted after reload | Pass |
| SIM-19 | Service item | Select seeded service-named catalog item | Estimate flow rendered. Unit was shown as "piece" because the selected item uses the piece unit type | Pass with note |
| SIM-20 | No mutation | Exercise picker and local estimate fields only; reload | No save/complete action was offered or used; page reloaded to an unselected simulator | Pass (UI-only evidence; no database/API inspection) |
| SIM-21 | Responsive 390px | Attempt mobile viewport | Browser control available to this run did not expose viewport emulation; phone-width layout and horizontal overflow remain unverified | Not tested |
| SIM-22 | Console errors | Inspect browser console | Console log API was unavailable in this browser surface | Not tested |

## End-to-end journey

1. Opened `/app/sales/simulator` and selected the seeded Baclava item.
2. Verified default quantity 1, catalog price 5.00 RON, and latest cost 3.00 RON with its date/source/tax basis.
3. Changed quantity to 3; the quick result updated to 15.00 RON revenue and +6.00 RON total difference.
4. Opened Advanced with keyboard, set a one-time fixed cost of 10 RON and quantity range 20, then confirmed the consistent-basis assumption.
5. Verified break-even at 5 pieces and the 20-piece table row (100.00 RON revenue, 70.00 RON scenario cost, 30.00 RON estimated scenario profit).
6. Changed unit cost to equal selling price and confirmed that the no-finite-break-even state appeared.
7. Switched to Romanian and refreshed the route; Romanian remained selected and no item was selected after reload.

## Findings and limits

- **P2 - Variable-cost validation is not explained inline.** For negative or over-precision values, the quick comparison is suppressed, but the helper still displays standard-cost provenance. The user cannot tell that the entered amount is invalid. Repro: select Baclava, enter `-1` or `3.001` in Variable cost per unit. The input appears marked invalid in the UI state, but there is no corresponding visible validation text. Recommend replacing helper copy with the localized amount error while invalid, then restoring provenance when valid.
- The detailed table exposed a horizontal scrollbar at the 1270px desktop viewport; the final column was clipped until horizontally scrolled. This is region-level scrolling and the table remains available, but desktop fit should be reviewed when the UI is adjusted.
- Mobile viewport/390px, browser console, data-store non-mutation, non-admin role, fetch error/retry, and a product with no usable effective cost could not be verified in this browser-only run.
- No screenshot file was saved; screenshot capture was available only for on-screen inspection.

## Retest after validation fix

The simulator was rebuilt and the authenticated in-app browser tab was refreshed
to load the new bundle. A follow-up rendered-UI check confirmed:

- With Baclava selected, entering `-1` and `3.001` in Variable cost per unit
  displayed the localized nonnegative/two-decimal validation helper instead of
  cost provenance. Correcting the cost to `3.00` restored the provenance and the
  `+2.00 RON` quick comparison.
- Changing planned quantity to `3` updated revenue to `15.00 RON` and total
  difference to `+6.00 RON`.
- The quick-to-advanced flow remained available: fixed cost `10 RON`, range `20`,
  and the explicit basis confirmation displayed break-even at `5` pieces and the
  final table row of `100.00 RON` revenue, `70.00 RON` scenario cost, and
  `30.00 RON` estimated scenario profit.

This retest was performed in the primary thread's authenticated in-app browser
after the assigned tester's isolated browser surface became unavailable. No
business data was changed. The 390px viewport, browser console, and desktop table
fit remain unverified/open as described above.
