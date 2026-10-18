import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs';

/** Redirects unauthenticated users to Keycloak. Apply to protected routes. */
export const authGuard: CanActivateFn = () => {
  const oidcSecurityService = inject(OidcSecurityService);

  return oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => {
      if (isAuthenticated) {
        return true;
      }
      oidcSecurityService.authorize();
      return false;
    })
  );
};
