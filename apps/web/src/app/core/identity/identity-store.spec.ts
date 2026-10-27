import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { BehaviorSubject, EMPTY, Observable, of, throwError } from 'rxjs';
import { IdentityStore } from './identity-store';
import { AUTH_CHECK_RETRIES, AUTH_CHECK_TIMEOUT_MS } from './identity-store';

function setup(checkAuth: () => Observable<unknown>): IdentityStore {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Real timers with a tiny bound: deterministic and fast.
      { provide: AUTH_CHECK_TIMEOUT_MS, useValue: 30 },
      { provide: AUTH_CHECK_RETRIES, useValue: 1 },
      {
        provide: OidcSecurityService,
        useValue: {
          isAuthenticated$: new BehaviorSubject({ isAuthenticated: false }),
          checkAuth
        }
      }
    ]
  });
  return TestBed.inject(IdentityStore);
}

describe('IdentityStore auth check', () => {
  it('dismisses the splash if the OIDC check completes without emitting', () => {
    const store = setup(() => EMPTY);
    expect(store.isAuthCheckComplete()).toBe(true);
  });
  it('dismisses the splash when the check resolves', () => {
    const store = setup(() => of(null));
    expect(store.isAuthCheckComplete()).toBe(true);
  });

  it('dismisses the splash when the check fails', () => {
    const store = setup(() => throwError(() => new Error('boom')));
    expect(store.isAuthCheckComplete()).toBe(true);
  });

  it('dismisses the splash when the check hangs (timeout + one retry)', async () => {
    // A cold observable: each (re)subscription re-runs the "OIDC check" work.
    // retry() re-subscribes the returned observable, not the factory function,
    // so the retry count is tracked per subscription.
    let attempts = 0;
    const checkAuth = vi.fn(
      () =>
        new Observable<never>(() => {
          attempts += 1;
          return () => undefined;
        })
    );
    const store = setup(checkAuth);

    expect(store.isAuthCheckComplete()).toBe(false);

    // Wait past the bound: first timeout fires, one retry runs, second
    // timeout exhausts the bound -> splash dismissed.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(store.isAuthCheckComplete()).toBe(true);
    expect(attempts).toBe(2);
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });
});
