import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Coupon } from '../core/models';
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
  constructor() { this.load(); }
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
