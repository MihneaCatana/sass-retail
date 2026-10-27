import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { AuthService } from '../../core/auth/auth';
import { IdentityStore } from '../../core/identity/identity-store';
import { RETURN_URL_KEY } from '../../core/auth/auth-guard';

@Component({
  selector: 'app-signin',
  imports: [RouterLink, LanguageSwitcher],
  templateUrl: './signin.html',
  styleUrl: './signin.scss'
})
export class SignIn {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly identity = inject(IdentityStore);

  /** The sign-in card only shows once the auth check resolved without a session. */
  protected readonly showSignInCard = computed(
    () => this.identity.isAuthCheckComplete() && !this.identity.isAuthenticated()
  );

  constructor() {
    // The OIDC callback lands back on this page AFTER the signedInGuard has
    // already run (it saw the pre-authentication state), so nothing
    // re-navigates when authentication completes. Watch the auth state and
    // send the user into the /app zone as soon as the session is established,
    // restoring the URL they originally requested if one was saved.
    effect(() => {
      // The library publishes authentication before callback processing has
      // finished. Navigating at that point can race its callback URL cleanup.
      if (this.identity.isAuthCheckComplete() && this.identity.isAuthenticated()) {
        const returnUrl = sessionStorage.getItem(RETURN_URL_KEY);
        sessionStorage.removeItem(RETURN_URL_KEY);
        // Only internal app-zone URLs are honoured (sessionStorage is
        // user-editable, so treat its contents as untrusted).
        this.router.navigateByUrl(returnUrl?.startsWith('/app/') ? returnUrl : '/app/home');
      }
    });
  }

  login(): void {
    this.auth.login();
  }
}
