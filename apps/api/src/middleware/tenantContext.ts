import type { NextFunction, Request, Response } from "express";
import { runWithTenantContext } from "../db/context";
import { getActiveTenantBySlug } from "../modules/tenants/tenantStore";

/**
 * Resolves the tenant for the request and opens the tenant context
 * (AsyncLocalStorage + schema) for all downstream handlers.
 *
 * Tenant identity comes ONLY from the verified JWT (`req.auth`, set by the
 * authJwt middleware). There is no header/fallback path.
 */
export async function tenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slug = req.auth?.tenantSlug;

    if (!slug) {
      // Authenticated (req.auth set by authJwt) but not linked to any tenant.
      res.status(req.auth ? 403 : 401).json({ error: req.auth ? "Account not linked to a tenant" : "Unauthorized" });
      return;
    }

    const tenant = await getActiveTenantBySlug(slug);
    if (!tenant) {
      res.status(403).json({ error: "Unknown or inactive tenant" });
      return;
    }

    runWithTenantContext(
      {
        tenantId: tenant.id,
        slug: tenant.slug,
        schema: tenant.schemaName,
        name: tenant.name,
        userId: req.auth?.sub,
        roles: req.auth?.roles ?? []
      },
      () => next()
    );
  } catch (err) {
    next(err);
  }
}
