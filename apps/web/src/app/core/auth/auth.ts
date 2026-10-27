import { Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import type { LoginResponse } from 'angular-auth-oidc-client';
import type { Observable } from 'rxjs';
import { first } from 'rxjs';

/** Thin wrapper over the OIDC library — the only place that touches it directly. */
@Service()
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly router = inject(Router);
  private expiringSession = false;

  readonly isAuthenticated$ = this.oidcSecurityService.isAuthenticated$;
  readonly userData$ = this.oidcSecurityService.userData$;

  /** Completes the OIDC callback handling on app start. */
  checkAuth(): Observable<LoginResponse> {
    return this.oidcSecurityService.checkAuth();
  }

  login(): void {
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    // logoff() returns a COLD observable — without subscribing nothing happens
    // (no end-session redirect to Keycloak, no local state reset).
    this.oidcSecurityService.logoff().subscribe({
      error: (err) => console.error('Logout failed', err)
    });
  }

  /** Clears a rejected API session locally and routes the user to sign-in. */
  expireSession(): void {
    if (this.expiringSession) return;
    this.expiringSession = true;
    this.oidcSecurityService.logoffLocal();
    this.oidcSecurityService.isAuthenticated$.pipe(first((state) => !state.isAuthenticated)).subscribe(() => {
      void this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }
}
