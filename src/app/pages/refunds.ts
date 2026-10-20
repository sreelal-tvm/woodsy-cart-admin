import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { RefundRow, RefundStatus } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

@Component({
  selector: 'wc-refunds',
  imports: [FormsModule, RouterLink, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Returns & refunds</h2>
    <p class="page-subtitle">Customer return requests and refunds for cancelled orders. Mark a refund processed once the money is sent back.</p>
    <div class="filter-pills mb-3">
      @for (s of ['', 'Requested', 'Approved', 'Processed', 'Rejected']; track s) { <a [class.active]="status === s" (click)="status = s; load()">{{ s || 'All' }}</a> }
    </div>
    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Reason</th><th class="text-end">Amount</th><th>Status</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td><a class="fw-bold" [routerLink]="['/orders', r.orderId]">#{{ r.orderNumber }}</a><div class="fs-8 text-muted">{{ r.paymentMethod | humanize }}</div></td>
                <td>{{ r.customer }}</td>
                <td>{{ r.type }}</td>
                <td>{{ r.reason }}@if (r.customerComment) { <div class="text-muted fs-8">{{ r.customerComment }}</div> }</td>
                <td class="text-end fw-bold">{{ r.amount | inr: true }}</td>
                <td><span [class]="r.status | statusColor">{{ r.status }}</span>@if (r.reference) { <div class="fs-8 text-muted">Ref {{ r.reference }}</div> }</td>
                <td class="text-muted">{{ r.createdAt | date: 'dd MMM yyyy' }}</td>
                <td class="text-end">@if (r.status !== 'Processed' && r.status !== 'Rejected') { <button class="btn btn-sm btn-soft-primary" (click)="open(r)">Update</button> }</td>
              </tr>
            } @empty { <tr><td colspan="8"><div class="empty-state"><i class="bi bi-arrow-counterclockwise"></i>Nothing here — great!</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (editing(); as r) {
      <wc-modal [title]="'Refund for #' + r.orderNumber" (closed)="editing.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Status</label>
            <select class="form-select" [(ngModel)]="form.status">@for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }</select></div>
          <div class="col-6"><label class="form-label">Amount</label><input type="number" class="form-control" [(ngModel)]="form.amount" /></div>
          <div class="col-12"><label class="form-label">Refund reference / UTR</label><input class="form-control" [(ngModel)]="form.reference" /></div>
          <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" rows="2" [(ngModel)]="form.adminNotes"></textarea></div>
        </div>
        @if (r.paymentMethod === 'Razorpay') { <div class="alert alert-info py-2 fs-7 mt-3 mb-0">Online payments: issue the refund from your Razorpay dashboard, then paste the refund id here.</div> }
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="editing.set(null)">Close</button><button class="btn btn-primary" (click)="save()">Save</button></ng-container>
      </wc-modal>
    }
  `
})
export class RefundsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<RefundRow[]>([]);
  protected editing = signal<RefundRow | null>(null);
  protected statuses: RefundStatus[] = ['Requested', 'Approved', 'Rejected', 'Processed'];
  status = '';
  form = { status: 'Approved' as RefundStatus, amount: 0, reference: '', adminNotes: '' };

  constructor() { this.load(); }
  load() { this.api.get<RefundRow[]>('admin/refunds', { status: this.status }).subscribe(r => this.rows.set(r)); }

  open(r: RefundRow) {
    this.form = { status: r.status === 'Requested' ? 'Approved' : 'Processed', amount: r.amount, reference: r.reference ?? '', adminNotes: r.adminNotes ?? '' };
    this.editing.set(r);
  }

  save() {
    this.api.put(`admin/refunds/${this.editing()!.id}`, this.form).subscribe(() => { this.editing.set(null); this.toast.success('Refund updated'); this.load(); });
  }
}
