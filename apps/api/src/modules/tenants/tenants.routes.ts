import { Router } from "express";
import { getTenantContext } from "../../db/context";
import { requireRole } from "../../middleware/requireRole";
import { audit } from "../../shared/audit";
import { SLUG_RE } from "@retail/provisioning";
import type { TenantDetail } from "@retail/shared-types";
import { getRecentAuditForTenant, getTenantBySlug, listAllTenants } from "./tenantStore";

export const tenantsRouter = Router();

/** Returns the tenant resolved for the current request. */
tenantsRouter.get("/current", (_req, res) => {
  const ctx = getTenantContext();
  res.json({ tenantId: ctx.tenantId, slug: ctx.slug, name: ctx.name });
});

/**
 * Platform-scoped tenant registry endpoints. Mounted OUTSIDE the
 * tenantContext middleware: platform admins are deliberately not linked to
 * any tenant, so these routes never enter a tenant context.
 */
export const platformTenantsRouter = Router();

/** Lists every tenant in the registry (platform-admin only, audit-logged). */
platformTenantsRouter.get("/", requireRole("platform-admin"), async (req, res, next) => {
  try {
    const tenants = await listAllTenants();
    await audit("platform.tenants.listed", { count: tenants.length }, req.auth?.sub);
    res.json({ tenants });
  } catch (err) {
    next(err);
  }
});

/** Tenant detail: registry entry + recent audit trail (platform-admin only). */
platformTenantsRouter.get("/:slug", requireRole("platform-admin"), async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "");
    if (!SLUG_RE.test(slug)) {
      // Slugs are tightly constrained; anything else cannot name a tenant.
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const recentAuditEntries = await getRecentAuditForTenant(tenant.slug);
    await audit("platform.tenant.viewed", { slug: tenant.slug }, req.auth?.sub);
    const detail: TenantDetail = { tenant, recentAuditEntries };
    res.json(detail);
  } catch (err) {
    next(err);
  }
});


