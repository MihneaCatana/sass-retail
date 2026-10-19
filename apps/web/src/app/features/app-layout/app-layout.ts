import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
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
  protected readonly identity = inject(IdentityStore);

  protected readonly navItems = computed<SidebarNavItem[]>(() => {
    const items: SidebarNavItem[] = [
      { label: 'Home', link: '/app/home' },
      { label: 'Products', link: '/app/products' }
    ];
    if (this.identity.isPlatformAdmin()) {
      items.push({ label: 'All tenants', link: '/app/platform/tenants' });
    }
    return items;
  });

  protected signOut(): void {
    this.auth.logout();
  }
}
