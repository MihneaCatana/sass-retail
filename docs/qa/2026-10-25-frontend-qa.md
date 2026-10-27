# Storeboard frontend QA: 2026-10-25

## Environment and scope

- Target: http://localhost:8082/; live local Docker-served frontend.
- Browser: in-app browser, default desktop viewport and explicit 390 x 844 phone
  viewport. Temporary viewport override reset at end.
- Login: supplied test credentials entered into the expected localhost Keycloak
  form after exercising sign-out. Password and callback secrets are omitted.
- Visible workspace: Lenovo (tenant label lenovo). New/Edit/stock mutation controls
  were present. Separate staff/admin/second-tenant accounts were not provided.
- Languages: started Romanian, tested English and Romanian, finished Romanian.
- Method: normal rendered UI actions and read-only DOM/layout observations. No API
  requests substituted for browser tests; no configuration or code fixes performed.

## Result

30 cases: **18 passed, 4 failed, 3 blocked, 5 not tested**.

Inventory movement submission is not release-verified: the valid consumption test
failed, so a successful movement and reversal sequence could not be established.

## Case matrix

| ID | Case / expected result | Observed result | Status |
| --- | --- | --- | --- |
| 01 | Supplied credential login reaches app | Keycloak form accepted credentials; Lenovo home loaded | Pass |
| 02 | Sign out returns to public login | Public login rendered; following sign-in required credentials | Pass |
| 03 | Deep-link refresh restores session/data | QA stock route reloaded with balance/history and RO locale | Pass |
| 04 | Product navigation and back link work | Home-to-products and stock/form back links reached catalog | Pass |
| 05 | EN/RO switches labels and number/date formats | Catalog/stock translated; 1.5 became 1,5; date format changed; names/SKUs unchanged | Pass |
| 06 | Existing error follows active language | English quantity error remained English after switching to RO | Fail |
| 07 | Create measured stock without rounding | New QA product displayed 1.5 kg and 12.50 RON column value | Pass |
| 08 | New opening stock identifies actual origin | Newly created product opening entry says Recorded by: System migration | Fail |
| 09 | Metadata edit preserves quantity | Renamed only QA measured item; catalog retained 1,5 kg | Pass |
| 10 | Edit balance shows locale-aware number and unit | Romanian edit page showed Stoc curent: 1.5 with no kg | Fail |
| 11 | Service creation hides stock/unit controls | Switching from stock 1.5 to service removed controls; creation succeeded | Pass |
| 12 | Service has no operational stock form | Catalog/stock page showed not-tracked label, empty history, no movement form | Pass |
| 13 | Exact name search finds QA product | Search returned exactly the measured QA item | Pass |
| 14 | No-match search differs from empty catalog | Absent name showed localized no-matches message | Pass |
| 15 | Required empty form cannot submit | New product and empty movement forms had disabled submits | Pass |
| 16 | Overprecision is rejected locally | 0.0001 kg produced quantity error, balance unchanged | Pass |
| 17 | Negative consumption is rejected locally | -0.25 kg produced quantity error, balance unchanged | Pass |
| 18 | Phone hamburger contains all requested controls | Sections, EN/RO, and sign out appeared with expanded state | Pass |
| 19 | Escape closes menu and restores focus | Menu collapsed; focus returned to hamburger | Pass |
| 20 | Selecting section closes menu | Products navigation reached catalog and menu was collapsed | Pass |
| 21 | Mobile catalog avoids page overflow | At 390 x 844, document/body width was 380; table remained in its region | Pass |
| 22 | Consume 0.250 from 1.500 kg gives 1.250 | Generic save failure; balance remained 1.5; only opening history entry after refresh | Fail |
| 23 | Receive/waste/adjust writes persist | Shared movement submit path already failed; not repeatedly submitted | Blocked |
| 24 | Reversal appends opposite entry | No successful eligible movement to reverse | Blocked |
| 25 | Insufficient stock gets domain-specific recovery | Cannot establish domain outcome while ordinary valid submission fails | Blocked |
| 26 | Staff and cross-tenant permission boundaries | Only one authorized account supplied | Not tested |
| 27 | Concurrent writes and idempotency | Browser pending-state behavior cannot prove DB invariants; no direct API tests run | Not tested |
| 28 | Delete/history protection | No destructive cleanup authorized or attempted | Not tested |
| 29 | Duplicate SKU and fractional-piece rejection | Bounded run focused on measured-stock failure; not submitted | Not tested |
| 30 | Multi-page catalog/history navigation | Only four catalog records and one QA history entry; bounds disabled | Not tested |

