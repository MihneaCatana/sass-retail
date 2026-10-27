---
name: storeboard-designer
description: Design, refine, implement, or review Storeboard SaaS screens and components using its green/lime Angular Material system, mobile navigation, Romanian/English content, and inventory workflows. Use for designer-agent work in sass-retail; not for unrelated products or backend-only changes.
---

# Storeboard designer

Keep new and refined interfaces coherent with the current Storeboard product.
This skill routes agents to maintained project evidence; it does not carry a
second copy of the palette or component rules.

## Load the project contract

Locate the sass-retail repository from the active workspace or explicit user path.
Read `AGENT.md` (or `AGENTS.md`), `apps/web/DESIGN.md`, and
`apps/web/PRODUCT.md`. For inventory work also read
`docs/plans/inventory-foundation.md` when present and the actual shared contracts
and feature templates. If the repository is unavailable, request its path rather
than applying these rules to an unrelated project.

`apps/web/DESIGN.md` is the authoritative component guidance. Runtime theme values
live in `apps/web/src/styles.scss`; `.impeccable/design.json` holds documentation
previews and extensions, not production components. When documents and code
disagree, identify the conflict: preserve the accepted Storeboard direction and
avoid copying documented legacy defects. Do not silently claim a guideline is
implemented when only the document describes it.

Read the specific component being changed and its nearest reusable equivalent:
shared sidebar/nav-item, language switcher, status badge, data table, product form,
or stock page. Inspect the rendered target when available. Preserve dirty-worktree
changes and coordinate file ownership when another agent is working nearby.

## Make the design decision

- Identify the operator, task, primary action, and states affected by the request.
- Use the component mapping in DESIGN.md. Prefer Material controls and shared
  components; custom shells and stock-history rows are established patterns.
- Preserve the green navigation frame, lime selection, light working surfaces,
  deliberate whitespace, and readable data. Do not redesign the brand during an
  ordinary feature/refinement task.
- Choose layout based on content: operational table, narrow metadata form, stock
  workflow, or auth surface. Do not apply the old centered auth card everywhere.
- Follow the mobile disclosure contract: links, language switcher, and sign out
  live together; hidden controls are not focusable; close on section selection
  and Escape. Preserve desktop navigation.
- Keep business meaning explicit: quantities carry units, prices have currency
  context, services do not suggest stock tracking, and reversals retain history.
  Never change precision or domain semantics just to make a layout fit.

Use Impeccable's applicable workflow when available, following the user's scope.
Do not require its launcher for routine work if it is unavailable; inspect project
evidence and disclose the limitation. This skill remains usable without that
plugin. For new visual-system decisions, update the shared design document and
sidecar together; ordinary extensions should reuse them.

## Implement within the request

Use semantic global tokens and supported Material theme/component APIs. Do not
override private Material DOM. Keep Angular templates/styles separate and follow
the repo's existing Signal Forms and resource patterns. New strings, validation
messages, status text, and accessible names belong in both English and Romanian
dictionaries; format numbers/dates with the active locale. Keep supplied business
names, SKUs, and user reasons intact.

Cover loading, empty/no-results, error/retry, pending, read-only/permission, focus,
and success states as relevant. Preserve input after failed submissions and avoid
duplicate actions. Do not bypass API roles or manufacture data to demonstrate a
design. Read-only review requests do not authorize implementation, deployments,
or backlog changes.

## Verify proportionately and hand off

For UI implementation, run the relevant build and meaningful affected tests.
Capture the changed surface at desktop (1440px), phone (390px), and the user's
viewport when different; test long Romanian copy, keyboard order/focus, and
material async states. Batch the inspection and corrections rather than polishing
indefinitely. Check contrast and overflow; restore temporary viewport overrides.
If browser/auth access blocks a state, report what was and was not verified.

Use existing local deployment instructions when the request calls for seeing the
change in Docker; never reset user data or change authentication configuration
just for a screenshot. Do not claim a running container proves visual correctness.
Documentation-only updates need link/token/schema validation, not an unnecessary
application rebuild.

Return what changed, where, why, checks performed, and material gaps. For a review,
return actionable findings anchored to files or observed states. For design-only
work, provide component/state/responsive behavior a coding agent can implement,
and label anything that remains a proposal.
