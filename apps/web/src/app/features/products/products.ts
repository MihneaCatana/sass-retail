import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IdentityStore } from '../../core/identity/identity-store';
import type { ProductPage } from '@retail/shared-types';

const PAGE_SIZE = 10;

/** Tenant-scoped product catalog (TICKET-101): list with search + pagination. */
@Component({
  selector: 'app-products',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './products.html',
  styleUrl: './products.scss'
})
export class Products {
  private readonly http = inject(HttpClient);
  protected readonly identity = inject(IdentityStore);

  /** The typed search term; only the applied term triggers a request. */
  protected readonly search = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly page = signal(1);

  protected readonly productsResource = httpResource<ProductPage>(() =>
    `/api/products?page=${this.page()}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(this.appliedSearch())}`
  );

  protected readonly products = computed(() =>
    this.productsResource.hasValue() ? this.productsResource.value().products : []
  );
  protected readonly total = computed(() =>
    this.productsResource.hasValue() ? this.productsResource.value().total : 0
  );
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly deleting = signal(false);
  protected readonly actionError = signal('');

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected applySearch(event: Event): void {
    event.preventDefault();
    this.appliedSearch.set(this.search().trim());
    this.page.set(1);
  }

  protected nextPage(): void {
    if (this.page() < this.pageCount()) {
      this.page.update((p) => p + 1);
    }
  }

  protected prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
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
    } catch {
      this.actionError.set('Could not delete the product. Please try again.');
    } finally {
      this.deleting.set(false);
    }
  }
}
