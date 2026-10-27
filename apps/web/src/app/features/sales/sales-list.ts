import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DataTable, DataTableCell } from '../../shared/components/data-table/data-table';
import type { DataTableColumn } from '../../shared/components/data-table/data-table';
import type { SalePage, SaleStatus, UnitType } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDateTime } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import type { TranslationKey } from '../../core/i18n/translations';

@Component({ selector: 'app-sales-list', imports: [RouterLink, DecimalPipe, MatButtonModule, MatInputModule, MatFormFieldModule, DataTable, DataTableCell], templateUrl: './sales-list.html', styleUrl: './sales-shared.scss' })
export class SalesList {
  private readonly query=toSignal(inject(ActivatedRoute).queryParamMap);
  protected productFilter(){return this.query()?.get('productId')??'';}
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
  protected readonly page = signal(1);
  protected readonly filters = signal({ q: '', status: '', from: '', to: '' });
  protected readonly applied = signal(this.filters());
  protected readonly statuses: SaleStatus[] = ['draft', 'completed', 'partially_returned', 'returned', 'cancelled', 'discarded'];
  protected readonly columns = computed<DataTableColumn[]>(() => [
    { key: 'reference', label: this.i18n.t('sales.reference'), width: '10rem', nowrap: true },
    { key: 'lines', label: this.i18n.t('sales.productsAndQuantities'), minWidth: '15rem' },
    { key: 'status', label: this.i18n.t('sales.status'), width: '11rem', nowrap: true },
    { key: 'createdAt', label: this.i18n.t('sales.date'), width: '14rem', nowrap: true },
    { key: 'totalCents', label: this.i18n.t('sales.total'), align: 'right', width: '8rem', nowrap: true },
    { key: 'returnedCents', label: this.i18n.t('sales.returned'), align: 'right', width: '8rem', nowrap: true }
  ]);
  protected readonly sales = httpResource<SalePage>(() => {
    const params = new URLSearchParams({ page: String(this.page()), pageSize: '20', ...this.applied() });
    if(this.productFilter())params.set('productId',this.productFilter());
    return `/api/sales?${params}`;
  });
  protected field(key: keyof ReturnType<typeof this.filters>, event: Event): void { this.filters.update(f => ({ ...f, [key]: (event.target as HTMLInputElement).value })); }
  protected apply(event: Event): void { event.preventDefault(); this.page.set(1); this.applied.set({ ...this.filters() }); }
  protected statusKey(status: SaleStatus): TranslationKey { return `sales.status.${status}`; }
  protected date(value: string): string { return formatAppDateTime(value); }
  protected unit(unit: UnitType): string { return unit === 'unit' ? this.i18n.t('unit.unit') : unit; }
}
