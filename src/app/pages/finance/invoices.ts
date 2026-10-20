import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { InvoiceRow, Paged } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';

@Component({
  selector: 'wc-invoices',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Customer invoices</h2>
      <button class="btn btn-sm btn-phoenix-secondary" (click)="api.download('admin/invoices/export', 'sales-register.csv', { from, to })"><i class="bi bi-download me-1"></i>Sales register (CSV)</button>
    </div>
    <p class="page-subtitle">Invoices are numbered per financial year (e.g. WC/26-27/0001) and created automatically when an order is delivered, or from the order page.</p>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <form class="search-box" style="width: 280px" (ngSubmit)="load()"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="s" [(ngModel)]="q" placeholder="Invoice, order or customer" /></form>
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="from" (change)="load()" />
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="to" (change)="load()" />
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Invoice</th><th>Date</th><th>Order</th><th>Customer</th><th class="text-end">Taxable</th><th class="text-end">CGST</th><th class="text-end">SGST</th><th class="text-end">IGST</th><th class="text-end">Total</th><th></th></tr></thead>
          <tbody>
            @for (i of rows().items; track i.id) {
              <tr [class.opacity-50]="i.isCancelled">
                <td><b>{{ i.invoiceNumber }}</b><div class="fs-8 text-muted">{{ i.isTaxInvoice ? 'Tax invoice' : 'Bill of supply' }}@if (i.isCancelled) { · cancelled }</div></td>
                <td>{{ i.invoiceDate | date: 'dd MMM yyyy' }}</td>
                <td><a [routerLink]="['/orders', i.orderId]">#{{ i.orderNumber }}</a></td>
                <td>{{ i.billToName }}</td>
                <td class="text-end">{{ i.taxableAmount | inr: true }}</td>
                <td class="text-end">{{ i.cgst | inr: true }}</td>
                <td class="text-end">{{ i.sgst | inr: true }}</td>
                <td class="text-end">{{ i.igst | inr: true }}</td>
                <td class="text-end fw-bold">{{ i.total | inr: true }}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon" title="Open PDF" (click)="pdf(i, true)"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1" title="Download" (click)="pdf(i, false)"><i class="bi bi-download"></i></button>
                  @if (!i.isCancelled) { <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" title="Cancel invoice" (click)="cancel(i)"><i class="bi bi-x-circle"></i></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="10"><div class="empty-state"><i class="bi bi-file-earmark-text"></i>No invoices yet.</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
    <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />
  `
})
export class InvoicesPage {
  protected api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Paged<InvoiceRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected page = signal(1);
  q = ''; from = ''; to = '';

  constructor() { this.load(); }

  load() {
    this.api.get<Paged<InvoiceRow>>('admin/invoices', { search: this.q, from: this.from, to: this.to, page: this.page() }).subscribe(r => this.rows.set(r));
  }

  pdf(i: InvoiceRow, open: boolean) {
    this.api.download(`admin/invoices/${i.id}/pdf`, `${i.invoiceNumber.replace(/\//g, '-')}.pdf`, undefined, open);
  }

  cancel(i: InvoiceRow) {
    if (!confirm(`Cancel invoice ${i.invoiceNumber}? The number stays used; you can generate a fresh invoice from the order.`)) return;
    this.api.post(`admin/invoices/${i.id}/cancel`).subscribe(() => { this.toast.success('Invoice cancelled'); this.load(); });
  }
}
