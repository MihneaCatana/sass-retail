import type { NextFunction, Request, Response } from "express";

/**
 * Route guard for role-protected endpoints (e.g. the platform-admin tenant
 * registry). Identity comes exclusively from the verified JWT (`req.auth`,
 * set by the authJwt middleware) — never from request data.
 */
export function requireRole(role: string): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.auth) {
      // authJwt always populates req.auth first; this is a defense in depth.
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.auth.roles.includes(role)) {
      res.status(403).json({ error: `Requires the "${role}" role` });
      return;
    }
    next();
  };
}
