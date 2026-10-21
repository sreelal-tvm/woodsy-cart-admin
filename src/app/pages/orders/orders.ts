import { Component, inject, input, signal, effect, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CHANNEL_ICON, CHANNEL_LABEL, OrderRow, Paged, SalesChannel } from '../../core/models';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';

interface Tab { key: string; label: string; status?: string; view?: string; }

@Component({
  selector: 'wc-orders',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="page-title mb-0">Orders</h2>
      <div class="d-flex gap-2">
        <button class="btn btn-phoenix-secondary btn-sm" (click)="load()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
        <a class="btn btn-primary btn-sm" routerLink="/orders/new"><i class="bi bi-plus-lg me-1"></i>New order</a>
      </div>
    </div>

    <div class="filter-pills mb-3">
      @for (t of tabs; track t.key) {
        <a [class.active]="tab() === t.key" (click)="selectTab(t)">{{ t.label }}
          @if (t.status && counts()[t.status] !== undefined) { <span class="count">({{ counts()[t.status] }})</span> }
        </a>
      }
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <form class="search-box" style="width: 300px" (ngSubmit)="page.set(1); load()">
        <i class="bi bi-search"></i>
        <input class="form-control form-control-sm" name="s" [(ngModel)]="q" placeholder="Order no, name, phone, email" />
      </form>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="paymentStatus" (change)="page.set(1); load()">
        <option value="">Payment status</option>
        @for (p of ['Pending', 'PartiallyPaid', 'Paid', 'Failed', 'Refunded']; track p) { <option [value]="p">{{ p | humanize }}</option> }
      </select>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="paymentMethod" (change)="page.set(1); load()">
        <option value="">Payment method</option>
        <option value="Upi">UPI</option>
        <option value="Card">Card</option>
        <option value="NetBanking">Net banking</option>
        <option value="Wallet">Wallet</option>
        <option value="Emi">EMI</option>
        <option value="BankTransfer">Bank transfer</option>
        <option value="CashOnDelivery">Cash on delivery</option>
        <option value="Razorpay">Online (older orders)</option>
      </select>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="channel" (change)="page.set(1); load()">
        <option value="">All channels</option>
        @for (c of channelKeys; track c) { <option [value]="c">{{ channelLabel[c] }}</option> }
      </select>
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="from" (change)="load()" title="From" />
      <input type="date" class="form-control form-control-sm w-auto" [(ngModel)]="to" (change)="load()" title="To" />
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th>Order</th><th class="text-end">Total</th><th>Customer</th><th>Payment</th><th>Fulfilment</th>
              <th class="text-center" title="Purchase order · Vendor bill · Invoice">PO · Bill · Inv</th><th class="text-end">Est. margin</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (o of rows().items; track o.id) {
              <tr class="cursor-pointer" (click)="open(o.id)">
                <td><i class="bi {{ channelIcon[o.channel] }} text-muted me-1" [title]="channelLabel[o.channel]"></i><a class="fw-bold" [routerLink]="['/orders', o.id]" (click)="$event.stopPropagation()">#{{ o.orderNumber }}</a>
                  <div class="text-muted fs-8">{{ o.itemCount }} item{{ o.itemCount > 1 ? 's' : '' }}</div></td>
                <td class="text-end fw-bold">{{ o.total | inr }}</td>
                <td>{{ o.customer }}<div class="text-muted fs-8">{{ o.phone }} · {{ o.city }} {{ o.pincode }}</div></td>
                <td><span [class]="o.paymentStatus | statusColor">{{ o.paymentStatus | humanize }}</span>
                  <div class="text-muted fs-8">{{ o.paymentMethod === 'CashOnDelivery' ? 'COD' : (o.paymentMethod | humanize) }}</div></td>
                <td><span [class]="o.status | statusColor">{{ o.status | humanize }}</span></td>
                <td class="text-center">
                  <i class="bi" [class.bi-check-circle-fill]="o.hasPurchaseOrder" [class.text-success]="o.hasPurchaseOrder" [class.bi-circle]="!o.hasPurchaseOrder" [class.text-quiet]="!o.hasPurchaseOrder"></i>
                  <i class="bi mx-1" [class.bi-check-circle-fill]="o.hasVendorBill" [class.text-success]="o.hasVendorBill" [class.bi-circle]="!o.hasVendorBill" [class.text-quiet]="!o.hasVendorBill"></i>
                  <i class="bi" [class.bi-check-circle-fill]="o.hasInvoice" [class.text-success]="o.hasInvoice" [class.bi-circle]="!o.hasInvoice" [class.text-quiet]="!o.hasInvoice"></i>
                </td>
                <td class="text-end" [class.text-danger]="o.total - o.estimatedCost < 0">{{ o.total - o.estimatedCost | inr }}</td>
                <td class="text-muted text-nowrap">{{ o.createdAt | date: 'dd MMM yy, h:mm a' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8"><div class="empty-state"><i class="bi bi-bag"></i>No orders match these filters.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />
  `
})
export class OrdersPage {
  private api = inject(ApiService);
  private router = inject(Router);
  readonly search = input<string>();
  readonly status = input<string>();
  readonly view = input<string>();

  protected tabs: Tab[] = [
    { key: 'all', label: 'All' },
    { key: 'action', label: 'Needs action', view: 'action' },
    { key: 'Pending', label: 'Pending', status: 'Pending' },
    { key: 'Confirmed', label: 'Confirmed', status: 'Confirmed' },
    { key: 'PlacedWithVendor', label: 'With vendor', status: 'PlacedWithVendor' },
    { key: 'Dispatched', label: 'Dispatched', status: 'Dispatched' },
    { key: 'Delivered', label: 'Delivered', status: 'Delivered' },
    { key: 'Cancelled', label: 'Cancelled', status: 'Cancelled' },
    { key: 'no-bill', label: 'Missing vendor bill', view: 'no-bill' },
    { key: 'no-invoice', label: 'Missing invoice', view: 'no-invoice' },
    { key: 'cod-due', label: 'Payment due', view: 'cod-due' }
  ];
  protected tab = signal('all');
  protected rows = signal<Paged<OrderRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected counts = signal<Record<string, number>>({});
  protected page = signal(1);
  q = ''; paymentStatus = ''; paymentMethod = ''; channel = ''; from = ''; to = '';
  protected readonly channelIcon = CHANNEL_ICON;
  protected readonly channelLabel = CHANNEL_LABEL;
  protected readonly channelKeys = Object.keys(CHANNEL_LABEL) as SalesChannel[];
  private current: Tab = this.tabs[0];

  constructor() {
    // Re-run only when the URL's search/status/view change — not when a tab is clicked (load() reads the tab and page).
    effect(() => {
      const search = this.search(), key = this.status() ?? this.view();
      untracked(() => {
        this.q = search ?? '';
        const t = this.tabs.find(x => x.key === key) ?? this.tabs[0];
        this.current = t;
        this.tab.set(t.key);
        this.load();
      });
    });
    this.api.get<Record<string, number>>('admin/orders/counts').subscribe(c => this.counts.set(c));
  }

  selectTab(t: Tab) {
    this.current = t;
    this.tab.set(t.key);
    this.page.set(1);
    this.load();
  }

  load() {
    this.api.get<Paged<OrderRow>>('admin/orders', {
      search: this.q, status: this.current.status, view: this.current.view, paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod, channel: this.channel, from: this.from, to: this.to, page: this.page(), pageSize: 25
    }).subscribe(r => this.rows.set(r));
  }

  open(id: number) { this.router.navigate(['/orders', id]); }
}
