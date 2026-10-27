# Workspace module access

## Outcome

Let platform operators grant or remove access to the modules already available
in Storeboard, so workspaces can be configured for different SMB needs. This
first increment covers workspace entitlements. Pricing tiers and operational
rollout switches remain separate decisions.

## First delivery

- `inventory`: products, stock balances, and movement history.
- `sales`: internal sales recording and inventory integration.
- `sales-insights`: recorded sales performance and standard-cost workflows.
- Existing and newly created workspaces start with all three modules enabled
  to preserve the current experience.
- Platform admins manage module grants from the tenant detail page. Every
  update is written to the existing platform audit trail.
- Workspace members receive effective grants based only on the verified JWT's
  tenant identity. Navigation and direct frontend routes reflect grants, and
  the API independently denies disabled modules.
- A disabled route provides a localized explanation and a path back to the
  workspace. Current user roles continue to apply inside enabled modules.

## Security and operational boundaries

- The API exposes grant changes only through platform-admin protected routes.
- The runtime database role has read access to grants and execute access to a
  narrow, fixed-purpose function. It cannot directly mutate the entitlement
  table or other platform tables through this feature.
- Module reads are cached for at most ten seconds per API process; grant writes
  invalidate the local entry. Other API processes observe a change after their
  cache expires.
- The SQL function accepts only the fixed module catalog. Tenant identity for
  tenant-facing reads comes from verified JWT context, never request data.

## Not included

- Pricing, billing, trials, or self-serve plan changes.
- Arbitrary runtime feature flags or percentage rollouts.
- Salon appointments, staff scheduling, or other unimplemented capabilities.
- Customer research or a claim that these bundles have validated demand.

## Follow-up decision

Pilot a small number of package combinations with Romanian SMB owners. Measure
whether workspaces granted a module complete its first useful task and return
to it; validate the time windows and baseline during the pilot. Decide whether
to revise bundles, expand access, or stop before adding billing automation.
