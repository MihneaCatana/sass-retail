import { Component, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';

interface Me {
  sub: string;
  roles: string[];
  tenantSlug: string | null;
}

interface CurrentTenant {
  tenantId: string;
  slug: string;
  name: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  styleUrl: './app.scss',
  template: `
    <main class="shell">
      @if (!isAuthenticated()) {
        <router-outlet />
      } @else {
        <section class="card">
          <h1>sass-retail</h1>
          @if (me(); as me) {
            <p>Signed in as <strong>{{ me.sub }}</strong> — roles: {{ me.roles.join(', ') || 'none' }}</p>
          }
          @if (tenant(); as tenant) {
            <p>
              Tenant: <strong>{{ tenant.name }}</strong> <span class="muted">({{ tenant.slug }})</span>
            </p>
          } @else if (loadError(); as error) {
            <p class="error">{{ error }}</p>
          } @else {
            <p>Loading tenant…</p>
          }
          <button type="button" (click)="logout()">Sign out</button>
        </section>
      }
    </main>
  `
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly isAuthenticated = toSignal(
    this.auth.isAuthenticated$.pipe(map((result) => result.isAuthenticated)),
    { initialValue: false }
  );
  readonly me = signal<Me | null>(null);
  readonly tenant = signal<CurrentTenant | null>(null);
  readonly loadError = signal('');

  constructor() {
    this.auth.checkAuth();

    // Once authenticated, load identity + tenant from the API.
    effect(() => {
      if (this.isAuthenticated() && !this.me()) {
        this.loadTenantData();
      }
    });
  }

  private loadTenantData(): void {
    this.http.get<Me>('/api/me').subscribe({
      next: (me) => this.me.set(me),
      error: () => this.loadError.set('Could not load identity.')
    });

    this.http.get<CurrentTenant>('/api/tenants/current').subscribe({
      next: (tenant) => this.tenant.set(tenant),
      error: (err) =>
        this.loadError.set(
          err.status === 403 ? 'Your account is not linked to a tenant yet.' : 'Could not load tenant data.'
        )
    });
  }

  logout(): void {
    this.auth.logout();
  }
}

