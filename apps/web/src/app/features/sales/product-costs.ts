import { Component, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { httpResource } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PRICE_BASES, type CostVersion, type CostVersionInput, type Product, type PriceBasis } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDate } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import type { TranslationKey } from '../../core/i18n/translations';
import { SalesData } from './sales-data';
import { bucharestMidnight, moneyCents } from './sales-utils';
@Component({selector:'app-product-costs',imports:[DecimalPipe,RouterLink,MatButtonModule,MatInputModule,MatFormFieldModule],styleUrl:'./sales-shared.scss',templateUrl:'./product-costs.html'})
export class ProductCosts {
 readonly product=input.required<Product>();readonly embedded=input(false);
 protected readonly i18n=inject(I18nService);protected readonly identity=inject(IdentityStore);private readonly api=inject(SalesData);
 protected readonly costs=httpResource<CostVersion[]>(()=>this.identity.isTenantAdmin()?`/api/products/${this.product().id}/costs`:undefined);
 protected readonly amount=signal('');protected readonly effective=signal(new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Bucharest'}));protected readonly basis=signal<PriceBasis>('tax_exclusive');protected readonly source=signal<CostVersionInput['source']>('estimate');protected readonly note=signal('');protected readonly busy=signal(false);protected readonly saved=signal(false);protected readonly error=signal(false);protected readonly serverError=signal(false);protected readonly bases=PRICE_BASES;protected readonly sources:CostVersionInput['source'][]=['purchase','production','service','estimate'];
 protected text(e:Event){return (e.target as HTMLInputElement).value;}protected basisKey(b:PriceBasis):TranslationKey{return `sales.basis.${b}`;}protected sourceKey(s:CostVersionInput['source']):TranslationKey{return `sales.source.${s}`;}protected date(v:string){return formatAppDate(v);}
 protected async save(e:Event){e.preventDefault();const cents=moneyCents(this.amount());if(cents===undefined||!this.effective()) {this.error.set(true);return;}this.busy.set(true);this.error.set(false);this.serverError.set(false);this.saved.set(false);try{await this.api.cost(this.product().id,{unitCostCents:cents,effectiveAt:bucharestMidnight(this.effective()),priceBasis:this.basis(),source:this.source(),note:this.note()});this.costs.reload();this.saved.set(true);}catch{this.serverError.set(true);}finally{this.busy.set(false);}}
}
