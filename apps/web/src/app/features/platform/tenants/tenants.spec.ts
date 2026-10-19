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
import { of, throwError } from 'rxjs';
import { Tenants } from './tenants';
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

type FakeResponse = HttpResponse<unknown> | HttpErrorResponse;

/**
 * Zoneless Act/Wait/Assert: state changes schedule updates asynchronously, so
 * tests `await fixture.whenStable()` and never call `fixture.detectChanges()`.
 *
 * The fake API is an interceptor answering synchronously instead of
 * `HttpTestingController`: a mocked request in flight keeps a pending task
 * alive, the app never becomes stable, and `whenStable()` deadlocks.
 */
function setup(respond: () => FakeResponse): {
  fixture: ReturnType<typeof TestBed.createComponent<Tenants>>;
  requests: HttpRequest<unknown>[];
} {
  const requests: HttpRequest<unknown>[] = [];
  const fakeApi: HttpInterceptorFn = (req) => {
    requests.push(req);
    const response = respond();
    return response instanceof HttpErrorResponse ? throwError(() => response) : of(response);
  };

  TestBed.configureTestingModule({
    imports: [Tenants],
    providers: [provideHttpClient(withInterceptors([fakeApi])), provideRouter([])]
  });

  return { fixture: TestBed.createComponent(Tenants), requests };
}

describe('Tenants', () => {
  it('lists every tenant from the platform endpoint', async () => {
    const { fixture, requests } = setup(() => new HttpResponse({ status: 200, body: { tenants } }));

    await fixture.whenStable();

    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('/api/platform/tenants');

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Acme');
    expect(fixture.nativeElement.textContent).toContain('Globex');
    expect(fixture.nativeElement.textContent).toContain('2 tenant(s)');
  });

  it('shows a role error when the API rejects with 403', async () => {
    const { fixture } = setup(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }));

    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('platform-admin');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('refresh() refetches the registry', async () => {
    let calls = 0;
    const { fixture, requests } = setup(() => {
      calls += 1;
      return calls === 1
        ? new HttpResponse({ status: 200, body: { tenants: [] } })
        : new HttpResponse({ status: 200, body: { tenants } });
    });

    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No tenants have been created yet.');

    // ACT: click Refresh (reload()).
    (fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    // ASSERT: a second request was made and the table now renders.
    expect(requests.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
  });
});
