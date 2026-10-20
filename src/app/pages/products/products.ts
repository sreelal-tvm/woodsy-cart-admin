import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Lookups, Paged, ProductRow } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { ModalComponent, PagerComponent } from '../../shared/ui';

@Component({
  selector: 'wc-products',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h2 class="page-title mb-0">Products</h2>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-phoenix-secondary" (click)="api.download('admin/products/export', 'woodsycart-products.csv')"><i class="bi bi-download me-1"></i>Export</button>
        <a class="btn btn-sm btn-primary" routerLink="/products/new"><i class="bi bi-plus-lg me-1"></i>Add product</a>
      </div>
    </div>

    <div class="filter-pills mb-3">
      @for (t of tabs; track t.key) { <a [class.active]="tab() === t.key" (click)="setTab(t.key)">{{ t.label }}</a> }
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3 align-items-center">
      <form class="search-box" style="width: 300px" (ngSubmit)="page.set(1); load()">
        <i class="bi bi-search"></i>
        <input class="form-control form-control-sm" name="s" [(ngModel)]="q" placeholder="Search name, SKU or vendor item id" />
      </form>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="categoryId" (change)="page.set(1); load()">
        <option [ngValue]="null">All categories</option>
        @for (c of lookups()?.categories ?? []; track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
      </select>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="sort" (change)="load()">
        <option value="newest">Newest</option><option value="name">Name</option><option value="price">Price ↑</option>
        <option value="price_desc">Price ↓</option><option value="margin">Lowest margin</option><option value="sold">Best selling</option>
      </select>
      @if (selected().size) {
        <div class="ms-auto d-flex flex-wrap gap-2 align-items-center">
          <span class="fs-7 text-muted">{{ selected().size }} selected</span>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="bulk('publish')">Publish</button>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="bulk('unpublish')">Unpublish</button>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="bulk('feature')">Feature</button>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="bulk('ack-price')">Accept price change</button>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="commissionModal.set(true)">Set commission</button>
          <button class="btn btn-sm btn-phoenix-secondary" (click)="gstModal.set(true)">Set GST %</button>
          <button class="btn btn-sm btn-outline-danger" (click)="bulk('delete')">Delete</button>
        </div>
      }
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead>
            <tr>
              <th style="width: 32px"><input class="form-check-input" type="checkbox" [checked]="allSelected()" (change)="toggleAll()" /></th>
              <th>Product</th><th class="text-end" title="Vendor price + GST">Your cost</th><th class="text-end">Selling price</th><th class="text-end">Margin</th>
              <th>Category</th><th>Status</th><th class="text-end">Sold</th><th>Synced</th>
            </tr>
          </thead>
          <tbody>
            @for (p of rows().items; track p.id) {
              <tr>
                <td><input class="form-check-input" type="checkbox" [checked]="selected().has(p.id)" (change)="toggle(p.id)" /></td>
                <td>
                  <div class="d-flex gap-2 align-items-center">
                    <img class="thumb" [src]="p.imageUrl | media" alt="" loading="lazy" />
                    <div class="min-w-0">
                      <a class="fw-bold d-block text-truncate" style="max-width: 340px" [routerLink]="['/products', p.id]">{{ p.name }}</a>
                      <span class="text-muted fs-8">{{ p.variantsCount ? p.variantsCount + ' variants · ' : '' }}{{ p.source }}{{ p.commissionPercentOverride !== null && p.commissionPercentOverride !== undefined ? ' · ' + p.commissionPercentOverride + '% commission' : '' }}</span>
                    </div>
                  </div>
                </td>
                <td class="text-end">{{ p.vendorCost | inr }}
                  <div class="fs-8 text-muted">{{ p.vendorCost > p.vendorPrice ? (p.vendorPrice | inr) + ' + ' + p.gstRate + '% GST' : 'incl. ' + p.gstRate + '% GST' }}</div>
                  @if (p.vendorPriceChanged) { <div class="fs-8 text-danger fw-bold" title="Vendor changed the price">was {{ p.previousVendorPrice | inr }}</div> }</td>
                <td class="text-end fw-bold">{{ p.sellingPrice | inr }}@if (p.mrp > p.sellingPrice) { <div class="text-quiet fs-8 text-decoration-line-through">{{ p.mrp | inr }}</div> }</td>
                <td class="text-end" [class.text-danger]="p.marginPercent < 8" [class.text-success]="p.marginPercent >= 8">{{ p.margin | inr }}<div class="fs-8">{{ p.marginPercent }}%</div></td>
                <td class="text-muted">{{ p.categoryName }}</td>
                <td>
                  <span [class]="p.isActive ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-secondary'">{{ p.isActive ? 'Published' : 'Draft' }}</span>
                  @if (!p.isAvailable) { <span class="badge-soft badge-soft-danger ms-1">Out of stock</span> }
                  @if (p.isFeatured) { <i class="bi bi-star-fill text-warning ms-1" title="Featured"></i> }
                </td>
                <td class="text-end">{{ p.soldCount }}</td>
                <td class="text-muted fs-8 text-nowrap">{{ p.lastSyncedAt ? (p.lastSyncedAt | date: 'dd MMM, h:mm a') : '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="9"><div class="empty-state"><i class="bi bi-box-seam"></i>No products found. Run a vendor sync to import the catalogue.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    <wc-pager [page]="page()" [pageSize]="pageSize" [total]="rows().total" (pageChange)="page.set($event); load()" />

    @if (gstModal()) {
      <wc-modal title="Set GST % for selected products" (closed)="gstModal.set(false)">
        <label class="form-label">GST rate</label>
        <select class="form-select" [(ngModel)]="gstRate">@for (g of [0, 5, 12, 18, 28]; track g) { <option [ngValue]="g">{{ g }}%</option> }</select>
        <div class="form-text">Used for your cost (vendor price + GST), selling price and customer invoices. Most furniture is 18%.</div>
        <ng-container footer>
          <button class="btn btn-phoenix-secondary" (click)="gstModal.set(false)">Close</button>
          <button class="btn btn-primary" (click)="bulk('gst', gstRate); gstModal.set(false)">Apply</button>
        </ng-container>
      </wc-modal>
    }
    @if (commissionModal()) {
      <wc-modal title="Set commission for selected products" (closed)="commissionModal.set(false)">
        <label class="form-label">Commission %</label>
        <input type="number" class="form-control" [(ngModel)]="commission" placeholder="Leave empty to use category/default" />
        <div class="form-text">Selling price = your cost (vendor price + GST) × (1 + commission %), rounded per your pricing settings.</div>
        <ng-container footer>
          <button class="btn btn-phoenix-secondary" (click)="commissionModal.set(false)">Close</button>
          <button class="btn btn-primary" (click)="bulk('commission', commission); commissionModal.set(false)">Apply</button>
        </ng-container>
      </wc-modal>
    }
  `
})
export class ProductsPage {
  protected api = inject(ApiService);
  private toast = inject(ToastService);
  readonly search = input<string>();
  readonly status = input<string>();

  protected tabs = [
    { key: 'all', label: 'All' }, { key: 'published', label: 'Published' }, { key: 'draft', label: 'Drafts' },
    { key: 'unavailable', label: 'Out of stock' }, { key: 'price-changed', label: 'Vendor price changed' },
    { key: 'featured', label: 'Featured' }, { key: 'low-margin', label: 'Low margin (<8%)' }
  ];
  protected tab = signal('all');
  protected rows = signal<Paged<ProductRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected lookups = signal<Lookups | null>(null);
  protected selected = signal(new Set<number>());
  protected page = signal(1);
  protected commissionModal = signal(false);
  protected gstModal = signal(false);
  gstRate = 18;
  pageSize = 25;
  q = '';
  categoryId: number | null = null;
  sort = 'newest';
  commission: number | null = null;

  constructor() {
    this.api.get<Lookups>('admin/products/lookups').subscribe(l => this.lookups.set(l));
    // Re-run only when the URL's search/status change — not when a tab is clicked (load() reads the tab and page).
    effect(() => {
      const search = this.search(), status = this.status();
      untracked(() => {
        this.q = search ?? '';
        this.tab.set(status ?? 'all');
        this.load();
      });
    });
  }

  setTab(k: string) { this.tab.set(k); this.page.set(1); this.load(); }

  load() {
    this.selected.set(new Set());
    this.api.get<Paged<ProductRow>>('admin/products', {
      search: this.q, categoryId: this.categoryId, status: this.tab() === 'all' ? null : this.tab(), sort: this.sort, page: this.page(), pageSize: this.pageSize
    }).subscribe(r => this.rows.set(r));
  }

  toggle(id: number) {
    const s = new Set(this.selected());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.selected.set(s);
  }
  allSelected() { return this.rows().items.length > 0 && this.rows().items.every(p => this.selected().has(p.id)); }
  toggleAll() { this.selected.set(this.allSelected() ? new Set() : new Set(this.rows().items.map(p => p.id))); }

  bulk(action: string, value: number | null = null) {
    if (action === 'delete' && !confirm(`Delete ${this.selected().size} products? They stay in past orders.`)) return;
    this.api.post('admin/products/bulk', { ids: [...this.selected()], action, value }).subscribe(() => {
      this.toast.success('Products updated');
      this.load();
    });
  }
}
