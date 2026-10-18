import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool";
import { provisioning } from "../../db/provisioningPool";
import { RESERVED_SLUGS, SLUG_RE } from "@retail/provisioning";
import { rateLimit } from "../../middleware/rateLimit";
import { audit } from "../../shared/audit";
import { logger } from "../../shared/logger";
import { EmailAlreadyRegisteredError, TenantAttributeNotPersistedError, createTenantAdminUser, emailExists } from "./keycloakAdmin";

export const onboardingRouter = Router();

const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(64).regex(SLUG_RE),
  adminEmail: z.string().trim().email().max(120).toLowerCase(),
  // Keycloak stores its own hash; 10+ chars keeps the weakest acceptable.
  adminPassword: z.string().min(10).max(128)
});

/** Public endpoint (creates accounts) — hard rate limit per IP. */
const signupRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10 });

onboardingRouter.post("/signup", signupRateLimit, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid signup data", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { companyName, slug, adminEmail, adminPassword } = parsed.data;

    // 1. Slug must be free and not reserved.
    if (RESERVED_SLUGS.has(slug)) {
      res.status(409).json({ error: "This workspace address is reserved" });
      return;
    }
    const slugTaken = await pool.query("SELECT 1 FROM public.tenants WHERE slug = $1", [slug]);
    if (slugTaken.rowCount && slugTaken.rowCount > 0) {
      res.status(409).json({ error: "This workspace address is already taken" });
      return;
    }

    // 2. Email must be free (checked in Keycloak, the source of truth for users).
    if (await emailExists(adminEmail)) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    // 3. Provision the tenant (schema + per-tenant role + migrations + registry).
    let tenantId: string;
    try {
      const tenant = await provisioning.provisionTenant({ slug, name: companyName });
      tenantId = tenant.id;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        res.status(409).json({ error: "This workspace address is already taken" });
        return;
      }
      throw err;
    }

    // 4. Create the Keycloak admin user. If this fails, compensate so no
    //    half-registered tenant remains.
    try {
      await createTenantAdminUser({ email: adminEmail, password: adminPassword, companyName, tenantSlug: slug });
    } catch (err) {
      await provisioning.dropTenant(slug, { force: true });
      if (err instanceof EmailAlreadyRegisteredError) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      if (err instanceof TenantAttributeNotPersistedError) {
        logger.error({ err, slug }, "tenant signup rejected: Keycloak realm misconfigured");
        res.status(503).json({ error: err.message });
        return;
      }
      logger.error({ err, slug }, "tenant signup failed during Keycloak user creation");
      next(err);
      return;
    }

    audit("tenant.created", { slug, name: companyName, adminEmail }, adminEmail);

    res.status(201).json({ slug, name: companyName, adminEmail, tenantId });
  } catch (err) {
    next(err);
  }
});
