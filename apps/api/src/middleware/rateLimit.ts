import type { NextFunction, Request, Response } from "express";

/**
 * Minimal fixed-window per-IP rate limiter for public endpoints (e.g. signup).
 * In-memory and single-instance by design — replace with a distributed limiter
 * when horizontally scaling (see TECH_DEBT.md).
 */
export function rateLimit(options: { windowMs: number; max: number }): (req: Request, res: Response, next: NextFunction) => void {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodically drop expired entries so the map cannot grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, options.windowMs).unref();

  return (req, res, next) => {
    const key = req.ip ?? "unknown";
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
