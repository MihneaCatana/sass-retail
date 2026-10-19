import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, form, maxLength, min, minLength, pattern, required } from '@angular/forms/signals';
import type { Product } from '@retail/shared-types';

/** Create/edit view for one tenant-scoped product (TICKET-101). */
@Component({
  selector: 'app-product-edit',
  imports: [FormField, RouterLink],
  templateUrl: './product-edit.html',
  styleUrl: './product-edit.scss'
})
export class ProductEdit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Route param (withComponentInputBinding); undefined on /app/products/new. */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => !!this.id());

  /** Price is entered in major units and stored as cents on submit. */
  private readonly model = signal({ name: '', sku: '', price: 0, stock: 0 });

  protected readonly productForm = form(this.model, (s) => {
    required(s.name, { message: 'Name is required' });
    minLength(s.name, 1);
    maxLength(s.name, 120);
    required(s.sku, { message: 'SKU is required' });
    minLength(s.sku, 2, { message: 'SKU must be at least 2 characters' });
    maxLength(s.sku, 40);
    pattern(s.sku, /^[A-Za-z0-9-]+$/, { message: 'Letters, numbers and hyphens only.' });
    min(s.price, 0, { message: 'Price cannot be negative.' });
    min(s.stock, 0, { message: 'Stock cannot be negative.' });
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  private readonly existing = httpResource<Product>(() =>
    this.id() ? `/api/products/${this.id()}` : undefined
  );

  /** True while an existing product is being fetched in edit mode. */
  protected readonly loading = computed(
    () => this.isEdit() && !this.existing.hasValue() && !this.existing.error()
  );

  /** Fetch failure of the existing product (e.g. 404). */
  protected readonly loadError = signal('');

  constructor() {
    // Patch the model once the existing product arrives (edit mode only).
    effect(() => {
      if (this.existing.hasValue()) {
        const p = this.existing.value();
        this.model.set({ name: p.name, sku: p.sku, price: p.priceCents / 100, stock: p.stock });
      } else if (this.existing.error()) {
        this.loadError.set(
          this.existing.statusCode() === 404 ? 'Product not found.' : 'Could not load the product.'
        );
      }
    });
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting() || this.productForm().invalid()) {
      return;
    }
    this.submitting.set(true);
    this.error.set('');

    const value = this.model();
    const body = {
      name: value.name.trim(),
      sku: value.sku.trim(),
      priceCents: Math.round(value.price * 100),
      stock: Math.round(value.stock)
    };

    try {
      if (this.isEdit()) {
        await firstValueFrom(this.http.put<Product>(`/api/products/${this.id()}`, body));
      } else {
        await firstValueFrom(this.http.post<Product>('/api/products', body));
      }
      await this.router.navigateByUrl('/app/products');
    } catch (err) {
      this.error.set(
        (err as { error?: { error?: string } }).error?.error ??
          'Could not save the product. Please try again.'
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
