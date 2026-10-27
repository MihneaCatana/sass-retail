import { Component, inject, input, output, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import type { Product, ProductPage } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';

@Component({selector:'app-product-picker',imports:[MatButtonModule,MatInputModule,MatFormFieldModule],styleUrl:'./sales-shared.scss',templateUrl:'./product-picker.html'})
export class ProductPicker {
 readonly disabled=input(false);
 protected readonly i18n=inject(I18nService); readonly selected=output<Product>();
 protected readonly search=signal('');protected readonly applied=signal('');protected readonly page=signal(1);
 protected readonly products=httpResource<ProductPage>(()=>`/api/products?q=${encodeURIComponent(this.applied())}&page=${this.page()}&pageSize=20`);
 protected text(e:Event){return (e.target as HTMLInputElement).value;}
 protected find(e:Event){e.preventDefault();this.page.set(1);this.applied.set(this.search());}
}
