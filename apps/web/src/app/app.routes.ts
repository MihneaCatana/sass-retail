import { Routes } from '@angular/router';
import { AppLayout } from './features/app-layout/app-layout';
import { SignIn } from './features/signin/signin';
import { authGuard } from './core/auth/auth-guard';
import { platformAdminGuard } from './core/auth/role-guard';
import { signedInGuard } from './core/auth/signed-in-guard';
import { moduleAccessGuard } from './core/auth/module-access-guard';

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
    canActivateChild: [moduleAccessGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', loadComponent: () => import('./features/home/home').then((m) => m.Home) },
      { path: 'sales', data: { moduleKey: 'sales' }, loadComponent: () => import('./features/sales/sales-list').then(m => m.SalesList) },
      { path: 'sales/new', data: { moduleKey: 'sales' }, canDeactivate:[component=>component.canDeactivate()], loadComponent: () => import('./features/sales/sale-detail').then(m => m.SaleDetail) },
      { path: 'sales/performance', data: { moduleKey: 'sales-insights' }, loadComponent: () => import('./features/sales/sales-performance').then(m => m.SalesPerformancePage) },
      { path: 'sales/simulator', redirectTo: 'sales' },
      { path: 'sales/profit-simulator', redirectTo: 'sales' },
      { path: 'sales/:id', data: { moduleKey: 'sales' }, canDeactivate:[component=>component.canDeactivate()], loadComponent: () => import('./features/sales/sale-detail').then(m => m.SaleDetail) },
      { path: 'costs', redirectTo: 'products' },
      { path: 'products', data: { moduleKey: 'inventory' }, loadComponent: () => import('./features/products/products').then((m) => m.Products) },
      { path: 'products/new', data: { moduleKey: 'inventory' }, loadComponent: () => import('./features/products/product-edit').then((m) => m.ProductEdit) },
      { path: 'products/:id/stock', redirectTo: 'products/:id' },
      { path: 'products/:id', data: { moduleKey: 'inventory' }, loadComponent: () => import('./features/products/product-detail').then((m) => m.ProductDetail) },
      {
        path: 'products/:id/edit',
        data: { moduleKey: 'inventory' },
        loadComponent: () => import('./features/products/product-edit').then((m) => m.ProductEdit)
      },
      { path: 'module-unavailable', loadComponent: () => import('./features/module-unavailable/module-unavailable').then((m) => m.ModuleUnavailable) },
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

