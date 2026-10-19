import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';

interface Me {
  sub: string;
  roles: string[];
  tenantSlug: string | null;
}

/**
 * Route guard for platform-admin pages. The API is the authority on roles
 * (realm roles are not reliably present in the ID token userData), so this
 * checks identity via `GET /api/me` — the same source the backend guard uses.
 */
export const platformAdminGuard: CanActivateFn = (_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
  const http = inject(HttpClient);
  const router = inject(Router);

  return http.get<Me>('/api/me').pipe(
    map((me) => (me.roles.includes('platform-admin') ? true : router.parseUrl('/app/home'))),
    catchError(() => of(router.parseUrl('/app/home')))
  );
};
