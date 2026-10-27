import { I18nService } from '../../core/i18n/i18n';
import { en, type TranslationKey } from '../../core/i18n/translations';

export function inventoryErrorKey(error: unknown): TranslationKey {
  const code = (error as { error?: { code?: string } })?.error?.code;
  const key = `inventory.error.${code}`;
  return key in en ? key as TranslationKey : 'inventory.error.generic';
}

export function inventoryError(error: unknown, i18n: I18nService): string {
  return i18n.t(inventoryErrorKey(error));
}
