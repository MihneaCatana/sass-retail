import "express";

declare global {
   
  namespace Express {
    interface Request {
      /**
       * Set exclusively by the (Phase 3) auth middleware after JWT verification.
       * NEVER populated from raw request data.
       */
      auth?: {
        sub: string;
        tenantSlug?: string;
        roles: string[];
      };
    }
  }
}
