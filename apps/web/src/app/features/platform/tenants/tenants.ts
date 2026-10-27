import { Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n';
import { formatAppDateTime } from '../../../core/i18n/date-format';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import type { TenantSummary } from '@retail/shared-types';

@Component({
  selector: 'app-tenants',
  imports: [RouterLink, StatusBadge],
  templateUrl: './tenants.html',
  styleUrl: './tenants.scss'
})
export class Tenants {
  /** Registry read, fetched reactively (httpResource skill). */
  readonly tenants = httpResource<{ tenants: TenantSummary[] }>(() => '/api/platform/tenants');

  protected readonly i18n = inject(I18nService);

  readonly tenantsList = computed(() => {
    // hasValue() is false in the error state, where value() would throw.
    return this.tenants.hasValue() ? this.tenants.value().tenants : [];
  });

  // Reads the i18n language signal, so it re-renders on language switch.
  readonly errorMessage = computed(() =>
    this.tenants.statusCode() === 403
      ? this.i18n.t('tenants.error.forbidden')
      : this.i18n.t('tenants.error.generic')
  );

  refresh(): void {
    this.tenants.reload();
  }

  protected dateTime(value: string): string { return formatAppDateTime(value); }
}
