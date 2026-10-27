import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n';
import type { TranslationKey } from '../../../core/i18n/translations';

/** Colored pill for a registry status value (green active / red suspended). */
@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss'
})
export class StatusBadge {
  readonly status = input.required<string>();

  private readonly i18n = inject(I18nService);

  /** Known API status values are translated; unknown ones show the raw value. */
  protected readonly label = computed(() => {
    const known: Record<string, TranslationKey> = {
      active: 'status.active',
      suspended: 'status.suspended'
    };
    const key = known[this.status()];
    return key ? this.i18n.t(key) : this.status();
  });
}
