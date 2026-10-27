import { Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { parseQuantityText, type MovementKind, type StockMovement, type StockMovementInput } from '@retail/shared-types';
import { I18nService } from '../../core/i18n/i18n';
import { formatAppDateTime } from '../../core/i18n/date-format';
import { IdentityStore } from '../../core/identity/identity-store';
import type { TranslationKey } from '../../core/i18n/translations';
import { InventoryData } from './inventory-data';
import { inventoryErrorKey } from './inventory-errors';

@Component({
  selector: 'app-product-stock',
  imports: [RouterLink, DecimalPipe, FormField, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './product-stock.html',
  styleUrl: './product-stock.scss'
})
export class ProductStock {
  private readonly data = inject(InventoryData);
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
  readonly id = input.required<string>();
  readonly embedded = input(false);
  protected readonly page = signal(1);
  protected readonly product = this.data.product(this.id);
  protected readonly history = this.data.history(this.id, this.page);
  protected readonly kinds = ['receive', 'consume', 'waste', 'adjust'] as const;
  protected readonly model = signal({ kind: 'receive' as StockMovementInput['kind'], quantity: '', reason: '' });
  protected readonly movementForm = form(this.model, (s) => {
    required(s.quantity);
    required(s.reason);
    maxLength(s.reason, 500);
  });
  protected readonly reversing = signal('');
  protected readonly reverseModel = signal({ reason: '' });
  protected readonly reverseForm = form(this.reverseModel, (s) => { required(s.reason); maxLength(s.reason, 500); });
  protected readonly busy = signal(false);
  private readonly errorKey = signal<TranslationKey | null>(null);
  protected readonly error = computed(() => {
    const key = this.errorKey();
    return key ? this.i18n.t(key) : '';
  });
  protected readonly success = signal(false);
  protected readonly canNext = computed(() => this.history.hasValue() && this.page() * 20 < this.history.value().total);
  private attempt: { fingerprint: string; key: string } | undefined;
  protected kindKey(kind: MovementKind): TranslationKey { return kind === 'opening' ? 'inventory.opening' : kind === 'reversal' ? 'inventory.reverse' : `inventory.${kind}`; }
  protected unitLabel(unit: string): string { return unit === 'unit' ? this.i18n.t('unit.unit') : unit; }
  protected canReverse(m: StockMovement): boolean {
    return this.identity.isTenantAdmin() && !m.saleId && !m.reversed && m.kind !== 'opening' && m.kind !== 'reversal' && !m.actor.startsWith('system:');
  }
  protected reason(m: StockMovement): string {
    if (m.kind === 'opening') return this.i18n.t('inventory.openingReason');
    return m.actor.startsWith('system:migration') ? this.i18n.t('inventory.legacyReason') : m.reason;
  }
  private key(fingerprint: string): string {
    if (this.attempt?.fingerprint !== fingerprint) this.attempt = { fingerprint, key: crypto.randomUUID() };
    return this.attempt.key;
  }
  protected save(event: Event): void {
    event.preventDefault();
    if (this.busy() || !this.product.hasValue()) return;
    this.success.set(false);
    submit(this.movementForm, async () => {
      const product = this.product.value();
      if (!product) return;
      const value = this.model();
      const quantity = parseQuantityText(value.quantity);
      if (quantity === undefined || quantity === 0 || Math.abs(quantity) > 1_000_000 || (value.kind !== 'adjust' && quantity < 0)
        || (product.unitType === 'unit' && !Number.isInteger(quantity))) {
        this.errorKey.set('inventory.quantityError'); return;
      }
      const body = { kind: value.kind, quantity, reason: value.reason.trim() };
      await this.mutate(() => this.data.move(this.id(), { ...body, idempotencyKey: this.key(JSON.stringify({ id: this.id(), ...body })) }));
    });
  }
  protected startReverse(id: string): void { this.reversing.set(id); this.reverseModel.set({ reason: '' }); this.errorKey.set(null); }
  protected reverse(event: Event): void {
    event.preventDefault();
    if (this.busy()) return;
    submit(this.reverseForm, async () => {
      const reason = this.reverseModel().reason.trim();
      await this.mutate(() => this.data.reverse(this.id(), this.reversing(), reason, this.key(JSON.stringify({ id: this.id(), reversal: this.reversing(), reason }))));
    });
  }
  private async mutate(action: () => Promise<StockMovement>): Promise<void> {
    this.busy.set(true); this.errorKey.set(null); this.success.set(false);
    try {
      await action();
      this.attempt = undefined; this.success.set(true); this.reversing.set('');
      this.model.update((m) => ({ ...m, quantity: '', reason: '' }));
      this.page.set(1); this.product.reload(); this.history.reload();
    } catch (error) { this.errorKey.set(inventoryErrorKey(error)); }
    finally { this.busy.set(false); }
  }
  protected refresh(): void { this.product.reload(); this.history.reload(); }
  protected dateTime(value: string): string { return formatAppDateTime(value); }
}
