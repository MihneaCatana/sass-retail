import { pool } from "../db/pool";
import { getTenantContext } from "../db/context";
import { logger } from "./logger";

/**
 * Append-only platform audit trail. Fire-and-forget: auditing must never
 * break the request it describes. Actor defaults to the tenant-context user,
 * or "system" outside a tenant context.
 */
export async function audit(
  action: string,
  details: Record<string, unknown> = {},
  actor?: string
): Promise<void> {
  let resolvedActor = actor ?? "system";
  if (actor === undefined) {
    try {
      resolvedActor = getTenantContext().userId ?? "system";
    } catch {
      // no tenant context (public endpoints)
    }
  }

  try {
    await pool.query(
      `INSERT INTO public.audit_log (actor, action, details) VALUES ($1, $2, $3::jsonb)`,
      [resolvedActor, action, JSON.stringify(details)]
    );
  } catch (err) {
    logger.error({ err, action }, "audit write failed");
  }
}
