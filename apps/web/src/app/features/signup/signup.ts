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

interface SignupResponse {
  slug: string;
  name: string;
  adminEmail: string;
  tenantId: string;
}

@Component({
  selector: 'app-signup',
  imports: [FormField, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup {
  private readonly http = inject(HttpClient);

  /** Signal Forms are model-driven: the form structure derives from this signal. */
  private readonly signupModel = signal({
    companyName: '',
    slug: '',
    adminEmail: '',
    adminPassword: ''
  });

  protected readonly signupForm = form(this.signupModel, (s) => {
    required(s.companyName, { message: 'Company name is required' });
    minLength(s.companyName, 2);
    maxLength(s.companyName, 80);

    required(s.slug, { message: 'Workspace address is required' });
    minLength(s.slug, 3);
    maxLength(s.slug, 64);
    pattern(s.slug, /^[a-z][a-z0-9-]+$/, {
      message: 'Use lowercase letters, numbers and hyphens — starting with a letter.'
    });

    required(s.adminEmail, { message: 'Admin email is required' });
    email(s.adminEmail, { message: 'Enter a valid email address' });
    maxLength(s.adminEmail, 120);

    required(s.adminPassword, { message: 'Password is required' });
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
      } catch (err) {
        this.error.set(
          (err as { error?: { error?: string } }).error?.error ??
            "We couldn't create your workspace right now. Please try again."
        );
      } finally {
        this.submitting.set(false);
      }
    });
  }
}
