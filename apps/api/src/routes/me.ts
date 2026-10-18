import { Router } from "express";

export const meRouter = Router();

/** Identity of the authenticated caller (no tenant context needed). */
meRouter.get("/", (req, res) => {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ sub: req.auth.sub, roles: req.auth.roles, tenantSlug: req.auth.tenantSlug ?? null });
});

