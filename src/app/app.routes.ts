import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';

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
    canActivate: [MsalGuard],
    loadComponent: () => import('./features/profile/profile-page/profile-page').then((m) => m.ProfilePage),
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart-page/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'sell/new',
    canActivate: [MsalGuard],
    loadComponent: () => import('./features/sell/create-listing/create-listing').then((m) => m.CreateListing),
  },
];
