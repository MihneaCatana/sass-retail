import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAuth } from 'angular-auth-oidc-client';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAuth({
      config: {
        // Origin-relative: Keycloak is proxied on the same origin (nginx),
        // so this is identical in every environment — no env-specific builds.
        authority: `${window.location.origin}/realms/retail`,
        clientId: 'retail-web',
        redirectUrl: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        responseType: 'code',
        scope: 'openid profile email',
        useRefreshToken: true
      }
    })
  ]
};

