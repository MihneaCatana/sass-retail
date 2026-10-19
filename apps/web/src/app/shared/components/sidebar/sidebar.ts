import { Component, input, output } from '@angular/core';
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
  imports: [NavItem],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  readonly heading = input('Navigation');
  readonly items = input.required<SidebarNavItem[]>();
  readonly userName = input('');
  readonly signOut = output<void>();
}
