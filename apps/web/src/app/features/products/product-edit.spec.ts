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
import { ProductEdit } from './product-edit';
import type { Product } from '@retail/shared-types';

const existing: Product = {
  id: 'p1',
  name: 'Espresso beans 1kg',
  sku: 'ESP-1KG',
  priceCents: 1899,
  stock: 25,
  unitType: 'kg',
  productType: 'endproduct',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-05T10:00:00.000Z'
};

function setup(
  respond: (req: HttpRequest<unknown>) => HttpResponse<unknown> | HttpErrorResponse | undefined
): {
  fixture: ReturnType<typeof TestBed.createComponent<ProductEdit>>;
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
    imports: [ProductEdit],
    providers: [
      provideHttpClient(withInterceptors([fakeApi])),
      // The component navigates back to /app/products after saving.
      provideRouter([{ path: 'app/products', redirectTo: '' }]),
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

  return { fixture: TestBed.createComponent(ProductEdit), requests };
}

describe('ProductEdit', () => {
  it('creates a product with the price converted to cents', async () => {
    const { fixture, requests } = setup((req) =>
      req.method === 'POST' && req.url === '/api/products'
        ? new HttpResponse({ status: 201, body: { ...existing, id: 'new-1' } })
        : undefined
    );
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('#product-name') as HTMLInputElement).value = 'Espresso beans 1kg';
    (fixture.nativeElement.querySelector('#product-name') as HTMLInputElement).dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('#product-sku') as HTMLInputElement).value = 'ESP-1KG';
    (fixture.nativeElement.querySelector('#product-sku') as HTMLInputElement).dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('#product-price') as HTMLInputElement).value = '18.99';
    (fixture.nativeElement.querySelector('#product-price') as HTMLInputElement).dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('#product-stock') as HTMLInputElement).value = '25';
    (fixture.nativeElement.querySelector('#product-stock') as HTMLInputElement).dispatchEvent(new Event('input'));

    // Let the zoneless validity signals propagate before submitting.
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    const post = requests.find((r) => r.method === 'POST');
    expect(post?.url).toBe('/api/products');
    expect(post?.body).toEqual({
      name: 'Espresso beans 1kg',
      sku: 'ESP-1KG',
      priceCents: 1899,
      stock: 25,
      unitType: 'unit',
      productType: 'endproduct'
    });
  });

  it('loads the existing product into the form in edit mode', async () => {
    const { fixture, requests } = setup((req) =>
      req.url === '/api/products/p1' ? new HttpResponse({ status: 200, body: existing }) : undefined
    );
    fixture.componentRef.setInput('id', 'p1');
    await fixture.whenStable();

    expect((fixture.nativeElement.querySelector('#product-name') as HTMLInputElement).value).toBe(
      'Espresso beans 1kg'
    );
    expect((fixture.nativeElement.querySelector('#product-price') as HTMLInputElement).value).toBe('18.99');

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Edit product');
    expect(requests.length).toBe(1);
  });

  it('surfaces a not-found message when the product does not exist', async () => {
    const { fixture } = setup(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    fixture.componentRef.setInput('id', 'ghost');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Product not found.');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
