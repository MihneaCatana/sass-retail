import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface SignupResponse {
  slug: string;
  name: string;
  adminEmail: string;
  tenantId: string;
}

@Component({
  selector: 'app-signup',
  imports: [FormsModule, RouterLink],
  styleUrl: './signup.scss',
  template: `
    <main class="shell">
      @if (done(); as done) {
        <section class="card">
          <h1>Workspace created 🎉</h1>
          <p>
            <strong>{{ done.name }}</strong> is ready at
            <span class="muted">{{ done.slug }}</span>.
          </p>
          <p>Sign in with <strong>{{ done.adminEmail }}</strong> and the password you chose.</p>
          <a routerLink="/" class="button">Sign in</a>
        </section>
      } @else {
        <section class="card">
          <h1>Create your workspace</h1>
          <form (ngSubmit)="submit()">
            <label>Company name
              <input type="text" name="companyName" [(ngModel)]="companyName" required minlength="2" maxlength="80" placeholder="Acme Retail" />
            </label>
            <label>Workspace address
              <input type="text" name="slug" [(ngModel)]="slug" required pattern="[a-z][a-z0-9-]+" placeholder="acme-retail" />
            </label>
            <label>Admin email
              <input type="email" name="adminEmail" [(ngModel)]="adminEmail" required placeholder="you@company.com" />
            </label>
            <label>Password
              <input type="password" name="adminPassword" [(ngModel)]="adminPassword" required minlength="10" maxlength="128" placeholder="Min. 10 chars, upper + lower + digit" />
            </label>
            @if (error(); as error) {
              <p class="error">{{ error }}</p>
            }
            <button type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Creating…' : 'Create workspace' }}
            </button>
          </form>
          <p class="muted">Already have an account? <a routerLink="/">Sign in</a></p>
        </section>
      }
    </main>
  `
})
export class Signup {
  private readonly http = inject(HttpClient);

  companyName = '';
  slug = '';
  adminEmail = '';
  adminPassword = '';

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly done = signal<SignupResponse | null>(null);

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set('');

    this.http
      .post<SignupResponse>('/api/onboarding/signup', {
        companyName: this.companyName,
        slug: this.slug,
        adminEmail: this.adminEmail,
        adminPassword: this.adminPassword
      })
      .subscribe({
        next: (response) => {
          this.done.set(response);
          this.submitting.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Signup failed, please try again.');
          this.submitting.set(false);
        }
      });
  }
}
