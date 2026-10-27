import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { SalesPerformance } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDate } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import { DataTable, DataTableCell } from '../../shared/components/data-table/data-table';
import type { DataTableColumn } from '../../shared/components/data-table/data-table';
import type { Sort, SortDirection } from '@angular/material/sort';
import type { UnitType } from '@retail/shared-types';

@Component({selector:'app-sales-performance',imports:[DecimalPipe,RouterLink,MatButtonModule,MatInputModule,MatFormFieldModule,DataTable,DataTableCell],styleUrl:'./sales-performance.scss',templateUrl:'./sales-performance.html'})
export class SalesPerformancePage{
 protected readonly sort = signal<{ active: string; direction: SortDirection }>({ active: 'netSalesCents', direction: 'desc' });
 protected readonly productColumns = computed<DataTableColumn[]>(() => [
  { key: 'product', label: this.i18n.t('sales.product'), minWidth: '14rem', sortable: true },
  { key: 'quantitySold', label: this.i18n.t('sales.sold'), align: 'right', nowrap: true, sortable: true },
  { key: 'quantityReturned', label: this.i18n.t('sales.returnQty'), align: 'right', nowrap: true, sortable: true },
  { key: 'netSalesCents', label: this.i18n.t('sales.net'), align: 'right', nowrap: true, sortable: true },
  { key: 'estimatedProfitCents', label: this.i18n.t('sales.profit'), align: 'right', nowrap: true, sortable: true },
  { key: 'marginPercent', label: this.i18n.t('sales.margin'), align: 'right', nowrap: true, sortable: true }
 ]);
 protected readonly trendColumns = computed<DataTableColumn[]>(() => [
  { key: 'date', label: this.i18n.t('sales.date'), minWidth: '10rem' },
  { key: 'grossSalesCents', label: this.i18n.t('sales.gross'), align: 'right', nowrap: true },
  { key: 'returnedCents', label: this.i18n.t('sales.returned'), align: 'right', nowrap: true },
  { key: 'netSalesCents', label: this.i18n.t('sales.net'), align: 'right', nowrap: true }
 ]);
 protected readonly ordered = computed(() => {
  const { active, direction } = this.sort();
  const sign = direction === 'asc' ? 1 : -1;
  return [...(this.data.value()?.products ?? [])].sort((a, b) => {
   const key = active === 'product' ? 'name' : active as keyof typeof a;
   const left = a[key];
   const right = b[key];
   const comparison = typeof left === 'string' && typeof right === 'string'
    ? left.localeCompare(right, this.i18n.lang())
    : Number(left ?? Number.NEGATIVE_INFINITY) - Number(right ?? Number.NEGATIVE_INFINITY);
   return comparison * sign;
  });
 });
 protected readonly i18n=inject(I18nService);protected readonly identity=inject(IdentityStore);protected readonly filters=signal({from:'',to:'',q:'',type:''});protected readonly applied=signal(this.filters());protected readonly data=httpResource<SalesPerformance>(()=>this.identity.isTenantAdmin()?`/api/sales/performance?${new URLSearchParams(this.applied())}`:undefined);
 protected field(key:'from'|'to'|'q'|'type',e:Event){this.filters.update(f=>({...f,[key]:(e.target as HTMLInputElement).value}));}
 protected apply(e:Event){e.preventDefault();this.applied.set({...this.filters()});}
 protected onSort(sort: Sort): void { if (sort.direction) this.sort.set({ active: sort.active, direction: sort.direction }); }
 protected unit(unit: UnitType): string { return unit === 'unit' ? this.i18n.t('unit.unit') : unit; }
 protected date(value: string): string { return formatAppDate(value); }
}
