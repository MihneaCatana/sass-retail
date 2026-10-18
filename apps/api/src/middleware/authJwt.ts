import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../shared/logger";

const JWKS = createRemoteJWKSet(
  new URL(env.JWT_JWKS_URL ?? `${env.JWT_ISSUER_URL}/protocol/openid-connect/certs`)
);

interface RealmAccess {
  roles?: string[];
}

/**
 * Validates the Bearer JWT against Keycloak (signature via JWKS, issuer,
 * audience) and populates `req.auth`. This is the ONLY source of tenant/user
 * identity in the app. There is deliberately NO bypass: requests without a
 * valid token never reach business routes.
 */
export async function authJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), JWKS, {
      issuer: env.JWT_ISSUER_URL,
      audience: env.JWT_AUDIENCE
    });

    req.auth = {
      sub: payload.sub as string,
      tenantSlug: typeof payload.tenant_slug === "string" ? payload.tenant_slug : undefined,
      roles: (payload.realm_access as RealmAccess | undefined)?.roles ?? []
    };
    next();
  } catch (err) {
    logger.debug({ err }, "JWT validation failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
