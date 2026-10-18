import { Routes } from '@angular/router';
import { Signup } from './features/signup/signup';

export const routes: Routes = [
  { path: 'signup', component: Signup },
  { path: '', pathMatch: 'full', redirectTo: 'signup' },
  { path: '**', redirectTo: 'signup' }
];
