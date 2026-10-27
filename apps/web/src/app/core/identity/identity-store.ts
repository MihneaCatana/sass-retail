import { InjectionToken, Service, computed, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReplaySubject, finalize, map, retry, timeout } from 'rxjs';
import { AuthService } from '../auth/auth';
import { I18nService } from '../i18n/i18n';
import type { CurrentTenant, Me, WorkspaceModuleKey, WorkspaceModules } from '@retail/shared-types';

/** Bounds for the initial OIDC session check — see the constructor. */
export const AUTH_CHECK_TIMEOUT_MS = new InjectionToken<number>('AUTH_CHECK_TIMEOUT_MS', {
  factory: () => 8_000
});
export const AUTH_CHECK_RETRIES = new InjectionToken<number>('AUTH_CHECK_RETRIES', {
  factory: () => 1
});

/**
 * Shared identity + tenant state for the signed-in shell. The sidebar and
 * routed pages all read from this single instance instead of re-fetching
 * (httpResource skill: encapsulate backend calls in services, not components).
 */
@Service()
export class IdentityStore {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly profile = signal<Record<string, unknown> | null>(null);

  readonly isAuthenticated = toSignal(
    this.auth.isAuthenticated$.pipe(map((result) => result.isAuthenticated)),
    { initialValue: false }
  );

  /** True once the initial OIDC session check has resolved (any outcome). */
  private readonly authCheckComplete = signal(false);
  readonly isAuthCheckComplete = this.authCheckComplete.asReadonly();

  /**
   * Stream of the session-check outcome; replays the latest state to late
   * subscribers (route guards wait on this — plain RxJS, no effect scheduling).
   */
  readonly authCheckComplete$ = new ReplaySubject<boolean>(1);

  readonly me = httpResource<Me>(() => (this.isAuthenticated() ? '/api/me' : undefined));
  readonly tenant = httpResource<CurrentTenant>(() =>
    this.isAuthenticated() ? '/api/tenants/current' : undefined
  );
  readonly workspaceModules = httpResource<WorkspaceModules>(() =>
    this.isAuthenticated() ? '/api/tenants/current/modules' : undefined
  );
  readonly moduleResolution = computed<WorkspaceModules | null | undefined>(() => {
    if (this.workspaceModules.hasValue()) return this.workspaceModules.value();
    return this.workspaceModules.error() ? null : undefined;
  });

  hasModule(moduleKey: WorkspaceModuleKey): boolean {
    return this.workspaceModules.hasValue() && this.workspaceModules.value().enabledModules.includes(moduleKey);
  }

  readonly isPlatformAdmin = computed(() => {
    // hasValue() is false in the error state, where value() would throw.
    return this.me.hasValue() && this.me.value().roles.includes('platform-admin');
  });

  readonly isTenantAdmin = computed(() => {
    // Reads for any tenant member; mutations are admin-only (TICKET-101).
    return this.me.hasValue() && this.me.value().roles.includes('tenant-admin');
  });

  /** Presentation only: authorization continues to use the verified API identity. */
  readonly userName = computed(() => {
    const profile = this.profile();
    const text = (key: string) => typeof profile?.[key] === 'string' ? profile[key].trim() : '';
    return text('name') || [text('given_name'), text('family_name')].filter(Boolean).join(' ')
      || text('email') || this.i18n.t('common.yourAccount');
  });

  constructor() {
    // The session check depends on the network and Keycloak: with an expired
    // token it performs a silent renew, and a hung/unreachable server (a known
    // failure class of the OIDC library) used to leave the app stuck on the
    // "Signing you in…" splash forever. Bound it with a timeout — plus one
    // retry for transient slowness (e.g. a cold Keycloak) — so the splash is
    // always dismissed: after the bound elapses the user proceeds as signed
    // out and can simply sign in again. The bounds are InjectionTokens so
    // tests can shrink them.
    const checkTimeoutMs = inject(AUTH_CHECK_TIMEOUT_MS);
    const checkRetries = inject(AUTH_CHECK_RETRIES);
    this.auth
      .checkAuth()
      .pipe(timeout(checkTimeoutMs), retry(checkRetries), finalize(() => this.completeAuthCheck()))
      .subscribe({
        next: (result) => {
          this.profile.set(result?.userData ?? null);
          this.completeAuthCheck();
        },
        // A failed check must never block the UI: the user just stays signed
        // out and the sign-in page renders.
        error: () => this.completeAuthCheck()
      });
  }

  private completeAuthCheck(): void {
    this.authCheckComplete.set(true);
    this.authCheckComplete$.next(true);
  }
}
