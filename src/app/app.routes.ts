import { Routes } from '@angular/router';
import { SlideComponent } from './slide';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'introduction' },
  { path: ':slug', component: SlideComponent },
  { path: '**', redirectTo: 'introduction' },
];
