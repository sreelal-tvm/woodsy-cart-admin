import { Routes } from '@angular/router';
import { authGuard } from './core/auth';
import { ShellComponent } from './layout/shell';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then(m => m.LoginPage), title: 'Sign in · WoodsyCart Admin' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardPage), title: 'Dashboard · WoodsyCart' },
      { path: 'orders', loadComponent: () => import('./pages/orders/orders').then(m => m.OrdersPage), title: 'Orders · WoodsyCart' },
      { path: 'orders/:id', loadComponent: () => import('./pages/orders/order-detail').then(m => m.OrderDetailPage), title: 'Order details · WoodsyCart' },
      { path: 'customers', loadComponent: () => import('./pages/customers/customers').then(m => m.CustomersPage), title: 'Customers · WoodsyCart' },
      { path: 'customers/:id', loadComponent: () => import('./pages/customers/customer-detail').then(m => m.CustomerDetailPage), title: 'Customer details · WoodsyCart' },
      { path: 'refunds', loadComponent: () => import('./pages/refunds').then(m => m.RefundsPage), title: 'Returns & refunds · WoodsyCart' },
      { path: 'enquiries', loadComponent: () => import('./pages/enquiries').then(m => m.EnquiriesPage), title: 'Enquiries · WoodsyCart' },
      { path: 'products', loadComponent: () => import('./pages/products/products').then(m => m.ProductsPage), title: 'Products · WoodsyCart' },
      { path: 'products/new', loadComponent: () => import('./pages/products/product-edit').then(m => m.ProductEditPage), title: 'Add product · WoodsyCart' },
      { path: 'products/:id', loadComponent: () => import('./pages/products/product-edit').then(m => m.ProductEditPage), title: 'Edit product · WoodsyCart' },
      { path: 'categories', loadComponent: () => import('./pages/categories').then(m => m.CategoriesPage), title: 'Categories · WoodsyCart' },
      { path: 'image-cleaning', loadComponent: () => import('./pages/image-cleaning').then(m => m.ImageCleaningPage), title: 'Image clean-up · WoodsyCart' },
      { path: 'reviews', loadComponent: () => import('./pages/reviews').then(m => m.ReviewsPage), title: 'Reviews · WoodsyCart' },
      { path: 'offers', loadComponent: () => import('./pages/offers').then(m => m.OffersPage), title: 'Festival offers · WoodsyCart' },
      { path: 'coupons', loadComponent: () => import('./pages/coupons').then(m => m.CouponsPage), title: 'Coupons · WoodsyCart' },
      { path: 'banners', loadComponent: () => import('./pages/banners').then(m => m.BannersPage), title: 'Home banners · WoodsyCart' },
      { path: 'vendors', loadComponent: () => import('./pages/vendors/vendors').then(m => m.VendorsPage), title: 'Vendor & sync · WoodsyCart' },
      { path: 'vendor-bills', loadComponent: () => import('./pages/vendors/vendor-bills').then(m => m.VendorBillsPage), title: 'Vendor bills · WoodsyCart' },
      { path: 'profit-loss', loadComponent: () => import('./pages/finance/profit-loss').then(m => m.ProfitLossPage), title: 'Profit & loss · WoodsyCart' },
      { path: 'invoices', loadComponent: () => import('./pages/finance/invoices').then(m => m.InvoicesPage), title: 'Customer invoices · WoodsyCart' },
      { path: 'expenses', loadComponent: () => import('./pages/finance/expenses').then(m => m.ExpensesPage), title: 'Expenses · WoodsyCart' },
      { path: 'payments', loadComponent: () => import('./pages/payments').then(m => m.PaymentsPage), title: 'Payment integrations · WoodsyCart' },
      { path: 'pincodes', loadComponent: () => import('./pages/pincodes').then(m => m.PincodesPage), title: 'Delivery pincodes · WoodsyCart' },
      { path: 'settings', loadComponent: () => import('./pages/settings').then(m => m.SettingsPage), title: 'Settings · WoodsyCart' }
    ]
  },
  { path: '**', redirectTo: '' }
];
