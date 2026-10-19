import { Component, inject } from '@angular/core';
import { IdentityStore } from '../../core/identity/identity-store';

/** Signed-in landing page: identity + tenant status (reads the shared store). */
@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  protected readonly identity = inject(IdentityStore);
}
