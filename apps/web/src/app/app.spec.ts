import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { OidcSecurityService, provideAuth } from 'angular-auth-oidc-client';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { RETURN_URL_KEY } from './core/auth/auth-guard';
import type { TenantSummary } from '@retail/shared-types';

const tenants: TenantSummary[] = [
  {
    id: 'id-1',
    slug: 'acme',
    schemaName: 't_acme',
    name: 'Acme',
    status: 'active',
    plan: 'free',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z'
  },
  {
    id: 'id-2',
    slug: 'globex',
    schemaName: 't_globex',
    name: 'Globex',
    status: 'suspended',
    plan: 'starter',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-05T10:00:00.000Z'
  }
];

describe('App (unauthenticated)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideAuth({
          config: {
            authority: 'http://localhost:8082/realms/retail',
            clientId: 'retail-web',
            redirectUrl: 'http://localhost:8082/',
            postLogoutRedirectUri: 'http://localhost:8082/',
            responseType: 'code'
          }
        })
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the sign-in card when unauthenticated', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.access-card h2')?.textContent).toContain('Sign in to your workspace');
    expect(compiled.querySelector('.access-card button')?.textContent).toContain('Sign in');
    expect(compiled.querySelector('a[href="/signup"]')?.textContent).toContain('Create your workspace');
  });

  it('should render the signup form at /signup', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/signup');
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.join-panel h1')?.textContent).toContain('Create your workspace');
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain('Create workspace');
  });
});

describe('App (signed in as platform admin)', () => {
  /**
   * The signed-in shell renders the sidebar + routed outlet; the fake API
   * answers synchronously (see tenants.spec.ts for why HttpTestingController
   * deadlocks with httpResource in zoneless tests).
   */
  beforeEach(() => {
    const fakeApi: HttpInterceptorFn = (req) => {
      if (req.url === '/api/me') {
        return of(
          new HttpResponse({
            status: 200,
            body: { sub: 'platform-admin', roles: ['platform-admin'], tenantSlug: null }
          })
        );
      }
      if (req.url === '/api/tenants/current') {
        // Platform admins are deliberately not linked to a tenant.
        return throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }));
      }
      if (req.url === '/api/platform/tenants') {
        return of(new HttpResponse({ status: 200, body: { tenants } }));
      }
      if (req.url === '/api/platform/tenants/acme') {
        return of(
          new HttpResponse({
            status: 200,
            body: { tenant: tenants[0], recentAuditEntries: [] }
          })
        );
      }
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    };

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([fakeApi])),
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: OidcSecurityService,
          useValue: {
            isAuthenticated$: of({ isAuthenticated: true }),
            getAccessToken: () => of('access-token'),
            checkAuth: () => of(null)
          }
        }
      ]
    });
  });

  it('renders the sidebar shell with role-aware navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/app/home');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-sidebar')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Home');
    expect(fixture.nativeElement.textContent).toContain('All tenants');
    expect(fixture.nativeElement.textContent).toContain('Your account');
  });

  it('navigates to the tenants page and lists tenants (regression: outlet inside the signed-in shell)', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    await TestBed.inject(Router).navigateByUrl('/app/platform/tenants');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('All tenants');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('renders the tenant detail page with the route param bound to the input', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/app/platform/tenants/acme');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Acme');
    expect(fixture.nativeElement.textContent).toContain('Recent audit entries');
  });
});

describe('App (post-login redirect)', () => {
  let authState: BehaviorSubject<{ isAuthenticated: boolean }>;

  const fakeApi: HttpInterceptorFn = (req) => {
    if (req.url === '/api/me') {
      return of(
        new HttpResponse({
          status: 200,
          body: { sub: 'platform-admin', roles: ['platform-admin'], tenantSlug: null }
        })
      );
    }
    if (req.url === '/api/tenants/current') {
      // Platform admins are deliberately not linked to a tenant.
      return throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }));
    }
    if (req.url === '/api/platform/tenants') {
      return of(new HttpResponse({ status: 200, body: { tenants } }));
    }
    return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
  };

  beforeEach(() => {
    authState = new BehaviorSubject<{ isAuthenticated: boolean }>({ isAuthenticated: false });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([fakeApi])),
        provideRouter(routes),
        {
          provide: OidcSecurityService,
          useValue: {
            isAuthenticated$: authState,
            getAccessToken: () => of('access-token'),
            checkAuth: () => of(null)
          }
        }
      ]
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('sends the user to /app/home when authentication completes on the sign-in page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.access-card h2')?.textContent).toContain(
      'Sign in to your workspace'
    );

    // The OIDC callback completes while the user is still on the sign-in page
    // (this is the flow that used to strand the user on "/").
    authState.next({ isAuthenticated: true });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(router.url).toBe('/app/home');
    expect(fixture.nativeElement.querySelector('app-sidebar')).not.toBeNull();
  });

  it('restores the originally requested app URL after the login round trip', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();

    sessionStorage.setItem(RETURN_URL_KEY, '/app/platform/tenants');
    authState.next({ isAuthenticated: true });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(router.url).toBe('/app/platform/tenants');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('All tenants');
  });
});
describe('App (sign-in splash while the auth check is pending)', () => {
  const authState = new BehaviorSubject<{ isAuthenticated: boolean }>({ isAuthenticated: false });
  // Never emits: simulates the OIDC session check still being in flight
  // (e.g. right after the Keycloak callback lands on "/").
  const authCheck$ = new Subject<null>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideRouter(routes),
        {
          provide: OidcSecurityService,
          useValue: {
            isAuthenticated$: authState,
            getAccessToken: () => of('access-token'),
            checkAuth: () => authCheck$
          }
        }
      ]
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('shows a splash instead of the sign-in card until the auth check resolves', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();

    // No card flash: while the check is in flight the user sees a neutral
    // "Signing you in…" state; once it resolves, the effect routes into
    // /app (or the sign-in card appears if there is no session).
    expect(fixture.nativeElement.textContent).toContain('Signing you in…');
    expect(fixture.nativeElement.textContent).not.toContain('Sign in to your workspace');
  });

  it('waits for callback completion before navigating after authentication is published', async () => {
    authState.next({ isAuthenticated: false });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();

    authState.next({ isAuthenticated: true });
    await fixture.whenStable();
    expect(router.url).toBe('/');

    authCheck$.next(null);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect(router.url).toBe('/app/home');
    expect(fixture.nativeElement.querySelector('app-sidebar')).not.toBeNull();
  });
});



