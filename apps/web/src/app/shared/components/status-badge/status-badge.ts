import { Component, input } from '@angular/core';

/** Colored pill for a registry status value (green active / red suspended). */
@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss'
})
export class StatusBadge {
  readonly status = input.required<string>();
}
