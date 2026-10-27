import { Component, inject, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { InventoryData } from './inventory-data';
import { ProductStock } from './product-stock';
import { ProductCosts } from '../sales/product-costs';
import { I18nService } from '../../core/i18n/i18n';
import { IdentityStore } from '../../core/identity/identity-store';
import type { ProductType } from '@retail/shared-types';
import type { TranslationKey } from '../../core/i18n/translations';

@Component({
  selector: 'app-product-detail',
  imports: [DecimalPipe, RouterLink, MatButtonModule, ProductStock, ProductCosts],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss'
})
export class ProductDetail {
  private readonly data = inject(InventoryData);
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
  readonly id = input.required<string>();
  protected readonly product = this.data.product(this.id);

  protected typeKey(type: ProductType): TranslationKey {
    return `productType.${type}`;
  }

  protected refresh(): void {
    this.product.reload();
  }
}
