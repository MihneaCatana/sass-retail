import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';

/** Thin wrapper over the OIDC library — the only place that touches it directly. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly oidcSecurityService = inject(OidcSecurityService);

  readonly isAuthenticated$ = this.oidcSecurityService.isAuthenticated$;
  readonly userData$ = this.oidcSecurityService.userData$;

  /** Completes the OIDC callback handling on app start. */
  checkAuth(): void {
    this.oidcSecurityService.checkAuth().subscribe();
  }

  login(): void {
    this.oidcSecurityService.authorize();
  }

  logout(): void {
    this.oidcSecurityService.logoff();
  }
}
