import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { concatMap, first, map } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { IdentityStore } from '../identity/identity-store';

/** sessionStorage key holding the URL the user was trying to reach. */
export const RETURN_URL_KEY = 'auth.returnUrl';

/**
 * Sends users who are not signed in to the sign-in page. Apply to protected
 * routes.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const identity = inject(IdentityStore);
  const router = inject(Router);
  const oidcSecurityService = inject(OidcSecurityService);

  // The auth-state stream emits `false` synchronously on boot — BEFORE the
  // OIDC session check has validated the stored session. Deciding on that
  // false used to send already-signed-in users through a full-page Keycloak
  // redirect on every refresh (visibly a loading screen, and a hang when
  // Keycloak itself was slow or unreachable). Wait for the session check to
  // resolve first — it is bounded (IdentityStore), so this always settles.
  return identity.authCheckComplete$.pipe(
    first((complete) => complete),
    concatMap(() => oidcSecurityService.isAuthenticated$.pipe(first())),
    map(({ isAuthenticated }) => {
      if (isAuthenticated) {
        return true;
      }
      // Remember the intended destination so the post-login redirect can
      // restore it, and hand the Keycloak round trip over to the sign-in
      // page: the user starts it explicitly from there instead of being
      // redirected away from a refresh.
      sessionStorage.setItem(RETURN_URL_KEY, state.url);
      return router.parseUrl('/');
    })
  );
};
