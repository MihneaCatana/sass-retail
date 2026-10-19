import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { IdentityStore } from '../identity/identity-store';

/** Redirects already-signed-in users away from public pages (e.g. signin). */
export const signedInGuard: CanActivateFn = () => {
  const identity = inject(IdentityStore);
  const router = inject(Router);

  if (identity.isAuthenticated()) {
    return router.parseUrl('/app/home');
  }
  return true;
};
