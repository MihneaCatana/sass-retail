import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../i18n/i18n';
import { en } from '../i18n/translations';
import type { TranslationKey } from '../i18n/translations';

/** Maps safe API error codes to localized, user-facing recovery messages. */
function messageKey(error: HttpErrorResponse): TranslationKey {
  const code = typeof error.error?.code === 'string' ? error.error.code : '';
  const inventoryKey = `inventory.error.${code}`;
  if (inventoryKey in en) return inventoryKey as TranslationKey;
  if (error.status === 403) return 'sales.error.permission';
  if (/STOCK|WHOLE_UNITS/.test(code)) return 'sales.error.stock';
  if (/REVISION/.test(code)) return 'sales.error.revision';
  if (/INVALID|QUANTITY|PRICE_OVERRIDE/.test(code)) return 'sales.error.invalid';
  if (/CONFLICT|STATE|COMPLETED|RETURN/.test(code)) return 'sales.error.conflict';
  return 'sales.error.generic';
}

/** Brief alert for failed write requests; pages retain inline recovery details. */
@Injectable({ providedIn: 'root' })
export class ErrorToast {
  private readonly i18n = inject(I18nService);
  readonly message = signal('');
  private timeout?: ReturnType<typeof setTimeout>;

  show(error: HttpErrorResponse): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.message.set(this.i18n.t(messageKey(error)));
    this.timeout = setTimeout(() => this.dismiss(), 8000);
  }

  dismiss(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
    this.message.set('');
  }
}
