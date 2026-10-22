import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CustomerRow, Paged } from '../../core/models';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';

@Component({
  selector: 'wc-customers',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ...SHARED_PIPES],
  template: `
    <h2 class="page-title mb-3">Customers</h2>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <form class="search-box" style="width: 300px" (ngSubmit)="page.set(1); load()">
        <i class="bi bi-search"></i>
        <input class="form-control form-control-sm" name="s" [(ngModel)]="q" placeholder="Name, email or phone" />
      </form>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="sort" (change)="load()">
        <option value="newest">Newest</option><option value="spent">Top spenders</option><option value="orders">Most orders</option><option value="recent">Recent buyers</option>
      </select>
    </div>
    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th class="text-end">Orders</th><th class="text-end">Total spent</th><th>City</th><th>Last order</th><th>Joined</th></tr></thead>
          <tbody>
            @for (c of rows().items; track c.id) {
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <span class="avatar-sm">{{ c.fullName.charAt(0) }}</span>
                    <a class="fw-bold" [routerLink]="['/customers', c.id]">{{ c.fullName }}</a>
                    @if (c.isGuest) { <span class="badge-soft badge-soft-secondary" title="Checked out without an account">Guest</span> }
                    @if (!c.isActive) { <span class="badge-soft badge-soft-danger">Blocked</span> }
                  </div>
                </td>
                <td><a [href]="'mailto:' + c.email">{{ c.email }}</a></td>
                <td>{{ c.phone || '—' }}</td>
                <td class="text-end">{{ c.orders }}</td>
                <td class="text-end fw-bold">{{ c.totalSpent | inr }}</td>
                <td class="text-muted">{{ c.city || '—' }}</td>
                <td class="text-muted">{{ c.lastOrderAt ? (c.lastOrderAt | date: 'dd MMM yyyy') : '—' }}</td>
                <td class="text-muted">{{ c.createdAt | date: 'dd MMM yyyy' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8"><div class="empty-state"><i class="bi bi-people"></i>No customers yet.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />
  `,
  styles: [`.avatar-sm { width: 2rem; height: 2rem; border-radius: 50%; background: var(--wc-soft-primary); color: #9A5226; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; }`]
})
export class CustomersPage {
  private api = inject(ApiService);
  protected rows = signal<Paged<CustomerRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected page = signal(1);
  q = '';
  sort = 'newest';

  constructor() { this.load(); }

  load() {
    this.api.get<Paged<CustomerRow>>('admin/customers', { search: this.q, sort: this.sort, page: this.page(), pageSize: 25 }).subscribe(r => this.rows.set(r));
  }
}
