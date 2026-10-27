import { Component, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n';
import { ErrorToast } from './error-toast';

@Component({
  selector: 'app-error-toast-outlet',
  template: `@if (toast.message(); as message) {
    <div class="error-toast" role="alert" aria-live="assertive">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4m0 4h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
      <span>{{ message }}</span>
      <button type="button" (click)="toast.dismiss()">{{ i18n.t('common.dismiss') }}</button>
    </div>
  }`,
  styleUrl: './error-toast.scss'
})
export class ErrorToastOutlet {
  protected readonly toast = inject(ErrorToast);
  protected readonly i18n = inject(I18nService);
}
