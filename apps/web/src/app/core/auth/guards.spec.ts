import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { authGuard, RETURN_URL_KEY } from './auth-guard';

@Component({ selector: 'stub-protected', template: 'protected-content' })
class Protected {}

@Component({ selector: 'stub-signin', template: 'sign-in-page' })
class SignInStub {}

/**
 * The auth-state stream emits `false` synchronously on boot (BehaviorSubject
 * default, before checkAuth resolves) — exactly the state that used to make
 * the guard redirect signed-in users to Keycloak on every refresh.
 */
function setup(): {
  authState: BehaviorSubject<{ isAuthenticated: boolean }>;
  checkAuth$: Subject<null>;
  authorize: ReturnType<typeof vi.fn>;
  router: Router;
} {
  const authState = new BehaviorSubject<{ isAuthenticated: boolean }>({ isAuthenticated: false });
  const checkAuth$ = new Subject<null>();
  const authorize = vi.fn();

  TestBed.configureTestingModule({
    imports: [Protected, SignInStub],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'protected', canActivate: [authGuard], component: Protected },
        { path: '', component: SignInStub }
      ]),
      {
        provide: OidcSecurityService,
        useValue: {
          isAuthenticated$: authState,
          checkAuth: () => checkAuth$.asObservable(),
          authorize
        }
      }
    ]
  });

  return { authState, checkAuth$, authorize, router: TestBed.inject(Router) };
}

describe('authGuard', () => {
  it('lets a signed-in user straight through once the session check resolves — no Keycloak redirect', async () => {
    const { authState, checkAuth$, authorize, router } = setup();

    const navigation = router.navigateByUrl('/protected');
    await new Promise((resolve) => setTimeout(resolve)); // let the guard run
    expect(authorize).not.toHaveBeenCalled(); // check still pending

    // The session check resolves and reports a session (library order: the
    // auth state is set during the check, before its observable emits).
    authState.next({ isAuthenticated: true });
    checkAuth$.next(null);
    await navigation;

    expect(router.url).toBe('/protected');
    expect(authorize).not.toHaveBeenCalled();
  });

  it('sends a signed-out user to the sign-in page instead of auto-launching a Keycloak redirect', async () => {
    const { checkAuth$, authorize, router } = setup();

    const navigation = router.navigateByUrl('/protected');
    await new Promise((resolve) => setTimeout(resolve));
    checkAuth$.next(null); // check resolves: no session
    await navigation;

    expect(router.url).toBe('/');
    expect(sessionStorage.getItem(RETURN_URL_KEY)).toBe('/protected');
    expect(authorize).not.toHaveBeenCalled();
  });
});