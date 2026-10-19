import { db } from "../db/drizzle";
import { getTenantContext } from "../db/context";
import { logger } from "./logger";
import { auditLog } from "./audit.schema";

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
    await db.insert(auditLog).values({ actor: resolvedActor, action, details });
  } catch (err) {
    logger.error({ err, action }, "audit write failed");
  }
}
