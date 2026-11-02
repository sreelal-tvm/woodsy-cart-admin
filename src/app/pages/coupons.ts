import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Coupon, WelcomeOfferAdmin, WelcomeOfferSettings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

@Component({
  selector: 'wc-coupons',
  imports: [FormsModule, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Coupons</h2>
      <button class="btn btn-sm btn-primary" (click)="edit(null)"><i class="bi bi-plus-lg me-1"></i>New coupon</button>
    </div>
    <p class="page-subtitle">Discounts come out of your commission — keep them below your margin.</p>

    @if (welcome(); as w) {
      <div class="card mb-3"><div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <h5 class="mb-1"><i class="bi bi-gift me-1"></i>Welcome offer for new accounts</h5>
            <div class="text-muted fs-7">A discount on the first order, for a limited time after signing up. Shown in the cart with a countdown, in the welcome
              email, and a reminder goes a few hours before it ends (Email &amp; notifications → "Welcome offer ending"). Signed-out visitors see what they'd get.</div>
          </div>
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="wo" [(ngModel)]="w.enabled" /><label class="form-check-label fw-bold" for="wo">On</label></div>
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-2"><label class="form-label">Code</label><input class="form-control text-uppercase font-monospace" [(ngModel)]="w.code" maxlength="30" /></div>
          <div class="col-6 col-md-2"><label class="form-label">Type</label><select class="form-select" [(ngModel)]="w.discountType"><option value="Percent">Percent</option><option value="Flat">Flat ₹</option></select></div>
          <div class="col-4 col-md-2"><label class="form-label">{{ w.discountType === 'Percent' ? 'Discount %' : 'Discount ₹' }}</label><input type="number" class="form-control" [(ngModel)]="w.value" /></div>
          @if (w.discountType === 'Percent') { <div class="col-4 col-md-2"><label class="form-label">Max discount ₹</label><input type="number" class="form-control" [(ngModel)]="w.maxDiscount" placeholder="No cap" /></div> }
          <div class="col-4 col-md-2"><label class="form-label">Min order ₹</label><input type="number" class="form-control" [(ngModel)]="w.minOrder" /></div>
          <div class="col-6 col-md-2"><label class="form-label">Valid for</label>
            <select class="form-select" [(ngModel)]="w.validHours">@for (h of hours; track h) { <option [ngValue]="h">{{ h }} hours</option> }</select></div>
        </div>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <div class="fs-7 text-muted">
            @if (stats(); as st) { {{ st.started }} {{ st.started === 1 ? 'account' : 'accounts' }} got it · {{ st.running }} running now · <b>{{ st.used }} used</b>@if (st.discount) { ({{ st.discount | inr }} given) } }
          </div>
          <button class="btn btn-sm btn-primary" [disabled]="savingWelcome()" (click)="saveWelcome()">Save welcome offer</button>
        </div>
        <div class="form-text mb-0">Only accounts created while it is on get it, and only if they haven't ordered before. It works only for the signed-in account, so the code can't be shared.</div>
      </div></div>
    }

    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Valid</th><th class="text-end">Used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (c of rows(); track c.id) {
              <tr>
                <td><span class="font-monospace fw-bold">{{ c.code }}</span><div class="text-muted fs-8">{{ c.description }}</div></td>
                <td>{{ c.discountType === 'Percent' ? c.value + '%' : (c.value | inr) }}@if (c.maxDiscount) { <span class="text-muted fs-8"> up to {{ c.maxDiscount | inr }}</span> }</td>
                <td>{{ c.minOrderAmount | inr }}</td>
                <td class="fs-7 text-muted">{{ c.startsAt ? (c.startsAt | date: 'dd MMM') : 'Now' }} – {{ c.endsAt ? (c.endsAt | date: 'dd MMM yy') : 'No end' }}</td>
                <td class="text-end">{{ c.usedCount }}{{ c.usageLimit ? ' / ' + c.usageLimit : '' }}</td>
                <td><span [class]="c.isActive ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-secondary'">{{ c.isActive ? 'Active' : 'Off' }}</span></td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon" (click)="edit(c)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(c)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="7"><div class="empty-state"><i class="bi bi-ticket-perforated"></i>No coupons yet.</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit coupon' : 'New coupon'" (closed)="form.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Code</label><input class="form-control text-uppercase" [(ngModel)]="f.code" /></div>
          <div class="col-6"><label class="form-label">Type</label><select class="form-select" [(ngModel)]="f.discountType"><option value="Percent">Percent</option><option value="Flat">Flat ₹</option></select></div>
          <div class="col-12"><label class="form-label">Description (shown to customers)</label><input class="form-control" [(ngModel)]="f.description" /></div>
          <div class="col-4"><label class="form-label">Value</label><input type="number" class="form-control" [(ngModel)]="f.value" /></div>
          <div class="col-4"><label class="form-label">Max discount ₹</label><input type="number" class="form-control" [(ngModel)]="f.maxDiscount" /></div>
          <div class="col-4"><label class="form-label">Min order ₹</label><input type="number" class="form-control" [(ngModel)]="f.minOrderAmount" /></div>
          <div class="col-6"><label class="form-label">Starts</label><input type="date" class="form-control" [(ngModel)]="f.startsAt" /></div>
          <div class="col-6"><label class="form-label">Ends</label><input type="date" class="form-control" [(ngModel)]="f.endsAt" /></div>
          <div class="col-6"><label class="form-label">Total uses</label><input type="number" class="form-control" [(ngModel)]="f.usageLimit" placeholder="Unlimited" /></div>
          <div class="col-6"><label class="form-label">Uses per customer</label><input type="number" class="form-control" [(ngModel)]="f.perUserLimit" placeholder="Unlimited" /></div>
          <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="ca" [(ngModel)]="f.isActive" /><label class="form-check-label" for="ca">Active</label></div></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" [disabled]="!f.code || !f.value" (click)="save()">Save</button></ng-container>
      </wc-modal>
    }
  `
})
export class CouponsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Coupon[]>([]);
  protected form = signal<Coupon | null>(null);
  protected welcome = signal<WelcomeOfferSettings | null>(null);
  protected stats = signal<WelcomeOfferAdmin['stats'] | null>(null);
  protected savingWelcome = signal(false);
  protected hours = [12, 24, 48, 72, 168];
  constructor() {
    this.load();
    this.api.get<WelcomeOfferAdmin>('admin/coupons/welcome').subscribe(r => this.setWelcome(r));
  }

  private setWelcome(r: WelcomeOfferAdmin) {
    if (!this.hours.includes(r.settings.validHours)) this.hours = [...this.hours, r.settings.validHours].sort((a, b) => a - b);
    this.welcome.set({ ...r.settings });
    this.stats.set(r.stats);
  }

  saveWelcome() {
    const w = this.welcome()!;
    this.savingWelcome.set(true);
    this.api.put<WelcomeOfferAdmin>('admin/coupons/welcome', { ...w, maxDiscount: w.discountType === 'Percent' && w.maxDiscount ? w.maxDiscount : null }).subscribe({
      next: r => { this.setWelcome(r); this.savingWelcome.set(false); this.toast.success(r.settings.enabled ? 'Welcome offer saved — new accounts get it' : 'Welcome offer saved (off)'); },
      error: () => this.savingWelcome.set(false)
    });
  }
  load() { this.api.get<Coupon[]>('admin/coupons').subscribe(r => this.rows.set(r)); }

  edit(c: Coupon | null) {
    this.form.set(c ? { ...c, startsAt: c.startsAt?.slice(0, 10) ?? null, endsAt: c.endsAt?.slice(0, 10) ?? null }
      : { id: 0, code: '', discountType: 'Percent', value: 5, minOrderAmount: 0, usedCount: 0, isActive: true });
  }

  save() {
    const f = this.form()!;
    const nul = (v: unknown) => (v === '' || v === undefined ? null : v);
    const body = { ...f, maxDiscount: nul(f.maxDiscount), usageLimit: nul(f.usageLimit), perUserLimit: nul(f.perUserLimit), startsAt: nul(f.startsAt), endsAt: nul(f.endsAt) };
    const req = f.id ? this.api.put(`admin/coupons/${f.id}`, body) : this.api.post('admin/coupons', body);
    req.subscribe(() => { this.form.set(null); this.toast.success('Coupon saved'); this.load(); });
  }

  remove(c: Coupon) { if (confirm(`Delete ${c.code}?`)) this.api.delete(`admin/coupons/${c.id}`).subscribe(() => this.load()); }
}
