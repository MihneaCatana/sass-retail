import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { AuthService } from './auth';
import { ErrorToast } from '../feedback/error-toast';
import { catchError, first, mergeMap, throwError } from 'rxjs';

/** Attaches the OIDC access token to every outgoing API request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Discovery, token exchange, and user-info calls belong to the OIDC client.
  // They must not depend on retrieving the session they are establishing.
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }
  const oidcSecurityService = inject(OidcSecurityService);
  const auth = inject(AuthService);
  const errorToast = inject(ErrorToast);

  return oidcSecurityService.getAccessToken().pipe(
    first(),
    mergeMap((token) => {
      const authenticatedRequest = token
        ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
        : next(req);

      return authenticatedRequest.pipe(
        catchError((error: unknown) => {
          if (token && error instanceof HttpErrorResponse && error.status === 401) {
            auth.expireSession();
          } else if (error instanceof HttpErrorResponse && error.status !== 401) {
            errorToast.show(error);
          }
          return throwError(() => error);
        })
      );
    })
  );
};
