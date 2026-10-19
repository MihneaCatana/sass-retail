import { Routes } from '@angular/router';
import { AppLayout } from './features/app-layout/app-layout';
import { SignIn } from './features/signin/signin';
import { authGuard } from './core/auth/auth-guard';
import { platformAdminGuard } from './core/auth/role-guard';
import { signedInGuard } from './core/auth/signed-in-guard';

export const routes: Routes = [
  // Public zone: landing page and signup (signed-in users are redirected to
  // /app/home by signedInGuard).
  { path: '', pathMatch: 'full', canActivate: [signedInGuard], component: SignIn },
  { path: 'signup', loadComponent: () => import('./features/signup/signup').then((m) => m.Signup) },
  // Authenticated application zone: one guard covers every child, and all
  // children render inside the sidebar shell.
  {
    path: 'app',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
      { path: 'products', loadComponent: () => import('./features/products/products').then((m) => m.Products) },
      { path: 'products/new', loadComponent: () => import('./features/products/product-edit').then((m) => m.ProductEdit) },
      {
        path: 'products/:id/edit',
        loadComponent: () => import('./features/products/product-edit').then((m) => m.ProductEdit)
      },
      {
        path: 'platform/tenants',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/platform/tenants/tenants').then((m) => m.Tenants)
      },
      {
        path: 'platform/tenants/:slug',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/platform/tenant-detail/tenant-detail').then((m) => m.TenantDetail)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];

