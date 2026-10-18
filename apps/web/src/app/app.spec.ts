import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAuth } from 'angular-auth-oidc-client';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
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
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('sass-retail');
    expect(compiled.querySelector('button')?.textContent).toContain('Sign in');
  });
});


