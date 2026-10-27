import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, disabled, form, maxLength, min, minLength, pattern, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { I18nService } from '../../core/i18n/i18n';
import { PRODUCT_TYPES, UNIT_TYPES, quantityToMillis } from '@retail/shared-types';
import { inventoryError } from './inventory-errors';
import type { Product, ProductType, UnitType } from '@retail/shared-types';
import type { TranslationKey } from '../../core/i18n/translations';

/** Create/edit view for one tenant-scoped product (TICKET-101). */
@Component({
  selector: 'app-product-edit',
  imports: [DecimalPipe, FormField, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './product-edit.html',
  styleUrl: './product-edit.scss'
})
export class ProductEdit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  /** Dropdown options for unit and product types. */
  protected readonly unitTypes = UNIT_TYPES;
  protected readonly productTypes = PRODUCT_TYPES;

  /** Builds the translation key for a unit type (typed as a literal union). */
  protected unitKey(unit: UnitType): TranslationKey {
    return `unit.${unit}`;
  }

  /** Builds the translation key for a product type (typed as a literal union). */
  protected productTypeKey(type: ProductType): TranslationKey {
    return `productType.${type}`;
  }

  /** Route param (withComponentInputBinding); undefined on /app/products/new. */
  readonly id = input<string>();

  protected readonly isEdit = computed(() => !!this.id());

  /** Price is entered in major units and stored as cents on submit. */
  private readonly model = signal({
    name: '',
    sku: '',
    price: 0,
    stock: 0,
    unitType: 'unit' as UnitType,
    productType: 'endproduct' as ProductType
  });
  protected readonly isService = computed(() => this.model().productType === 'service');
  protected readonly currentStock = computed(() => this.model().stock);
  protected readonly currentUnit = computed(() => this.model().unitType);

  // Validation messages are captured when the form is created, so they use the
  // language active at page load (the persisted choice is applied on startup).
  protected readonly productForm = form(this.model, (s) => {
    required(s.name, { message: this.i18n.t('productEdit.error.nameRequired') });
    minLength(s.name, 1);
    maxLength(s.name, 120);
    required(s.sku, { message: this.i18n.t('productEdit.error.skuRequired') });
    minLength(s.sku, 2, { message: this.i18n.t('productEdit.error.skuMinLength') });
    maxLength(s.sku, 40);
    pattern(s.sku, /^[A-Za-z0-9-]+$/, {
      message: this.i18n.t('productEdit.error.skuFormat')
    });
    min(s.price, 0, { message: this.i18n.t('productEdit.error.priceNegative') });
    min(s.stock, 0, { message: this.i18n.t('productEdit.error.stockNegative') });
    validate(s.stock, ({ value, valueOf }) => {
      if (valueOf(s.productType) === 'service') return undefined;
      return quantityToMillis(value()) === undefined || value() > 1_000_000 || (valueOf(s.unitType) === 'unit' && !Number.isInteger(value()))
        ? { kind: 'quantity', message: this.i18n.t('inventory.quantityError') } : undefined;
    });
    disabled(s.unitType, { when: () => this.isEdit() });
    disabled(s.productType, { when: () => this.isEdit() });
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
    effect(() => {
      if (!this.isEdit() && this.isService() && this.model().stock !== 0) {
        this.model.update((m) => ({ ...m, stock: 0 }));
      }
    });
    // Patch the model once the existing product arrives (edit mode only).
    effect(() => {
      if (this.existing.hasValue()) {
        const p = this.existing.value();
        this.model.set({
          name: p.name,
          sku: p.sku,
          price: p.priceCents / 100,
          stock: p.stock,
          unitType: p.unitType,
          productType: p.productType
        });
      } else if (this.existing.error()) {
        this.loadError.set(
          this.existing.statusCode() === 404
            ? this.i18n.t('productEdit.error.notFound')
            : this.i18n.t('productEdit.error.loadFailed')
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
      stock: value.productType === 'service' ? 0 : value.stock,
      unitType: value.productType === 'service' && !this.isEdit() ? 'unit' : value.unitType,
      productType: value.productType
    };

    try {
      if (this.isEdit()) {
        await firstValueFrom(this.http.put<Product>(`/api/products/${this.id()}`, body));
      } else {
        await firstValueFrom(this.http.post<Product>('/api/products', body));
      }
      await this.router.navigateByUrl('/app/products');
    } catch (err) {
      this.error.set(inventoryError(err, this.i18n));
    } finally {
      this.submitting.set(false);
    }
  }
}
