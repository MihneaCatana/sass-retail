# Sales design validation

Date: 2026-10-25. Reviewer: independent Storeboard designer agent.

## Verdict

Source review completed; rendered design approval is pending. No live screen was observed and no business data was changed. This report must not be represented as a desktop/mobile visual pass.

## Browser evidence and limitation

The deployed target was `http://localhost:8082`. Browser connection attempts returned `getTab({ url }) requires an explicit browser`, followed by `No browser is available`. The browser inventory returned `browsers: []`. A native Brave fallback using the returned window ID failed with `Computer Use app approval timed out`. Consequently desktop, 390px mobile, EN/RO rendering and keyboard interaction could not be assessed. Browser ownership was released to the parent for QA.

## Source review

Reviewed the Storeboard designer skill, `apps/web/DESIGN.md`, sales product/implementation plans and the sales templates, component logic, stylesheet and EN/RO strings.

Initial material findings were sent directly to the frontend implementer. Reinspection confirms source changes addressing the main risks:

- Cost-product selection clears prior product cost inputs and is disabled while saving.
- Draft inputs are disabled during asynchronous writes; dirty-state guards protect refresh/navigation; basis/note edits invalidate completion review.
- Completion/correction confirmation receives focus and scrolls into view.
- Working surface, filter and local horizontal table scrolling styles now exist, including the 620px stacking rule.
- Zero-price lines require an explicit reason; returns include per-line stock disposition and readable actors.
- Product pager buttons have localized accessible names; return quantity labels identify the product.
- Cost failures distinguish server failure from input validation; simulator dates use Europe/Bucharest and cost source/basis strings are translated.
- Simulator price changes invalidate confirmation. Latest effective cost is shown with its basis; incompatible costs cannot silently prefill an older compatible version.

Financial copy appropriately separates actual recorded sales from estimated gross profit, explicitly excludes unknown/incompatible costs, shows coverage, and describes corrections as operational rather than fiscal/payment refunds. Simulator assumptions explicitly confirm a consistent price/cost basis and include an exact-value table.

## Final source follow-up

- Rechecked the final low-priority patch: cost/simulator templates no longer append redundant `(RON)` suffixes to translated labels.
- Return history now includes a localized product unit resolved from the original sale line and displays the correction identifier as its reference. This supplies traceability; a friendly correction-reference format can be considered separately.
- No unresolved source blocker identified by this design review. This is not a statement that runtime behavior or rendered accessibility has passed.

## Rendered observations still required

- Confirm in the rendered review that the 40rem minimum-width tables scroll within their region, long Romanian labels remain readable, and confirmation focus is visible after review/return actions. Source rules alone do not establish these outcomes.

## Required rendered follow-up

Use a working browser to inspect sales list/draft/read-only details, corrections, costs, performance and simulator at desktop and 390px. Check EN/RO, keyboard focus, local table overflow and unknown/empty/error states. Capture actual observations before granting final visual approval. QA screenshots may support an independent visual review if direct browser connection remains unavailable.
