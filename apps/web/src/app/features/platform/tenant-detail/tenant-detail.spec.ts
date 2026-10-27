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
import { TenantDetail } from './tenant-detail';
import type { TenantAuditEntry, TenantSummary } from '@retail/shared-types';

const tenant: TenantSummary = {
  id: 'id-1',
  slug: 'acme',
  schemaName: 't_acme',
  name: 'Acme',
  status: 'suspended',
  plan: 'free',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-05T10:00:00.000Z'
};

const auditEntries: TenantAuditEntry[] = [
  {
    occurredAt: '2026-03-01T12:00:00.000Z',
    actor: 'admin@retail.local',
    action: 'tenant.created',
    details: { slug: 'acme', name: 'Acme' }
  }
];

/**
 * The fake API is an interceptor answering synchronously instead of
 * `HttpTestingController`: a mocked request in flight keeps a pending task
 * alive, the app never becomes stable, and `whenStable()` deadlocks in
 * zoneless tests.
 */
function setup(respond: () => HttpResponse<unknown> | HttpErrorResponse): {
  fixture: ReturnType<typeof TestBed.createComponent<TenantDetail>>;
  requests: HttpRequest<unknown>[];
} {
  const requests: HttpRequest<unknown>[] = [];
  const fakeApi: HttpInterceptorFn = (req) => {
    requests.push(req);
    const response = respond();
    return response instanceof HttpErrorResponse ? throwError(() => response) : of(response);
  };

  TestBed.configureTestingModule({
    imports: [TenantDetail],
    providers: [provideHttpClient(withInterceptors([fakeApi])), provideRouter([])]
  });

  return { fixture: TestBed.createComponent(TenantDetail), requests };
}

describe('TenantDetail', () => {
  it('shows registry facts and the audit trail for the requested slug', async () => {
    const { fixture, requests } = setup(() =>
      new HttpResponse({ status: 200, body: { tenant, recentAuditEntries: auditEntries } })
    );

    // Route params bind to the slug input via withComponentInputBinding;
    // in isolation tests the input is set directly.
    fixture.componentRef.setInput('slug', 'acme');
    await fixture.whenStable();

    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe('/api/platform/tenants/acme');

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Acme');
    expect(fixture.nativeElement.textContent).toContain('t_acme');
    // The badge renders the human-readable, localized status label
    // ('status.suspended' → "Suspended"), not the raw API enum value.
    expect(fixture.nativeElement.textContent).toContain('Suspended');
    expect(fixture.nativeElement.textContent).toContain('tenant.created');
  });

  it('shows a not-found message when the API rejects with 404', async () => {
    const { fixture } = setup(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' }));
    fixture.componentRef.setInput('slug', 'ghost');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Tenant not found.');
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });
});
