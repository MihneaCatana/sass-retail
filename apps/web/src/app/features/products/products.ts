import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';
import { DataTable, DataTableCell } from '../../shared/components/data-table/data-table';
import type { DataTableColumn } from '../../shared/components/data-table/data-table';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDateTime } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import type { ProductPage } from '@retail/shared-types';
import { inventoryError } from './inventory-errors';
import type { ProductType } from '@retail/shared-types';
import type { TranslationKey } from '../../core/i18n/translations';

const PAGE_SIZE = 10;

/** Tenant-scoped product catalog (TICKET-101): list with search + pagination. */
@Component({
  selector: 'app-products',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    DataTable,
    DataTableCell,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule
  ],
  templateUrl: './products.html',
  styleUrl: './products.scss',
  providers: [
    {
      // Paginator labels are captured at page load with the active language
      // (same trade-off as the form validation messages).
      provide: MatPaginatorIntl,
      useFactory: (i18n: I18nService): MatPaginatorIntl => {
        const intl = new MatPaginatorIntl();
        effect(() => {
          intl.previousPageLabel = i18n.t('common.previous');
          intl.nextPageLabel = i18n.t('common.next');
          intl.changes.next();
        });
        intl.getRangeLabel = (page, pageSize, length) => {
          const pages = Math.max(1, Math.ceil(length / pageSize));
          return i18n.t('products.pager', { page: page + 1, pages, count: length });
        };
        return intl;
      },
      deps: [I18nService]
    }
  ]
})
export class Products {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
  /** The typed search term; only the applied term triggers a request. */
  protected readonly search = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly page = signal(1);
  protected readonly sort = signal<Sort>({ active: '', direction: '' });

  protected onSort(sort: Sort): void {
    this.page.set(1);
    this.sort.set(sort);
  }

  protected readonly productsResource = httpResource<ProductPage>(() =>
    `/api/products?page=${this.page()}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(this.appliedSearch())}`
      + (this.sort().direction ? `&sort=${encodeURIComponent(this.sort().active)}&direction=${this.sort().direction}` : '')
  );

  protected readonly products = computed(() =>
    this.productsResource.hasValue() ? this.productsResource.value().products : []
  );
  protected readonly total = computed(() =>
    this.productsResource.hasValue() ? this.productsResource.value().total : 0
  );

  protected readonly pageSize = PAGE_SIZE;

  /** Column configuration; the actions column is only offered to tenant admins. */
  protected readonly columns = computed<DataTableColumn[]>(() => {
    const columns: DataTableColumn[] = [
      { key: 'name', label: this.i18n.t('products.colName'), width: '13rem', minWidth: '13rem' },
      { key: 'type', label: this.i18n.t('inventory.type'), minWidth: '8rem' },
      { key: 'sku', label: this.i18n.t('products.colSku'), width: '8rem', nowrap: true },
      { key: 'price', label: this.i18n.t('products.colPrice') + ' (RON)', align: 'right', width: '6rem' },
      { key: 'stock', label: this.i18n.t('products.colStock'), align: 'right', width: '6rem' },
      { key: 'updated', label: this.i18n.t('products.colUpdated'), width: '11rem', nowrap: true }
    ];
    if (this.identity.isTenantAdmin() && this.identity.hasModule('sales-insights')) {
      columns.splice(4, 0, { key: 'cost', label: this.i18n.t('products.colLatestCost') + ' (RON)', align: 'right', width: '8rem' });
    }
    if (this.identity.isTenantAdmin()) {
      columns.push({ key: 'actions', label: this.i18n.t('products.colActions'), align: 'right', width: '15rem', nowrap: true });
    }
    return columns.map((column) => ({ ...column, sortable: column.key !== 'actions' }));
  });

  protected readonly deleting = signal(false);
  protected readonly actionError = signal('');
  protected typeKey(type: ProductType): TranslationKey { return `productType.${type}`; }
  protected unitLabel(unit: string): string { return unit === 'unit' ? this.i18n.t('unit.unit') : unit; }
  protected dateTime(value: string): string { return formatAppDateTime(value); }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected applySearch(event: Event): void {
    event.preventDefault();
    this.appliedSearch.set(this.search().trim());
    this.page.set(1);
  }

  /** MatPaginator is wired to the server-side pagination via the page signal. */
  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
  }

  protected async remove(id: string): Promise<void> {
    if (this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.actionError.set('');
    try {
      await firstValueFrom(this.http.delete(`/api/products/${id}`));
      this.productsResource.reload();
    } catch (error) {
      this.actionError.set(inventoryError(error, this.i18n));
    } finally {
      this.deleting.set(false);
    }
  }
}
