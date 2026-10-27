import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateChildFn } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import type { WorkspaceModuleKey } from '@retail/shared-types';
import { IdentityStore } from '../identity/identity-store';

/** Hides disabled modules in the UI; the API independently enforces each grant. */
export const moduleAccessGuard: CanActivateChildFn = (route) => {
  const moduleKey = route.data['moduleKey'] as WorkspaceModuleKey | undefined;
  if (!moduleKey) return true;

  const identity = inject(IdentityStore);
  const router = inject(Router);
  return toObservable(identity.moduleResolution).pipe(
    filter((result) => result !== undefined),
    take(1),
    map((result) => {
      if (result?.enabledModules.includes(moduleKey)) return true;
      if (result === null) return router.parseUrl('/app/home');
      return router.createUrlTree(['/app/module-unavailable'], { queryParams: { module: moduleKey } });
    })
  );
};
