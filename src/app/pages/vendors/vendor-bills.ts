import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Paged, Vendor, VendorBill } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';
import { ModalComponent, PagerComponent } from '../../shared/ui';

interface BillForm {
  id?: number; vendorId: number; orderId: number | null; orderNumber?: string; billNumber: string; billDate: string; dueDate: string;
  taxableAmount: number; gstAmount: number; shippingCharges: number; fileUrl: string; notes: string;
}

@Component({
  selector: 'wc-vendor-bills',
  imports: [FormsModule, RouterLink, DatePipe, ModalComponent, PagerComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Vendor bills</h2>
      <button class="btn btn-sm btn-primary" (click)="newBill()"><i class="bi bi-plus-lg me-1"></i>Add bill</button>
    </div>
    <p class="page-subtitle">Bills from your vendor. Link each bill to its order so profit is calculated on the actual cost.</p>

    @if (summary(); as s) {
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3"><div class="card card-body"><div class="kpi-label">Outstanding</div><div class="kpi-value text-danger">{{ s.outstanding | inr }}</div></div></div>
        <div class="col-6 col-md-3"><div class="card card-body"><div class="kpi-label">Overdue</div><div class="kpi-value">{{ s.overdue | inr }}</div></div></div>
        <div class="col-6 col-md-3"><div class="card card-body"><div class="kpi-label">Billed this month</div><div class="kpi-value">{{ s.thisMonth | inr }}</div></div></div>
        <div class="col-6 col-md-3"><a class="card card-body" routerLink="/orders" [queryParams]="{ view: 'no-bill' }"><div class="kpi-label">Orders missing a bill</div><div class="kpi-value text-warning">{{ s.ordersWithoutBill }}</div></a></div>
      </div>
    }

    <div class="d-flex flex-wrap gap-2 mb-3">
      <form class="search-box" style="width: 260px" (ngSubmit)="load()"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="s" [(ngModel)]="q" placeholder="Bill or order no" /></form>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="status" (change)="load()">
        <option value="">All</option><option value="Unpaid">Unpaid</option><option value="PartiallyPaid">Partially paid</option><option value="Paid">Paid</option>
      </select>
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="from" (change)="load()" />
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="to" (change)="load()" />
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Bill</th><th>Vendor</th><th>Order</th><th class="text-end">Taxable</th><th class="text-end">GST</th><th class="text-end">Total</th><th class="text-end">Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            @for (b of rows().items; track b.id) {
              <tr>
                <td><b>{{ b.billNumber }}</b><div class="text-muted fs-8">{{ b.billDate | date: 'dd MMM yyyy' }}@if (b.dueDate) { · due {{ b.dueDate | date: 'dd MMM' }} }</div></td>
                <td>{{ b.vendorName }}</td>
                <td>@if (b.orderId) { <a [routerLink]="['/orders', b.orderId]">#{{ b.orderNumber }}</a> } @else { <span class="text-muted">General</span> }</td>
                <td class="text-end">{{ b.taxableAmount | inr: true }}</td>
                <td class="text-end">{{ b.gstAmount | inr: true }}</td>
                <td class="text-end fw-bold">{{ b.totalAmount | inr: true }}</td>
                <td class="text-end">{{ b.amountPaid | inr: true }}</td>
                <td><span [class]="b.paymentStatus | statusColor">{{ b.paymentStatus | humanize }}</span></td>
                <td class="text-end text-nowrap">
                  @if (b.fileUrl) { <a class="btn btn-sm btn-phoenix-secondary btn-icon" [href]="b.fileUrl | media" target="_blank" rel="noopener" title="View bill"><i class="bi bi-paperclip"></i></a> }
                  @if (b.paymentStatus !== 'Paid') { <button class="btn btn-sm btn-soft-primary ms-1" (click)="pay(b)">Pay</button> }
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1" (click)="editBill(b)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(b)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="9"><div class="empty-state"><i class="bi bi-receipt"></i>No vendor bills yet.</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
    <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit vendor bill' : 'Add vendor bill'" (closed)="form.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Vendor</label><select class="form-select" [(ngModel)]="f.vendorId">@for (v of vendors(); track v.id) { <option [ngValue]="v.id">{{ v.name }}</option> }</select></div>
          <div class="col-6"><label class="form-label">Order ID (optional)</label><input type="number" class="form-control" [(ngModel)]="f.orderId" placeholder="Internal order id" />
            @if (f.orderNumber) { <div class="form-text">Linked to #{{ f.orderNumber }}</div> }</div>
          <div class="col-6"><label class="form-label">Bill number</label><input class="form-control" [(ngModel)]="f.billNumber" /></div>
          <div class="col-3"><label class="form-label">Bill date</label><input type="date" class="form-control" [(ngModel)]="f.billDate" /></div>
          <div class="col-3"><label class="form-label">Due date</label><input type="date" class="form-control" [(ngModel)]="f.dueDate" /></div>
          <div class="col-4"><label class="form-label">Taxable value</label><input type="number" class="form-control" [(ngModel)]="f.taxableAmount" /></div>
          <div class="col-4"><label class="form-label">GST</label><input type="number" class="form-control" [(ngModel)]="f.gstAmount" /></div>
          <div class="col-4"><label class="form-label">Delivery charges</label><input type="number" class="form-control" [(ngModel)]="f.shippingCharges" /></div>
          <div class="col-12 fs-7 text-muted">Total: <b>{{ f.taxableAmount + f.gstAmount + f.shippingCharges | inr: true }}</b></div>
          <div class="col-12"><label class="form-label">Bill file</label><input type="file" class="form-control" accept=".pdf,image/*" (change)="upload($event)" />
            @if (f.fileUrl) { <a class="fs-7" [href]="f.fileUrl | media" target="_blank" rel="noopener">View attached file</a> }</div>
          <div class="col-12"><label class="form-label">Notes</label><input class="form-control" [(ngModel)]="f.notes" /></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" [disabled]="!f.billNumber" (click)="save()">Save</button></ng-container>
      </wc-modal>
    }

    @if (paying(); as b) {
      <wc-modal [title]="'Pay bill ' + b.billNumber" (closed)="paying.set(null)">
        <p class="fs-7 text-muted">Balance: <b>{{ b.totalAmount - b.amountPaid | inr: true }}</b></p>
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Amount</label><input type="number" class="form-control" [(ngModel)]="payForm.amount" /></div>
          <div class="col-6"><label class="form-label">Paid on</label><input type="date" class="form-control" [(ngModel)]="payForm.paidOn" /></div>
          <div class="col-12"><label class="form-label">Reference / UTR</label><input class="form-control" [(ngModel)]="payForm.reference" /></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="paying.set(null)">Close</button><button class="btn btn-primary" (click)="savePay()">Record payment</button></ng-container>
      </wc-modal>
    }
  `
})
export class VendorBillsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly statusParam = input<string>(undefined, { alias: 'status' });
  protected rows = signal<Paged<VendorBill>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected summary = signal<{ outstanding: number; overdue: number; thisMonth: number; ordersWithoutBill: number } | null>(null);
  protected vendors = signal<Vendor[]>([]);
  protected form = signal<BillForm | null>(null);
  protected paying = signal<VendorBill | null>(null);
  protected page = signal(1);
  q = ''; status = ''; from = ''; to = '';
  payForm = { amount: 0, paidOn: isoDate(new Date()), reference: '' };

  constructor() {
    this.api.get<Vendor[]>('admin/vendors').subscribe(v => this.vendors.set(v));
    // Only the URL's status triggers a reload here; paging calls load() itself.
    effect(() => { const status = this.statusParam(); untracked(() => { this.status = status ?? ''; this.load(); }); });
  }

  load() {
    this.api.get<Paged<VendorBill>>('admin/vendor-bills', { search: this.q, status: this.status, from: this.from, to: this.to, page: this.page() }).subscribe(r => this.rows.set(r));
    this.api.get<{ outstanding: number; overdue: number; thisMonth: number; ordersWithoutBill: number }>('admin/vendor-bills/summary').subscribe(s => this.summary.set(s));
  }

  newBill() {
    this.form.set({ vendorId: this.vendors()[0]?.id ?? 0, orderId: null, billNumber: '', billDate: isoDate(new Date()), dueDate: '', taxableAmount: 0, gstAmount: 0, shippingCharges: 0, fileUrl: '', notes: '' });
  }

  editBill(b: VendorBill) {
    this.form.set({
      id: b.id, vendorId: b.vendorId, orderId: b.orderId ?? null, orderNumber: b.orderNumber, billNumber: b.billNumber, billDate: b.billDate.slice(0, 10),
      dueDate: b.dueDate?.slice(0, 10) ?? '', taxableAmount: b.taxableAmount, gstAmount: b.gstAmount, shippingCharges: b.shippingCharges, fileUrl: b.fileUrl ?? '', notes: b.notes ?? ''
    });
  }

  upload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'bills' }).subscribe(r => this.form.update(f => f ? { ...f, fileUrl: r.url } : f));
  }

  save() {
    const f = this.form()!;
    const body = { ...f, orderId: f.orderId || null, dueDate: f.dueDate || null, fileUrl: f.fileUrl || null };
    const req = f.id ? this.api.put(`admin/vendor-bills/${f.id}`, body) : this.api.post('admin/vendor-bills', body);
    req.subscribe(() => { this.form.set(null); this.toast.success('Bill saved'); this.load(); });
  }

  pay(b: VendorBill) {
    this.payForm = { amount: b.totalAmount - b.amountPaid, paidOn: isoDate(new Date()), reference: '' };
    this.paying.set(b);
  }

  savePay() {
    this.api.post(`admin/vendor-bills/${this.paying()!.id}/payments`, this.payForm).subscribe(() => { this.paying.set(null); this.toast.success('Payment recorded'); this.load(); });
  }

  remove(b: VendorBill) {
    if (!confirm(`Delete bill ${b.billNumber}?`)) return;
    this.api.delete(`admin/vendor-bills/${b.id}`).subscribe(() => this.load());
  }
}
