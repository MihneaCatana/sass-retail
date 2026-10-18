import type { NextFunction, Request, Response } from "express";
import { logger } from "../shared/logger";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: "Not found", path: req.path });
}

/**
 * Central error handler. Must be registered last.
 * Never leaks internals to the client; logs full error instead.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // express.json() body parse errors
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }
  logger.error({ err, path: req.path, method: req.method }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
