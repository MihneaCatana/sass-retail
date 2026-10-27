import { Component, inject } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n';
import type { Language } from '../../../core/i18n/translations';

/** EN/RO toggle: switches the app language and persists it in localStorage. */
@Component({
  selector: 'app-language-switcher',
  imports: [],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss'
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18nService);

  protected select(language: Language): void {
    this.i18n.setLanguage(language);
  }
}