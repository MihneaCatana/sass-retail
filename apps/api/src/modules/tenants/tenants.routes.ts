import { Router } from "express";
import { getTenantContext } from "../../db/context";

export const tenantsRouter = Router();

/** Returns the tenant resolved for the current request. */
tenantsRouter.get("/current", (_req, res) => {
  const ctx = getTenantContext();
  res.json({ tenantId: ctx.tenantId, slug: ctx.slug, name: ctx.name });
});
