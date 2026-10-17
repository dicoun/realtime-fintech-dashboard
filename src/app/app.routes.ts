import { Routes } from '@angular/router';
import { DashboardPage } from './features/dashboard-page/dashboard-page';
import { SettingsPage } from './features/settings-page/settings-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardPage, title: 'Market Dashboard' },
  { path: 'settings', component: SettingsPage, title: 'Producer Settings' },
  { path: '**', redirectTo: 'dashboard' },
];
