import { Service, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth';
import type { CurrentTenant, Me } from '@retail/shared-types';

/**
 * Shared identity + tenant state for the signed-in shell. The sidebar and
 * routed pages all read from this single instance instead of re-fetching
 * (httpResource skill: encapsulate backend calls in services, not components).
 */
@Service()
export class IdentityStore {
  private readonly auth = inject(AuthService);

  readonly isAuthenticated = toSignal(
    this.auth.isAuthenticated$.pipe(map((result) => result.isAuthenticated)),
    { initialValue: false }
  );

  /** True once the initial OIDC session check has resolved (any outcome). */
  private readonly authCheckComplete = signal(false);
  readonly isAuthCheckComplete = this.authCheckComplete.asReadonly();

  readonly me = httpResource<Me>(() => (this.isAuthenticated() ? '/api/me' : undefined));
  readonly tenant = httpResource<CurrentTenant>(() =>
    this.isAuthenticated() ? '/api/tenants/current' : undefined
  );

  readonly isPlatformAdmin = computed(() => {
    // hasValue() is false in the error state, where value() would throw.
    return this.me.hasValue() && this.me.value().roles.includes('platform-admin');
  });

  readonly userName = computed(() => (this.me.hasValue() ? this.me.value().sub : ''));

  constructor() {
    this.auth.checkAuth().subscribe({
      next: () => this.authCheckComplete.set(true),
      // A failed check must never block the UI: the user just stays signed
      // out and the sign-in page renders.
      error: () => this.authCheckComplete.set(true)
    });
  }
}
