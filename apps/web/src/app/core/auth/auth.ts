import { Service, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import type { LoginResponse } from 'angular-auth-oidc-client';
import type { Observable } from 'rxjs';

/** Thin wrapper over the OIDC library — the only place that touches it directly. */
@Service()
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);

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
}
