import { Injectable, effect, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeRo from '@angular/common/locales/ro';
import { LANGUAGES, en, ro } from './translations';
import type { Language, TranslationKey, TranslationParams, Translations } from './translations';

// Romanian date/number formatting rules for Angular's built-in pipes
// (components pass i18n.lang() as the pipes' locale argument).
registerLocaleData(localeRo);

const STORAGE_KEY = 'retail.lang';

/**
 * Signal-based runtime i18n (no external library): in-code dictionaries with
 * English as the source of truth, localStorage persistence, and a <html lang>
 * sync for accessibility. Templates call t(key), which reads the lang signal,
 * so every binding re-renders automatically when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly dictionaries: Record<Language, Partial<Translations>> = { en, ro };

  readonly languages = LANGUAGES;
  readonly lang = signal<Language>(this.restoreLanguage());

  constructor() {
    // Keep <html lang> in sync so screen readers announce the right language.
    effect(() => {
      document.documentElement.lang = this.lang();
    });
  }

  setLanguage(language: Language): void {
    this.lang.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage may be unavailable; the choice still applies for this session.
    }
  }

  /** Translate a key in the current language, with optional {param} interpolation. */
  t(key: TranslationKey, params?: TranslationParams): string {
    const template = this.dictionaries[this.lang()][key] ?? en[key] ?? key;
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match
    );
  }

  private restoreLanguage(): Language {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'ro' ? 'ro' : 'en';
    } catch {
      return 'en';
    }
  }
}