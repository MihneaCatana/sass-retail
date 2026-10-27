import { Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../../../core/i18n/i18n';
import { LanguageSwitcher } from '../language-switcher/language-switcher';
import { NavItem } from '../nav-item/nav-item';

export interface SidebarNavItem {
  label: string;
  link: string;
}

/**
 * Reusable navigation sidebar: items and user identity come in via inputs,
 * sign-out is delegated to the host via an output. No routing/identity logic
 * lives here, so any layout can host it.
 */
@Component({
  selector: 'app-sidebar',
  imports: [LanguageSwitcher, NavItem, MatButtonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  protected readonly i18n = inject(I18nService);
  protected readonly menuOpen = signal(false);

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  readonly heading = input('Navigation');
  readonly items = input.required<SidebarNavItem[]>();
  readonly userName = input('');
  readonly signOut = output<void>();
}
