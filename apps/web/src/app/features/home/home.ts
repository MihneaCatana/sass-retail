import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n';
import { IdentityStore } from '../../core/identity/identity-store';

/** Signed-in landing page: identity + tenant status (reads the shared store). */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  protected readonly i18n = inject(I18nService);
  protected readonly identity = inject(IdentityStore);
}
