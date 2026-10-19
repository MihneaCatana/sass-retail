import type { NextFunction, Request, Response } from "express";

/**
 * Minimal fixed-window rate limiter. In-memory and single-instance by design —
 * replace with a distributed limiter when horizontally scaling (see TECH_DEBT.md).
 *
 * `key` customizes the bucket: the default is the client IP (public endpoints
 * like signup); `tenantRateLimit` builds per-tenant buckets from the verified
 * JWT. If `key` returns undefined the request is not throttled (e.g. no tenant).
 */
export function rateLimit(
  options: { windowMs: number; max: number; key?: (req: Request) => string | undefined }
): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodically drop expired entries so the map cannot grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, options.windowMs).unref();

  return (req, res, next) => {
    const key = options.key ? options.key(req) : (req.ip ?? "unknown");
    // No bucket key (e.g. request without a tenant) → nothing to throttle.
    if (!key) {
      next();
      return;
    }
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.status(429).json({ error: "Too many requests, try again later" });
      return;
    }
    next();
  };
}

/**
 * Per-tenant limiter (TICKET-105 / SEC-005): buckets by the verified
 * `tenant_slug` claim so one tenant's traffic cannot starve another's, even
 * when users share an IP (e.g. one office NAT). Requests without a tenant
 * slug pass through — the JWT check already rejects them with 401.
 */
export function tenantRateLimit(
  options: { windowMs: number; max: number }
): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimit({
    ...options,
    key: (req) => req.auth?.tenantSlug
  });
}

/**
 * Per-user limiter for authenticated endpoints outside any tenant context
 * (e.g. platform-admin routes): buckets by the verified JWT `sub`, falling
 * back to the client IP when the caller is unauthenticated.
 */
export function userRateLimit(
  options: { windowMs: number; max: number }
): (req: Request, res: Response, next: NextFunction) => void {
  return rateLimit({
    ...options,
    key: (req) => req.auth?.sub ?? req.ip
  });
}
