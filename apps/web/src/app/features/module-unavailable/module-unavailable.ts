import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n';

@Component({
  selector: 'app-module-unavailable',
  imports: [RouterLink],
  template: `
    <section class="unavailable">
      <p class="eyebrow">Storeboard</p>
      <h1>{{ i18n.t('moduleAccess.unavailableTitle') }}</h1>
      <p>{{ i18n.t('moduleAccess.unavailableBody') }}</p>
      <a routerLink="/app/home">{{ i18n.t('moduleAccess.backHome') }}</a>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .unavailable { max-width: 42rem; padding: clamp(1.2rem, 3vw, 2.5rem); background: var(--sb-surface-white, #fff); border: 1px solid var(--sb-border, #dce7e1); border-radius: 12px; }
    .eyebrow { margin: 0 0 .5rem; color: var(--sb-muted, #526a60); font-size: .8rem; font-weight: 600; }
    h1 { margin: 0; font-size: clamp(1.6rem, 3vw, 2.25rem); line-height: 1.2; }
    p:not(.eyebrow) { max-width: 38rem; line-height: 1.55; color: var(--sb-muted, #526a60); }
    a { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0 1rem; border-radius: 8px; background: var(--sb-primary, #163d36); color: #fff; font-weight: 600; text-decoration: none; }
    a:focus-visible { outline: 2px solid var(--sb-primary, #163d36); outline-offset: 3px; }
  `]
})
export class ModuleUnavailable {
  protected readonly i18n = inject(I18nService);
}
