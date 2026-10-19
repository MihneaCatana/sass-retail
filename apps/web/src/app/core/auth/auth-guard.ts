import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs';

/** sessionStorage key holding the URL the user was trying to reach. */
export const RETURN_URL_KEY = 'auth.returnUrl';

/** Redirects unauthenticated users to Keycloak. Apply to protected routes. */
export const authGuard: CanActivateFn = (_route, state) => {
  const oidcSecurityService = inject(OidcSecurityService);

  return oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => {
      if (isAuthenticated) {
        return true;
      }
      // Remember the intended destination so the post-login redirect can
      // restore it (sessionStorage survives the Keycloak round trip).
      sessionStorage.setItem(RETURN_URL_KEY, state.url);
      oidcSecurityService.authorize();
      return false;
    })
  );
};
