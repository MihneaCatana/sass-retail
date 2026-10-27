# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are the **owner of a small retail store (SMB)** and their **small staff of shift workers / cashiers**. Each store is a tenant (workspace) in a multi-tenant SaaS. The owner manages the workspace — setup, catalog, staffing; staff use the app during their shifts for day-to-day operations. One workspace per store; owner signs up self-serve and signs in immediately after.

## Product Purpose

A **back-office retail suite** for small retail stores: inventory & product catalog, sales & checkout, and staff/shift management, delivered in phases over time. It exists so an owner who can't afford heavyweight retail software can run their store's back office in one place. Success means the owner runs daily store operations here instead of spreadsheets.

## Positioning

**Open decision** — no confirmed mechanism or claim yet. Do not invent one.

## Operating Context

- Retail store back office: the owner typically sets things up out-of-hours or between customer-facing tasks; staff interact in short bursts during shifts.
- Auth flows through Keycloak (single realm `retail`); sign-in is a redirect (PKCE), not a custom credential form.
- Self-serve onboarding: `POST /api/onboarding/signup` provisions a tenant (schema, role, migrations, registry, admin user), and the new admin signs in immediately.

## Capabilities and Constraints

Confirmed today (in the app):

- Tenant self-serve signup (`/signup`) with immediate sign-in after provisioning.
- Sign-in via Keycloak PKCE redirect; route guarding via auth guard.
- Dev parity with production: same Docker images, no dev-only code paths.

Inventory foundation is implemented: product/service/consumable catalog, measured
quantities, stock movements/history/reversals, search, and sortable catalog columns.

Implemented locally: internal sales drafts/completion with atomic inventory
integration, returns/cancellation, effective-dated standard costs, and product
performance with cost coverage and estimated gross profit. The demand planner and
profit simulator were shelved on 2026-10-27 and removed from the app; their
historical specifications remain in
[Sales, inventory, and profitability](../../docs/features/sales/PRODUCT.md).
Actual inventory valuation and realized profit remain gated on a chosen costing
method and receipt-backed cost capture. Fiscal checkout integration and
staff/shift management remain separate scope decisions. Local verification does
not establish browser approval, pilot demand, or production readiness.

Technical constraints that shape any UI work:

- Tenant identity comes only from the verified JWT (`tenant_slug` claim) — no header/query/body identity, no auth bypasses.
- Strict dev == prod rule; apps run identically in dev and prod.
- API contracts live in `@retail/shared-types`; no duplicated DTOs.

Terminology: "tenant" and "workspace" are used interchangeably for a store's account; the owner-level role is `tenant-admin`.

## Brand Commitments

None. The name "sass-retail" is a **placeholder**; no logo, voice, or visual identity is locked in. Do not treat the placeholder name as a brand asset.

## Evidence on Hand

- Repo documentation: `README.md`, `AGENT.md`, `TECH_DEBT.md`, `docs/architecture.md`.
- Seeded dev users: `demo-acme` / `DemoAcme-Dev1` (tenant acme), `platform-admin` / `PlatformAdmin-Dev1`.
- **Absences that must not be fabricated**: no marketing copy, no testimonials, no customer data, no product screenshots, no logo/brand assets, no pricing.

## Product Principles

1. **Owner in control** — the owner manages the workspace; every setup and staffing decision stays with them.
2. **Shift-friendly speed** — staff interactions are short and task-focused; flows must tolerate interruption and low attention windows.
3. **Trustworthy by construction** — multi-tenant isolation and security are user-visible trust, not just backend hygiene.
4. **Honest, phased scope** — ship what exists; never fake capability that isn't built yet.
