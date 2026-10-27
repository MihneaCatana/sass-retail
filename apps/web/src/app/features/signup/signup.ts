import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  email,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit
} from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { AuthService } from '../../core/auth/auth';

interface SignupResponse {
  slug: string;
  name: string;
  adminEmail: string;
  tenantId: string;
}

@Component({
  selector: 'app-signup',
  imports: [FormField, RouterLink, LanguageSwitcher],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  /** Signal Forms are model-driven: the form structure derives from this signal. */
  private readonly signupModel = signal({
    companyName: '',
    slug: '',
    adminEmail: '',
    adminPassword: ''
  });

  // Validation messages are captured when the form is created, so they use the
  // language active at page load (the persisted choice is applied on startup).
  protected readonly signupForm = form(this.signupModel, (s) => {
    required(s.companyName, { message: this.i18n.t('signup.error.companyNameRequired') });
    minLength(s.companyName, 2);
    maxLength(s.companyName, 80);

    required(s.slug, { message: this.i18n.t('signup.error.workspaceAddressRequired') });
    minLength(s.slug, 3);
    maxLength(s.slug, 64);
    pattern(s.slug, /^[a-z][a-z0-9-]+$/, {
      message: this.i18n.t('signup.error.slugFormat')
    });

    required(s.adminEmail, { message: this.i18n.t('signup.error.adminEmailRequired') });
    email(s.adminEmail, { message: this.i18n.t('signup.error.adminEmailFormat') });
    maxLength(s.adminEmail, 120);

    required(s.adminPassword, { message: this.i18n.t('signup.error.passwordRequired') });
    minLength(s.adminPassword, 10);
    maxLength(s.adminPassword, 128);
  });

  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal<SignupResponse | null>(null);

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }
    // submit() marks all fields as touched (surfacing validation errors) and
    // only runs the callback when the form is valid.
    submit(this.signupForm, async () => {
      this.submitting.set(true);
      this.error.set('');

      try {
        const response = await firstValueFrom(
          this.http.post<SignupResponse>('/api/onboarding/signup', this.signupModel())
        );
        this.done.set(response);
        // Provisioning is complete, so continue into the existing PKCE flow
        // instead of leaving a new owner at a confirmation-page dead end.
        this.auth.login();
      } catch (err) {
        this.error.set(
          (err as { error?: { error?: string } }).error?.error ??
            this.i18n.t('signup.error.generic')
        );
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
