import type { NextFunction, Request, Response } from "express";
import type { WorkspaceModuleKey } from "@retail/shared-types";
import { getTenantContext } from "../db/context";
import { getEnabledModules } from "../modules/tenants/moduleEntitlements";

/** Denies the route unless the authenticated workspace has this module enabled. */
export function requireModule(moduleKey: WorkspaceModuleKey) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = getTenantContext();
      const enabledModules = await getEnabledModules(tenantId);
      if (!enabledModules.includes(moduleKey)) {
        res.status(403).json({ error: "Workspace module is not enabled", code: "MODULE_NOT_ENABLED", moduleKey });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
