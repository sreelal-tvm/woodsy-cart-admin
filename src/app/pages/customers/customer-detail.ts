import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CustomerDetail } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';

@Component({
  selector: 'wc-customer-detail',
  imports: [FormsModule, RouterLink, DatePipe, ...SHARED_PIPES],
  template: `
    @if (c(); as c) {
      <nav class="fs-7 mb-2"><a routerLink="/customers">Customers</a> <i class="bi bi-chevron-right text-quiet mx-1"></i> <span class="text-muted">{{ c.fullName }}</span></nav>
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h2 class="page-title">Customer details</h2>
          <p class="page-subtitle mb-0">Joined {{ c.createdAt | date: 'dd MMM yyyy' }}@if (c.lastLoginAt) { · last seen {{ c.lastLoginAt | date: 'dd MMM, h:mm a' }} }</p>
        </div>
        <button class="btn btn-sm" [class.btn-outline-danger]="c.isActive" [class.btn-success]="!c.isActive" (click)="toggleActive()">
          <i class="bi me-1" [class.bi-slash-circle]="c.isActive" [class.bi-check-circle]="!c.isActive"></i>{{ c.isActive ? 'Block customer' : 'Unblock customer' }}
        </button>
      </div>

      <div class="row g-3">
        <div class="col-xl-4">
          <div class="card mb-3">
            <div class="card-body text-center">
              <div class="big-avatar mx-auto mb-2">{{ c.fullName.charAt(0) }}</div>
              <h4 class="mb-0">{{ c.fullName }}</h4>
              @if (c.isGuest) { <span class="badge-soft badge-soft-secondary mb-1">Guest checkout · no account yet</span> }
              <div class="text-muted fs-7">{{ c.email }}</div>
              @if (c.phone) { <div class="text-muted fs-7">{{ c.phone }}</div> }
              <div class="row mt-3 text-center">
                <div class="col"><div class="fw-bold fs-5">{{ c.orders }}</div><div class="text-muted fs-8">Orders</div></div>
                <div class="col"><div class="fw-bold fs-5">{{ c.totalSpent | inr }}</div><div class="text-muted fs-8">Spent</div></div>
                <div class="col"><div class="fw-bold fs-5">{{ c.avgOrderValue | inr }}</div><div class="text-muted fs-8">AOV</div></div>
              </div>
              <div class="d-flex justify-content-center gap-3 text-muted fs-7 mt-3">
                <span><i class="bi bi-heart me-1"></i>{{ c.wishlistCount }} in wishlist</span>
                <span><i class="bi bi-cart me-1"></i>{{ c.cartCount }} in cart</span>
              </div>
            </div>
          </div>
          <div class="card mb-3">
            <div class="card-header"><h5 class="mb-0">Addresses</h5></div>
            <div class="card-body fs-7">
              @for (a of c.addresses; track a.id) {
                <div class="mb-3">
                  <div class="fw-bold">{{ a.label }} @if (a.isDefault) { <span class="badge-soft badge-soft-primary ms-1">Default</span> }</div>
                  <div>{{ a.fullName }} · {{ a.phone }}</div>
                  <div class="text-muted">{{ a.line1 }}@if (a.line2) {, {{ a.line2 }}}, {{ a.city }} {{ a.pincode }}</div>
                </div>
              } @empty { <span class="text-muted">No saved addresses.</span> }
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h5 class="mb-0">Notes</h5></div>
            <div class="card-body">
              <textarea class="form-control form-control-sm mb-2" rows="3" [(ngModel)]="notes"></textarea>
              <button class="btn btn-sm btn-phoenix-secondary" (click)="save()">Save</button>
            </div>
          </div>
        </div>
        <div class="col-xl-8">
          <div class="card mb-3">
            <div class="card-header"><h5 class="mb-0">Orders ({{ c.orders }})</h5></div>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>Order</th><th>Items</th><th>Payment</th><th>Status</th><th class="text-end">Total</th><th>Date</th></tr></thead>
                <tbody>
                  @for (o of c.recentOrders; track o.id) {
                    <tr>
                      <td><a class="fw-bold" [routerLink]="['/orders', o.id]">#{{ o.orderNumber }}</a></td>
                      <td class="text-truncate" style="max-width: 220px">{{ o.firstItemName }}{{ o.itemCount > 1 ? ' +' + (o.itemCount - 1) : '' }}</td>
                      <td><span [class]="o.paymentStatus | statusColor">{{ o.paymentStatus | humanize }}</span></td>
                      <td><span [class]="o.status | statusColor">{{ o.status | humanize }}</span></td>
                      <td class="text-end fw-bold">{{ o.total | inr }}</td>
                      <td class="text-muted">{{ o.createdAt | date: 'dd MMM yyyy' }}</td>
                    </tr>
                  } @empty { <tr><td colspan="6" class="text-center text-muted py-4">No orders yet</td></tr> }
                </tbody>
              </table>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h5 class="mb-0">Ratings & reviews</h5></div>
            <div class="card-body">
              @for (r of c.reviews; track r.id) {
                <div class="border-bottom pb-2 mb-2">
                  <div class="text-warning">@for (s of [1, 2, 3, 4, 5]; track s) { <i class="bi" [class.bi-star-fill]="s <= r.rating" [class.bi-star]="s > r.rating"></i> }</div>
                  <div class="fw-bold fs-7">{{ r.product }}</div>
                  <div class="fs-7">{{ r.title }} {{ r.comment }}</div>
                </div>
              } @empty { <span class="text-muted fs-7">No reviews yet.</span> }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`.big-avatar { width: 5rem; height: 5rem; border-radius: 50%; background: var(--wc-soft-primary); color: #3874ff; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; }`]
})
export class CustomerDetailPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly id = input.required<string>();
  protected c = signal<CustomerDetail | null>(null);
  notes = '';

  constructor() {
    effect(() => this.api.get<CustomerDetail>(`admin/customers/${this.id()}`).subscribe(c => { this.c.set(c); this.notes = c.notes ?? ''; }));
  }

  private update(isActive: boolean) {
    const c = this.c()!;
    this.api.put(`admin/customers/${c.id}`, { isActive, notes: this.notes }).subscribe(() => { this.c.set({ ...c, isActive, notes: this.notes }); this.toast.success('Customer updated'); });
  }
  toggleActive() { this.update(!this.c()!.isActive); }
  save() { this.update(this.c()!.isActive); }
}
