import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { I18nService } from '../../core/i18n/i18n';
import { IdentityStore } from '../../core/identity/identity-store';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import type { SidebarNavItem } from '../../shared/components/sidebar/sidebar';

/**
 * Authenticated application shell (mounted at /app): sidebar navigation plus
 * the routed content outlet. All /app/* routes render inside this layout.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss'
})
export class AppLayout {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);

  protected readonly navItems = computed<SidebarNavItem[]>(() => {
    const items: SidebarNavItem[] = [{ label: this.i18n.t('nav.home'), link: '/app/home' }];
    if (this.identity.hasModule('inventory')) {
      items.push({ label: this.i18n.t('nav.products'), link: '/app/products' });
    }
    if (this.identity.hasModule('sales')) {
      items.push({ label: this.i18n.t('sales.title'), link: '/app/sales' });
    }
    if (this.identity.isTenantAdmin() && this.identity.hasModule('sales-insights')) {
      items.push({ label: this.i18n.t('sales.performance'), link: '/app/sales/performance' });
    }
    if (this.identity.isPlatformAdmin()) {
      items.push({ label: this.i18n.t('nav.allTenants'), link: '/app/platform/tenants' });
    }
    return items;
  });

  protected signOut(): void {
    this.auth.logout();
  }
}
