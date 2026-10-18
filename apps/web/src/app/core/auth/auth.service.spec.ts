import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('subscribes to logoff() — the cold observable never runs otherwise and logout silently does nothing', () => {
    const logoff = vi.fn(() => of(null));
    TestBed.configureTestingModule({
      providers: [{ provide: OidcSecurityService, useValue: { logoff } }]
    });

    TestBed.inject(AuthService).logout();

    expect(logoff).toHaveBeenCalledOnce();
  });
});