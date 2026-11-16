import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/catalog/catalog-list/catalog-list').then((m) => m.CatalogList),
  },
  {
    path: 'listings/:id',
    loadComponent: () =>
      import('./features/catalog/listing-detail/listing-detail').then((m) => m.ListingDetailPage),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile-page/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart-page/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/my-orders/my-orders').then((m) => m.MyOrders),
  },
  {
    path: 'sales',
    canActivate: [authGuard],
    loadComponent: () => import('./features/sales/my-sales/my-sales').then((m) => m.MySales),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  {
    path: 'sell/new',
    canActivate: [authGuard],
    loadComponent: () => import('./features/sell/create-listing/create-listing').then((m) => m.CreateListing),
  },
  {
    path: 'admin/publications',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-publications/admin-publications').then((m) => m.AdminPublications),
  },
  {
    path: 'admin/inspections',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-inspections/admin-inspections').then((m) => m.AdminInspections),
  },
  {
    path: 'admin/analytics',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-analytics/admin-analytics').then((m) => m.AdminAnalytics),
  },
];
