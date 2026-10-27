import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductStock } from './product-stock';
import { IdentityStore } from '../../core/identity/identity-store';
import { I18nService } from '../../core/i18n/i18n';

function setup(service = false, failFirst = false, unitType = 'kg') {
  const posts: HttpRequest<unknown>[] = [];
  const fake: HttpInterceptorFn = (req) => {
    if (req.method === 'POST') {
      posts.push(req);
      return failFirst && posts.length === 1
        ? throwError(() => new HttpErrorResponse({ status: 0 }))
        : of(new HttpResponse({ body: { id: 'movement' } }));
    }
    return of(new HttpResponse({ body: req.url.includes('/movements') ? { movements: [], total: 0, page: 1, pageSize: 20 } : {
      id: 'p1', name: 'Test product', sku: 'TEST', stock: 1.5, unitType, productType: service ? 'service' : 'consumable'
    } }));
  };
  TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([fake])), provideRouter([]), { provide: IdentityStore, useValue: { isTenantAdmin: () => true } }] });
  const fixture = TestBed.createComponent(ProductStock);
  fixture.componentRef.setInput('id', 'p1');
  return { fixture, posts };
}

async function fill(fixture: ReturnType<typeof TestBed.createComponent<ProductStock>>, quantity: string) {
  await fixture.whenStable();
  const inputs = fixture.nativeElement.querySelectorAll('.movement-form input') as NodeListOf<HTMLInputElement>;
  inputs[0].value = quantity; inputs[0].dispatchEvent(new Event('input'));
  inputs[1].value = 'Counted stock'; inputs[1].dispatchEvent(new Event('input'));
  await fixture.whenStable();
}
async function save(fixture: ReturnType<typeof TestBed.createComponent<ProductStock>>) {
  fixture.nativeElement.querySelector('.movement-form').dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
}

describe('Product stock operations', () => {
  beforeEach(() => localStorage.removeItem('retail.lang'));
  afterEach(() => localStorage.removeItem('retail.lang'));

  it('translates an already visible validation error when language changes', async () => {
    const { fixture } = setup();
    await fill(fixture, '0.0001');
    await save(fixture);
    const i18n = TestBed.inject(I18nService);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(i18n.t('inventory.quantityError'));
    i18n.setLanguage('ro');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(i18n.t('inventory.quantityError'));
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).not.toContain('Enter a valid quantity');
  });

  it('translates a visible request error when language changes', async () => {
    const { fixture } = setup(false, true);
    await fill(fixture, '0.25');
    await save(fixture);
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('ro');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(i18n.t('inventory.error.generic'));
  });
  it('accepts a Romanian decimal comma without rounding and preserves the key on retry', async () => {
    const { fixture, posts } = setup(false, true);
    await fill(fixture, '0,250');
    await save(fixture);
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual(expect.objectContaining({ quantity: 0.25, reason: 'Counted stock', kind: 'receive' }));
    await save(fixture);
    expect(posts).toHaveLength(2);
    expect(posts[1].body).toEqual(posts[0].body);
    expect(fixture.nativeElement.textContent).toContain('Stock movement recorded.');
  });

  it('rejects excess precision before submitting a movement', async () => {
    const { fixture, posts } = setup();
    await fill(fixture, '0.0001');
    await save(fixture);
    expect(posts).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Enter a valid quantity');
  });

  it('rejects fractional pieces and excludes services from stock actions', async () => {
    const { fixture, posts } = setup(false, false, 'unit');
    await fill(fixture, '1.5'); await save(fixture);
    expect(posts).toHaveLength(0);
  });

  it('shows service history without a stock movement form', async () => {
    const { fixture } = setup(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.movement-form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Not stock-tracked');
  });
});
