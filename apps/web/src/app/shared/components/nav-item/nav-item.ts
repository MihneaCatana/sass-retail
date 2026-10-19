import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** One navigation entry: a link that highlights itself while active. */
@Component({
  selector: 'app-nav-item',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-item.html',
  styleUrl: './nav-item.scss'
})
export class NavItem {
  readonly label = input.required<string>();
  readonly link = input.required<string>();
}
