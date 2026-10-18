import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideAuth } from 'angular-auth-oidc-client';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        provideAuth({
          config: {
            authority: 'http://localhost:8082/realms/retail',
            clientId: 'retail-web',
            redirectUrl: 'http://localhost:8082/',
            postLogoutRedirectUri: 'http://localhost:8082/',
            responseType: 'code'
          }
        })
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the sign-in card when unauthenticated', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Sign in to your workspace');
    expect(compiled.querySelector('button')?.textContent).toContain('Sign in');
    expect(compiled.querySelector('a')?.textContent).toContain('Create your workspace');
  });

  it('should render the signup form at /signup', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/signup');
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Create your workspace');
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain('Create workspace');
  });
});


