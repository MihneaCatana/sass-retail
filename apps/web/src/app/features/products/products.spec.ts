import { TestBed } from '@angular/core/testing';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Products } from './products';
import type { ProductPage } from '@retail/shared-types';

const page: ProductPage = {
  products: [
    {
      id: 'p1',
      name: 'Espresso beans 1kg',
      sku: 'ESP-1KG',
      priceCents: 1899,
      stock: 25,
      unitType: 'kg',
      productType: 'endproduct',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-05T10:00:00.000Z'
    }
  ],
  total: 1,
  page: 1,
  pageSize: 10
};

/**
 * The fake API answers synchronously; HttpTestingController deadlocks
 * httpResource in zoneless tests (see tenant-detail.spec.ts).
 */
function setup(
  respond: (req: HttpRequest<unknown>) => HttpResponse<unknown> | HttpErrorResponse | undefined
): {
  fixture: ReturnType<typeof TestBed.createComponent<Products>>;
  requests: HttpRequest<unknown>[];
} {
  const requests: HttpRequest<unknown>[] = [];
  const fakeApi: HttpInterceptorFn = (req) => {
    requests.push(req);
    const response = respond(req);
    if (!response) {
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    }
    return response instanceof HttpErrorResponse ? throwError(() => response) : of(response);
  };

  TestBed.configureTestingModule({
    imports: [Products],
    providers: [
      provideHttpClient(withInterceptors([fakeApi])),
      provideRouter([]),
      {
        provide: OidcSecurityService,
        useValue: {
          isAuthenticated$: new BehaviorSubject({ isAuthenticated: true }),
          getAccessToken: () => of('access-token'),
          checkAuth: () => of(null)
        }
      }
    ]
  });

  return { fixture: TestBed.createComponent(Products), requests };
}

describe('Products', () => {
  it('requests server-side ascending, descending, and default sorting from column headers', async () => {
    const { fixture, requests } = setup((req) => new HttpResponse({ body: req.url === '/api/me'
      ? { sub: 'test', roles: ['tenant-admin'] }
      : req.url === '/api/tenants/current' ? { name: 'Test', slug: 'test' } : page }));
    await fixture.whenStable();
    const clickHeader = () => (fixture.nativeElement.querySelector('thead th:first-child [role="button"]') as HTMLElement).click();
    clickHeader();
    await fixture.whenStable();
    expect(requests.at(-1)?.url).toContain('&sort=name&direction=asc');
    clickHeader();
    await fixture.whenStable();
    expect(requests.at(-1)?.url).toContain('&sort=name&direction=desc');
    clickHeader();
    await fixture.whenStable();
    expect(requests.at(-1)?.url).not.toContain('&sort=');
  });
  it('lists the tenant products with pagination info', async () => {
    const { fixture, requests } = setup((req) => {
      if (req.url === '/api/me') {
        return new HttpResponse({
          status: 200,
          body: { sub: 'admin', roles: ['tenant-admin'], tenantSlug: 'acme' }
        });
      }
      return req.url.includes('/api/products')
        ? new HttpResponse({ status: 200, body: page })
        : undefined;
    });

    await fixture.whenStable();

    const listRequest = requests.find((r) => r.url.startsWith('/api/products'));
    expect(listRequest?.url).toBe('/api/products?page=1&pageSize=10&q=');

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Espresso beans 1kg');
    expect(fixture.nativeElement.textContent).toContain('Page 1 of 1 — 1 product(s)');
  });

  it('applies the search term as a request parameter', async () => {
    const { fixture, requests } = setup((req) => {
      if (req.url === '/api/me') {
        return new HttpResponse({
          status: 200,
          body: { sub: 'admin', roles: ['tenant-admin'], tenantSlug: 'acme' }
        });
      }
      return req.url.includes('/api/products')
        ? new HttpResponse({ status: 200, body: page })
        : undefined;
    });
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'beans';
    input.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.search button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const searchRequest = requests.filter((r) => r.url.startsWith('/api/products')).at(-1);
    expect(searchRequest?.url).toContain('q=beans');
  });

  it('shows admin actions only for tenant admins', async () => {
    const { fixture } = setup((req) => {
      if (req.url === '/api/me') {
        return new HttpResponse({
          status: 200,
          body: { sub: 'user', roles: ['tenant-user'], tenantSlug: 'acme' }
        });
      }
      return req.url.includes('/api/products')
        ? new HttpResponse({ status: 200, body: page })
        : undefined;
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('New product');
    expect(fixture.nativeElement.querySelector('.row-actions')).toBeNull();
  });

  it('issues DELETE and reloads when a product is removed', async () => {
    const { fixture, requests } = setup((req) => {
      if (req.url === '/api/me') {
        return new HttpResponse({
          status: 200,
          body: { sub: 'admin', roles: ['tenant-admin'], tenantSlug: 'acme' }
        });
      }
      if (req.method === 'DELETE') {
        return new HttpResponse({ status: 204 });
      }
      return req.url.includes('/api/products')
        ? new HttpResponse({ status: 200, body: page })
        : undefined;
    });
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('.row-actions button') as HTMLButtonElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(requests.some((r) => r.method === 'DELETE' && r.url.endsWith('/p1'))).toBe(true);
  });
});
