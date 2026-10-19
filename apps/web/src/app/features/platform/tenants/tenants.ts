import { Component, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import type { TenantSummary } from '@retail/shared-types';

@Component({
  selector: 'app-tenants',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss'
})
export class Tenants {
  /** Registry read, fetched reactively (httpResource skill). */
  readonly tenants = httpResource<{ tenants: TenantSummary[] }>(() => '/api/platform/tenants');

  readonly tenantsList = computed(() => {
    // hasValue() is false in the error state, where value() would throw.
    return this.tenants.hasValue() ? this.tenants.value().tenants : [];
  });

  readonly errorMessage = computed(() =>
    this.tenants.statusCode() === 403
      ? 'Your account does not have the platform-admin role.'
      : 'Could not load the tenant registry. Please try again.'
  );

  refresh(): void {
    this.tenants.reload();
  }
}
