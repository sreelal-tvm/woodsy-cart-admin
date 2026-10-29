import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CustomerDetail } from '../../core/models';

interface PasswordStatus { hasPassword: boolean; changedAt?: string; changedBy?: string; resetLinkSentAt?: string; resetLinkActive: boolean; canEmail: boolean; }
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
              <div class="big-avatar mx-auto mb-2">{{ c.fullName | initials }}</div>
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
          <div class="card mb-3">
            <div class="card-header"><h5 class="mb-0">Password & sign-in</h5></div>
            <div class="card-body fs-7">
              @if (pw(); as s) {
                <div class="mb-2">
                  @if (s.hasPassword) { <i class="bi bi-key text-success me-1"></i>Has a password@if (s.changedAt) { · last set {{ s.changedAt | date: 'dd MMM yyyy, h:mm a' }} by <b>{{ s.changedBy }}</b> } }
                  @else { <i class="bi bi-person-dash text-muted me-1"></i>No password yet (guest checkout). Setting one gives them a full account with their orders. }
                </div>
                @if (s.resetLinkSentAt) {
                  <div class="text-muted mb-2"><i class="bi bi-envelope me-1"></i>Reset link sent {{ s.resetLinkSentAt | date: 'dd MMM, h:mm a' }} · {{ s.resetLinkActive ? 'still valid' : 'used or expired' }}</div>
                }
                <div class="d-flex flex-wrap gap-2 mb-1">
                  <button class="btn btn-sm btn-phoenix-secondary" (click)="sendLink()" [disabled]="!s.canEmail || busy()"
                    [title]="s.canEmail ? 'Email ' + c.email + ' a link to choose a new password' : 'Email is not set up (Admin → Email & notifications)'">
                    <i class="bi bi-envelope-arrow-up me-1"></i>Email a reset link</button>
                  <button class="btn btn-sm btn-phoenix-secondary" (click)="openSet()" [disabled]="busy()"><i class="bi bi-key me-1"></i>Set a new password</button>
                </div>
                @if (!s.canEmail) { <div class="text-muted fs-8">Email is not set up, so set a password and share it with the customer on WhatsApp or by phone.</div> }

                @if (setting()) {
                  <div class="border rounded-3 p-3 mt-3">
                    <label class="form-label fs-8 fw-bold" for="np">New password</label>
                    <div class="input-group input-group-sm mb-1">
                      <input id="np" class="form-control font-monospace" [(ngModel)]="newPassword" name="np" autocomplete="off" spellcheck="false" />
                      <button type="button" class="btn btn-phoenix-secondary" (click)="generate()" title="Make a new easy-to-read password"><i class="bi bi-shuffle"></i></button>
                    </div>
                    <div class="form-text mb-2">At least 8 characters. Ask the customer to change it after signing in.</div>
                    @if (s.canEmail) {
                      <div class="form-check mb-2"><input class="form-check-input" type="checkbox" id="nt" [(ngModel)]="notify" name="nt" />
                        <label class="form-check-label fs-8" for="nt">Email the customer that their password was changed (the password itself is not emailed)</label></div>
                    }
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-primary" (click)="setPassword()" [disabled]="busy() || newPassword.trim().length < 8">Save password</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="setting.set(false)">Cancel</button>
                    </div>
                  </div>
                }
                @if (shared(); as p) {
                  <div class="alert alert-success mt-3 mb-0 py-2">
                    <div class="fw-bold mb-1">Password saved. Share it with {{ c.fullName.split(' ')[0] }}</div>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                      <code class="fs-6 user-select-all">{{ p }}</code>
                      <button class="btn btn-sm btn-light" (click)="copy(p)"><i class="bi bi-clipboard me-1"></i>Copy</button>
                      @if (waLink(c.phone, p); as wa) { <a class="btn btn-sm btn-success" [href]="wa" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Send on WhatsApp</a> }
                    </div>
                    <div class="fs-8 mt-1">It is not shown again after you leave this page.</div>
                  </div>
                }
              } @else { <span class="text-muted">Loading…</span> }
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
  styles: [`.big-avatar { width: 5rem; height: 5rem; border-radius: 50%; background: var(--wc-soft-primary); color: #9A5226; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; }`]
})
export class CustomerDetailPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly id = input.required<string>();
  protected c = signal<CustomerDetail | null>(null);
  notes = '';

  // Password & sign-in
  protected pw = signal<PasswordStatus | null>(null);
  protected setting = signal(false);
  protected shared = signal<string | null>(null);
  protected busy = signal(false);
  newPassword = '';
  notify = true;

  constructor() {
    effect(() => {
      const id = this.id();
      this.api.get<CustomerDetail>(`admin/customers/${id}`).subscribe(c => { this.c.set(c); this.notes = c.notes ?? ''; });
      this.api.get<PasswordStatus>(`admin/customers/${id}/password`).subscribe(s => this.pw.set(s));
    });
  }

  sendLink() {
    const c = this.c()!;
    if (!confirm(`Email ${c.email} a link to choose a new password?`)) return;
    this.busy.set(true);
    this.api.post<PasswordStatus>(`admin/customers/${c.id}/password/reset-link`).subscribe({
      next: s => { this.pw.set(s); this.busy.set(false); this.toast.success(`Reset link sent to ${c.email} (valid 60 minutes)`); },
      error: () => this.busy.set(false)
    });
  }

  openSet() { this.generate(); this.shared.set(null); this.setting.set(true); }

  /** Easy to read out or type on a phone, e.g. "Walnut-482917". */
  generate() {
    const words = ['Teak', 'Oak', 'Walnut', 'Maple', 'Cedar', 'Pine', 'Mango', 'Sheesham', 'Birch', 'Rosewood', 'Ash', 'Cherry'];
    const n = crypto.getRandomValues(new Uint32Array(2));
    this.newPassword = `${words[n[0] % words.length]}-${String(n[1] % 1_000_000).padStart(6, '0')}`;
  }

  setPassword() {
    const c = this.c()!;
    const password = this.newPassword.trim();
    this.busy.set(true);
    this.api.post<PasswordStatus>(`admin/customers/${c.id}/password`, { newPassword: password, notifyCustomer: this.notify && !!this.pw()?.canEmail }).subscribe({
      next: s => {
        this.pw.set(s); this.busy.set(false); this.setting.set(false); this.shared.set(password); this.newPassword = '';
        this.c.set({ ...c, isGuest: false });
        this.toast.success('Password saved');
      },
      error: () => this.busy.set(false)
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text).then(() => this.toast.success('Copied')); }

  /** WhatsApp chat with the customer, message ready to send. */
  waLink(phone: string | undefined | null, password: string) {
    const d = (phone ?? '').replace(/\D/g, '').slice(-10);
    if (d.length !== 10) return null;
    const c = this.c()!;
    const text = `Hi ${c.fullName.split(' ')[0]}, this is WoodsyCart. Your new password is: ${password}\n` +
      `Sign in with ${c.email} and change it under Account → Profile.`;
    return `https://wa.me/91${d}?text=${encodeURIComponent(text)}`;
  }

  private update(isActive: boolean) {
    const c = this.c()!;
    this.api.put(`admin/customers/${c.id}`, { isActive, notes: this.notes }).subscribe(() => { this.c.set({ ...c, isActive, notes: this.notes }); this.toast.success('Customer updated'); });
  }
  toggleActive() { this.update(!this.c()!.isActive); }
  save() { this.update(this.c()!.isActive); }
}
