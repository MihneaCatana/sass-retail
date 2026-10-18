import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { first, mergeMap } from 'rxjs';

/** Attaches the OIDC access token to every outgoing API request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oidcSecurityService = inject(OidcSecurityService);

  return oidcSecurityService.getAccessToken().pipe(
    first(),
    mergeMap((token) =>
      token ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })) : next(req)
    )
  );
};
