import { Router } from "express";
import { getTenantContext } from "../../db/context";
import { requireRole } from "../../middleware/requireRole";
import { audit } from "../../shared/audit";
import { SLUG_RE } from "@retail/provisioning";
import type { TenantDetail } from "@retail/shared-types";
import { WORKSPACE_MODULE_KEYS } from "@retail/shared-types";
import { z } from "zod";
import { getEnabledModules, replaceTenantModules } from "./moduleEntitlements";
import { getRecentAuditForTenant, getTenantBySlug, listAllTenants } from "./tenantStore";

export const tenantsRouter = Router();

/** Returns the tenant resolved for the current request. */
tenantsRouter.get("/current", (_req, res) => {
  const ctx = getTenantContext();
  res.json({ tenantId: ctx.tenantId, slug: ctx.slug, name: ctx.name });
});

/** Effective module access for the tenant resolved from the verified JWT. */
tenantsRouter.get("/current/modules", async (_req, res, next) => {
  try {
    const { tenantId } = getTenantContext();
    res.json({ enabledModules: await getEnabledModules(tenantId) });
  } catch (err) {
    next(err);
  }
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
    const [recentAuditEntries, enabledModules] = await Promise.all([
      getRecentAuditForTenant(tenant.slug),
      getEnabledModules(tenant.id)
    ]);
    await audit("platform.tenant.viewed", { slug: tenant.slug }, req.auth?.sub);
    const detail: TenantDetail = { tenant, enabledModules, recentAuditEntries };
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

const moduleUpdateSchema = z.object({
  enabledModules: z.array(z.enum(WORKSPACE_MODULE_KEYS)).max(WORKSPACE_MODULE_KEYS.length)
}).strict();

/** Replaces workspace module grants. Platform-admin only and audit logged. */
platformTenantsRouter.put("/:slug/modules", requireRole("platform-admin"), async (req, res, next) => {
  try {
    const slug = String(req.params.slug ?? "");
    if (!SLUG_RE.test(slug)) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    const parsed = moduleUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid workspace module set", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }
    await replaceTenantModules(tenant.id, parsed.data.enabledModules);
    await audit("platform.tenant.modules_updated", {
      slug: tenant.slug,
      enabledModules: parsed.data.enabledModules
    }, req.auth?.sub);
    res.json({ enabledModules: parsed.data.enabledModules });
  } catch (err) {
    next(err);
  }
});


