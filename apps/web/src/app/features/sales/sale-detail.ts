import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { PRICE_BASES, saleLineGrossCents, parseQuantityText, quantityToMillis } from '@retail/shared-types';
import type { Product, ProductPage, Sale, SaleDraftInput, SaleLineInput, SaleStatus, PriceBasis, UnitType } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDateTime } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import type { TranslationKey } from '../../core/i18n/translations';
import { SalesData } from './sales-data';
import { moneyCents, quantity } from './sales-utils';

interface EditorLine { productId: string; name: string; sku: string; unitType: UnitType; productType: string; availableStock?: number; catalogPrice: number; quantity: string; price: string; discount: string; override: string; }

@Component({ selector: 'app-sale-detail', imports: [RouterLink, DecimalPipe, MatButtonModule, MatInputModule, MatFormFieldModule], templateUrl: './sale-detail.html', styleUrl: './sales-shared.scss' })
export class SaleDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
  private readonly data = inject(SalesData);
  private readonly router = inject(Router);
  readonly id = input<string>();
  protected readonly sale = httpResource<Sale>(() => this.id() ? `/api/sales/${this.id()}` : undefined);
  protected readonly lines = signal<EditorLine[]>([]);
  protected readonly basis = signal<PriceBasis>('unspecified');
  protected readonly bases = PRICE_BASES;
  protected readonly note = signal('');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<TranslationKey | null>(null);
  protected readonly saved = signal(false);
  protected readonly dirty = signal(false);
  protected readonly confirmation = signal<'complete' | 'discard' | 'cancel' | 'return' | null>(null);
  protected readonly reason = signal('');
  protected readonly restock = signal(false);
  protected readonly returnAmounts = signal<Record<string, string>>({});
  protected readonly returnRestock = signal<Record<string, boolean>>({});
  protected readonly search = signal('');
  protected readonly appliedSearch = signal('');
  protected readonly productPage = signal(1);
  protected readonly chooserOpen = signal(false);
  protected readonly products = httpResource<ProductPage>(() => this.chooserOpen()
    ? `/api/products?q=${encodeURIComponent(this.appliedSearch())}&page=${this.productPage()}&pageSize=10` : undefined);
  protected readonly editable = computed(() => this.identity.isTenantAdmin() && (!this.id() || (this.sale.hasValue() && this.sale.value().status === 'draft')));
  protected readonly correctable = computed(() => this.identity.isTenantAdmin() && this.sale.hasValue() && ['completed', 'partially_returned'].includes(this.sale.value().status));
  protected readonly preview = computed(() => this.lines().reduce((sum, line) => sum + this.lineTotal(line), 0));
  private revision = 0;
  private loadedRevision = '';
  private operation: { intent: string; key: string } | undefined;

  constructor() {
    effect(()=>{if(this.confirmation())setTimeout(()=>{const el=document.querySelector<HTMLElement>('.confirmation');el?.scrollIntoView({block:'center'});el?.focus();});});
    if (this.router.currentNavigation()?.extras.state?.['review']) this.confirmation.set('complete');
    effect(() => {
      if (!this.sale.hasValue()) return;
      const sale = this.sale.value();
      const revision = `${sale.id}:${sale.revision}`;
      if (revision === this.loadedRevision) return;
      this.loadedRevision = revision; this.revision = sale.revision;
      this.basis.set(sale.priceBasis); this.note.set(sale.note);
      this.lines.set(sale.lines.map(line => ({ productId: line.productId, name: line.name, sku: line.sku, unitType: line.unitType,
        productType: line.productType, availableStock: line.availableStock, catalogPrice: line.unitPriceCents, quantity: String(line.quantity), price: (line.unitPriceCents / 100).toFixed(2), discount: (line.discountCents / 100).toFixed(2), override: line.priceOverrideReason ?? '' })));
    });
  }
  protected actor(actor:string):string{return actor.startsWith('system:')?this.i18n.t('inventory.system'):actor===this.identity.me.value()?.sub?this.identity.userName():this.i18n.t('sales.member');}
  protected lineUnit(id:string):string{const line=this.sale.value()?.lines.find(l=>l.id===id);return line?this.unit(line.unitType):'';}
  protected lineName(id:string):string{return this.sale.value()?.lines.find(l=>l.id===id)?.name??'';}
  protected refresh(){if(!this.dirty()||window.confirm(this.i18n.t('sales.unsaved'))){this.loadedRevision='';this.dirty.set(false);this.sale.reload();}}
  canDeactivate():boolean{return !this.dirty()||window.confirm(this.i18n.t('sales.unsaved'));}
  protected statusKey(status: SaleStatus): TranslationKey { return `sales.status.${status}`; }
  protected basisKey(basis: PriceBasis): TranslationKey { return `sales.basis.${basis}`; }
  protected unit(unit: UnitType): string { return unit === 'unit' ? this.i18n.t('unit.unit') : unit; }
  protected date(value: string): string { return formatAppDateTime(value); }
  protected text(event: Event): string { return (event.target as HTMLInputElement).value; }
  protected changeBasis(event: Event): void { this.basis.set(this.text(event) as PriceBasis); this.saved.set(false);this.dirty.set(true);this.confirmation.set(null); }
  protected changeLine(index: number, key: 'quantity' | 'price' | 'discount' | 'override', event: Event): void {
    this.lines.update(lines => lines.map((line, i) => i === index ? { ...line, [key]: this.text(event) } : line));
    this.saved.set(false);this.dirty.set(true); this.confirmation.set(null);
  }
  protected find(event: Event): void { event.preventDefault(); this.productPage.set(1); this.appliedSearch.set(this.search()); this.chooserOpen.set(true); }
  protected add(product: Product): void {
    const found = this.lines().findIndex(line => line.productId === product.id);
    if (found >= 0) this.lines.update(lines => lines.map((line, i) => i === found ? { ...line, quantity: String((parseQuantityText(line.quantity) ?? 0) + 1) } : line));
    else this.lines.update(lines => [...lines, { productId: product.id, name: product.name, sku: product.sku, unitType: product.unitType, productType: product.productType,
      availableStock: product.stock, catalogPrice: product.priceCents, quantity: '1', price: (product.priceCents / 100).toFixed(2), discount: '0', override: '' }]);
    this.saved.set(false);this.dirty.set(true); this.confirmation.set(null);
  }
  protected remove(index: number): void { this.lines.update(lines => lines.filter((_, i) => i !== index)); this.saved.set(false);this.dirty.set(true); this.confirmation.set(null); }
  protected lineTotal(line: EditorLine): number {
    const q = quantity(line.quantity), price = moneyCents(line.price), discount = moneyCents(line.discount);
    return q !== undefined && price !== undefined && discount !== undefined ? Math.max(0, saleLineGrossCents(q, price) - discount) : 0;
  }
  protected stockAfterSale(line: EditorLine): number | null {
    const sold = quantity(line.quantity);
    const beforeMillis = line.availableStock === undefined ? undefined : quantityToMillis(line.availableStock);
    const soldMillis = sold === undefined ? undefined : quantityToMillis(sold);
    return beforeMillis !== undefined && soldMillis !== undefined ? (beforeMillis - soldMillis) / 1000 : null;
  }
  private input(): SaleDraftInput | undefined {
    const lines: SaleLineInput[] = [];
    for (const line of this.lines()) {
      const q = quantity(line.quantity), price = moneyCents(line.price), discount = moneyCents(line.discount);
      if (q === undefined || price === undefined || discount === undefined || (line.unitType === 'unit' && !Number.isInteger(q))
        || discount > saleLineGrossCents(q, price) || ((price === 0 || price !== line.catalogPrice) && !line.override.trim())) return undefined;
      lines.push({ productId: line.productId, quantity: q, unitPriceCents: price, discountCents: discount, priceOverrideReason: line.override.trim() });
    }
    return lines.length ? { lines, priceBasis: this.basis(), note: this.note().trim(), ...(this.id() ? { revision: this.revision } : {}) } : undefined;
  }
  protected async save(review = false): Promise<void> {
    if (!this.editable() || this.busy()) return;
    const body = this.input();
    if (!body) { this.errorKey.set('sales.error.invalid'); return; }
    await this.run(async () => {
      const sale = await this.data.draft(body, this.id());
      this.revision = sale.revision; this.saved.set(true);this.dirty.set(false);
      if (!this.id()) await this.router.navigate(['/app/sales', sale.id], { state: { review } });
      else { this.sale.reload(); this.confirmation.set(review ? 'complete' : null); }
    });
  }
  protected open(action: 'complete' | 'discard' | 'cancel' | 'return'): void {
    this.confirmation.set(action); this.reason.set(''); this.restock.set(false); this.returnAmounts.set({}); this.returnRestock.set({}); this.errorKey.set(null);
  }
  private key(intent: string): string { if (this.operation?.intent !== intent) this.operation = { intent, key: crypto.randomUUID() }; return this.operation.key; }
  protected async confirm(): Promise<void> {
    if (!this.id() || !this.identity.isTenantAdmin() || this.busy()) return;
    const action = this.confirmation();
    if ((action === 'cancel' || action === 'return') && !this.reason().trim()) { this.errorKey.set('sales.error.return'); return; }
    await this.run(async () => {
      if (action === 'complete') await this.data.complete(this.id()!, this.revision, this.key(`complete:${this.id()}:${this.revision}`));
      else if (action === 'discard') await this.data.discard(this.id()!, this.revision);
      else if (action === 'cancel') {
        const reason = this.reason().trim(), restock = this.restock();
        await this.data.cancel(this.id()!, reason, restock, this.key(JSON.stringify({ action, reason, restock })));
      } else if (action === 'return' && this.sale.hasValue()) {
        const lines = [];
        for (const line of this.sale.value().lines) {
          const text = this.returnAmounts()[line.id]?.trim();
          if (!text || text === '0') continue;
          const q = quantity(text);
          if (q === undefined || quantityToMillis(q)! > quantityToMillis(line.quantity)! - quantityToMillis(line.returnedQuantity)! || (line.unitType === 'unit' && !Number.isInteger(q))) { this.errorKey.set('sales.error.return'); return; }
          lines.push({ saleLineId: line.id, quantity: q, restock: line.productType !== 'service' && !!this.returnRestock()[line.id] });
        }
        if (!lines.length) { this.errorKey.set('sales.error.return'); return; }
        const body = { lines, reason: this.reason().trim() };
        await this.data.returns(this.id()!, { ...body, idempotencyKey: this.key(JSON.stringify(body)) });
      } else return;
      this.operation = undefined; this.confirmation.set(null); this.sale.reload(); this.saved.set(false);
    });
  }
  protected returnQuantity(id: string, event: Event): void { this.returnAmounts.update(v => ({ ...v, [id]: this.text(event) })); }
  protected returnStock(id: string, event: Event): void { this.returnRestock.update(v => ({ ...v, [id]: (event.target as HTMLInputElement).checked })); }
  protected checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true); this.errorKey.set(null);
    try { await action(); }
    catch (error) {
      const code = (error as { error?: { code?: string }; status?: number })?.error?.code ?? '';
      this.errorKey.set(/STOCK/.test(code) ? 'sales.error.stock' : /REVISION/.test(code) ? 'sales.error.revision'
        : (error as {status?: number}).status === 403 ? 'sales.error.permission' : /CONFLICT|STATE|COMPLETED|RETURN/.test(code) ? 'sales.error.conflict' : 'sales.error.generic');
    } finally { this.busy.set(false); }
  }
}