Required-field pass establishes only frontend disabled behavior, not server
validation. Empty-catalog behavior was not tested because this workspace has data.

## Findings

### F1 / P1: Valid stock consumption cannot be saved

Preconditions: credential login; new measured QA product with opening stock 1.5 kg.

1. Open the product's Stock & history page.
2. Select Record consumption.
3. Enter quantity 0.250 and reason QA consumption verification.
4. Select Record movement.
5. Refresh through the page's Refresh action.

Expected: balance 1.250 kg, a consumption entry with before/after quantities, and
saved feedback. Actual: "Could not save. Check the details and try again." Input
remained available; balance stayed 1.5 kg and history stayed at one opening entry.
Observed once with a valid write and confirmed unchanged state through refresh.
The UI does not disclose a useful reason or recovery beyond retry.

This report does not diagnose the backend cause. Existing repository execution
notes describe a subject-scope blocker, but that is separate source context,
not evidence collected from the browser failure.

### F2 / P2: New opening entry is labeled as a system migration

Immediately after creating the measured QA item in this run, the history showed
"Recorded by: System migration" for its opening entry. This was not a legacy
record. Expected a truthful creator/origin; a migration label misstates provenance.
Observed on opening and after refresh in both languages.

### F3 / P2: Existing error does not update when language switches

1. In English stock UI, submit 0.0001 kg with a reason.
2. Observe the English quantity validation error.
3. Switch to Romanian using RO.

Expected: all app-authored error feedback reflects Romanian. Actual: surrounding
headings/fields and numbers translated, but "Enter a valid quantity with up to 3
decimals; pieces must be whole numbers." remained English. Captured visually.

### F4 / P2: Metadata editor omits quantity unit and locale formatting

Open Edit for the measured QA product while Romanian is active. Current balance
was displayed as "Stoc curent: 1.5", with no kg; the catalog/stock page correctly
displayed 1,5 kg. Expected consistent locale-aware quantity and explicit unit.
Metadata rename succeeded and preserved the quantity.

## Test data retained

No existing business product was modified. No records were deleted.

| Name | SKU | Product ID | Final visible state |
| --- | --- | --- | --- |
| QA-20261025-FE-MEASURED-EDITED | QA-20261025-FE-KG | 83fa5b3b-bec1-4fda-a57f-6a6dec8fe1af | End product, kg, 1.5 stock, price 12.50 RON; one opening entry; consumption failed |
| QA-20261025-FE-SERVICE | QA-20261025-FE-SVC | c049c669-7023-4079-9bb7-c32f95ed5ce5 | Service, not stock-tracked, 0.00 RON, no movement form/history |

The measured product originally had name QA-20261025-FE-MEASURED before the
metadata edit. Service creation deliberately followed a switch from a filled
stock form to verify stale stock controls did not remain visible; its hidden
database quantity was not inspected directly.

## Evidence and limitations

- Accessibility snapshots recorded each route and resulting field/balance/history
  state. Representative desktop stock and phone catalog screenshots were displayed
  in tool output. No local screenshot files were saved; no file paths are invented.
- Browser console error query after failed consumption returned no entries.
- Default desktop composition and phone catalog/menu were inspected. A full
  accessibility audit, all keyboard paths, 200% zoom, offline recovery, all browsers,
  full pagination, and long-history behavior were not exercised.
- Language persisted on deep-link reload. The error-language defect applies to
  an error already present during switching; freshly generated RO errors were not
  separately tested.
- Finished at Products with temporary viewport override cleared. Test records
  remain visible for follow-up verification.

## Recommended next action

Resolve the valid stock-submit failure and opening actor/origin first, then rerun
consume/receive/waste/adjust, insufficient-stock recovery, and reversal through
the UI. Fix dynamic error translation and edit-balance formatting alongside their
regressions. This QA run made no fixes or deployment changes.
