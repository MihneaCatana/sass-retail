import { Component, input } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import type { TenantDetail as TenantDetailDto } from '@retail/shared-types';

/** Platform-admin drill-down for one registry tenant: facts + audit trail. */
@Component({
  selector: 'app-tenant-detail',
  imports: [DatePipe, JsonPipe, RouterLink, StatusBadge],
  templateUrl: './tenant-detail.html',
  styleUrl: './tenant-detail.scss'
})
export class TenantDetail {
  /** Bound from the route parameter (withComponentInputBinding). */
  readonly slug = input.required<string>();

  readonly detail = httpResource<TenantDetailDto>(() =>
    this.slug() ? `/api/platform/tenants/${this.slug()}` : undefined
  );
}
