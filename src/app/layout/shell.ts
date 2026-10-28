import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SocialBadge } from '../core/social-badge';
import { AuthService } from '../core/auth';
import { environment } from '../../environments/environment';

interface NavItem { label: string; icon: string; link: string; }
interface NavGroup { title: string; items: NavItem[]; }

@Component({
  selector: 'wc-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.html',
  styleUrl: './shell.scss'
})
export class ShellComponent {
  protected auth = inject(AuthService);
  private router = inject(Router);
  protected storefrontUrl = environment.storefrontUrl;
  protected mobileOpen = signal(false);
  protected collapsed = signal(localStorage.getItem('wc_nav_collapsed') === '1');
  protected userMenu = signal(false);
  protected dark = signal(localStorage.getItem('wc_theme') === 'dark');
  protected search = '';
  /** New social media comments, shown next to "Social media" (checked every 5 minutes). */
  protected social = inject(SocialBadge);

  protected readonly nav: NavGroup[] = [
    { title: 'Home', items: [{ label: 'E-commerce dashboard', icon: 'bi-pie-chart', link: '/dashboard' }] },
    {
      title: 'Sales', items: [
        { label: 'Orders', icon: 'bi-bag-check', link: '/orders' },
        { label: 'Customers', icon: 'bi-people', link: '/customers' },
        { label: 'Returns & refunds', icon: 'bi-arrow-counterclockwise', link: '/refunds' },
        { label: 'Enquiries', icon: 'bi-chat-left-text', link: '/enquiries' }
      ]
    },
    {
      title: 'Catalogue', items: [
        { label: 'Products', icon: 'bi-box-seam', link: '/products' },
        { label: 'Add product', icon: 'bi-plus-square', link: '/products/new' },
        { label: 'Categories', icon: 'bi-grid', link: '/categories' },
        { label: 'Image clean-up', icon: 'bi-magic', link: '/image-cleaning' },
        { label: 'Reviews', icon: 'bi-star', link: '/reviews' }
      ]
    },
    {
      title: 'Marketing', items: [
        { label: 'Festival offers', icon: 'bi-stars', link: '/offers' },
        { label: 'Coupons', icon: 'bi-ticket-perforated', link: '/coupons' },
        { label: 'Social media', icon: 'bi-instagram', link: '/social' },
        { label: 'Home banners', icon: 'bi-images', link: '/banners' }
      ]
    },
    {
      title: 'Vendor', items: [
        { label: 'Vendor & catalogue sync', icon: 'bi-arrow-repeat', link: '/vendors' },
        { label: 'Vendor bills', icon: 'bi-receipt', link: '/vendor-bills' }
      ]
    },
    {
      title: 'Finance', items: [
        { label: 'Profit & loss', icon: 'bi-graph-up-arrow', link: '/profit-loss' },
        { label: 'Customer invoices', icon: 'bi-file-earmark-text', link: '/invoices' },
        { label: 'Expenses', icon: 'bi-wallet2', link: '/expenses' }
      ]
    },
    {
      title: 'Settings', items: [
        { label: 'Payment integrations', icon: 'bi-credit-card-2-front', link: '/payments' },
        { label: 'Email & notifications', icon: 'bi-envelope', link: '/email' },
        { label: 'Delivery pincodes', icon: 'bi-geo-alt', link: '/pincodes' },
        { label: 'Business settings', icon: 'bi-gear', link: '/settings' }
      ]
    }
  ];

  constructor() {
    this.applyTheme();
    this.router.events.subscribe(() => this.mobileOpen.set(false));
    this.checkComments();
    const timer = setInterval(() => this.checkComments(), 5 * 60 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private checkComments() { if (this.auth.user()) this.social.refresh(); }

  toggleCollapse() {
    this.collapsed.update(v => !v);
    localStorage.setItem('wc_nav_collapsed', this.collapsed() ? '1' : '0');
  }

  toggleTheme() {
    this.dark.update(v => !v);
    localStorage.setItem('wc_theme', this.dark() ? 'dark' : 'light');
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-bs-theme', this.dark() ? 'dark' : 'light');
  }

  doSearch() {
    const q = this.search.trim();
    if (!q) return;
    const isOrder = /^WC\d{6,}/i.test(q);
    this.router.navigate([isOrder ? '/orders' : '/products'], { queryParams: { search: q } });
    this.search = '';
  }

  initials(): string {
    return (this.auth.user()?.fullName ?? 'A').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
