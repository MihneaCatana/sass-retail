import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-signin',
  imports: [RouterLink],
  styleUrl: './signin.scss',
  template: `
    <section class="card">
      <h1>Sign in to your workspace</h1>
      <p class="muted">You'll be taken to a secure page to enter your password.</p>
      <button type="button" (click)="login()">Sign in</button>
      <p class="muted footer-note">New here? <a routerLink="/signup">Create your workspace</a></p>
    </section>
  `
})
export class SignIn {
  private readonly auth = inject(AuthService);

  login(): void {
    this.auth.login();
  }
}