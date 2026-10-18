import { Routes } from '@angular/router';
import { SignIn } from './features/signin/signin';
import { Signup } from './features/signup/signup';

export const routes: Routes = [
  { path: 'signup', component: Signup },
  { path: '', pathMatch: 'full', component: SignIn },
  { path: '**', redirectTo: '' }
];
