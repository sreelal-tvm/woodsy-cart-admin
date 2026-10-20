import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SyncLog, SyncProgress, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { ModalComponent } from '../../shared/ui';

@Component({
  selector: 'wc-vendors',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Vendor & catalogue sync</h2>
      <button class="btn btn-sm btn-primary" (click)="edit(null)"><i class="bi bi-plus-lg me-1"></i>Add vendor</button>
    </div>
    <p class="page-subtitle">Products, variants, prices and images are imported from the vendor's online store. Your commission is added on top automatically.</p>

    <div class="row g-3">
      @for (v of vendors(); track v.id) {
        <div class="col-xl-6">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h4 class="mb-1">{{ v.name }}</h4>
                  <div class="text-muted fs-7">{{ v.city }}{{ v.state ? ', ' + v.state : '' }} · GSTIN {{ v.gstin || '—' }}</div>
                  @if (v.website) { <a class="fs-7" [href]="v.website" target="_blank" rel="noopener">{{ v.website }}</a> }
                </div>
                <button class="btn btn-sm btn-phoenix-secondary" (click)="edit(v)"><i class="bi bi-pencil"></i></button>
              </div>
              <div class="row text-center my-3">
                <div class="col"><div class="fw-bold fs-5">{{ v.products }}</div><div class="text-muted fs-8">Products</div></div>
                <div class="col"><div class="fw-bold fs-5">{{ v.totalPurchases | inr }}</div><div class="text-muted fs-8">Purchases</div></div>
                <div class="col"><div class="fw-bold fs-5" [class.text-danger]="(v.outstandingAmount ?? 0) > 0">{{ v.outstandingAmount | inr }}</div><div class="text-muted fs-8">Payable</div></div>
              </div>
              <div class="fs-7 mb-3">
                <i class="bi bi-person me-1 text-muted"></i>{{ v.contactPerson || 'No contact person' }}
                · <i class="bi bi-whatsapp mx-1 text-success"></i>{{ v.whatsApp || v.phone || 'No WhatsApp number' }}
                @if (!v.whatsApp && !v.phone) { <span class="text-danger"> — add one to send orders in one click</span> }
              </div>

              @if (v.externalStoreId) {
                <div class="border rounded p-3 bg-body-tertiary">
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                    <span class="fw-bold"><i class="bi bi-arrow-repeat me-1 text-primary"></i>Catalogue sync</span>
                    <span class="fs-8 text-muted">Store id {{ v.externalStoreId }} · {{ v.syncEnabled ? 'auto-sync daily' : 'manual only' }}</span>
                  </div>
                  @if (progress()?.isRunning) {
                    <div class="fs-7 mb-1">{{ progress()!.stage }}… {{ progress()!.processed }} / {{ progress()!.total || '?' }}</div>
                    <div class="progress" style="height: 6px"><div class="progress-bar progress-bar-striped progress-bar-animated" [style.width.%]="pct()"></div></div>
                  } @else {
                    <div class="d-flex flex-wrap gap-3 align-items-center">
                      <div class="form-check fs-7 mb-0"><input class="form-check-input" type="checkbox" id="dl{{ v.id }}" [(ngModel)]="downloadImages" /><label class="form-check-label" for="dl{{ v.id }}">Download images</label></div>
                      <div class="form-check fs-7 mb-0"><input class="form-check-input" type="checkbox" id="pb{{ v.id }}" [(ngModel)]="publishNew" /><label class="form-check-label" for="pb{{ v.id }}">Publish new products</label></div>
                      <button class="btn btn-sm btn-primary ms-auto" (click)="sync(v.id)"><i class="bi bi-cloud-download me-1"></i>Sync now</button>
                    </div>
                    @if (progress()?.lastError) { <div class="text-danger fs-7 mt-2">{{ progress()!.lastError }}</div> }
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <div class="card mt-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Sync history</h5>
        <a class="fs-7 fw-bold" routerLink="/products" [queryParams]="{ status: 'price-changed' }">Review price changes <i class="bi bi-chevron-right"></i></a>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Started</th><th>Duration</th><th>Status</th><th class="text-end">Found</th><th class="text-end">New</th><th class="text-end">Updated</th><th class="text-end">Price changes</th><th class="text-end">Removed</th><th class="text-end">Images</th><th>Message</th></tr></thead>
          <tbody>
            @for (l of logs(); track l.id) {
              <tr>
                <td class="text-nowrap">{{ l.startedAt | date: 'dd MMM, h:mm a' }}</td>
                <td>{{ duration(l) }}</td>
                <td><span [class]="l.status | statusColor">{{ l.status }}</span></td>
                <td class="text-end">{{ l.productsFound }}</td>
                <td class="text-end">{{ l.productsAdded }}</td>
                <td class="text-end">{{ l.productsUpdated }}</td>
                <td class="text-end" [class.text-danger]="l.priceChanges > 0">{{ l.priceChanges }}</td>
                <td class="text-end">{{ l.productsDeactivated }}</td>
                <td class="text-end">{{ l.imagesDownloaded | number }}</td>
                <td class="text-muted fs-7">{{ l.message }}</td>
              </tr>
            } @empty { <tr><td colspan="10" class="text-center text-muted py-4">No syncs yet</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit vendor' : 'Add vendor'" size="lg" (closed)="form.set(null)">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Name</label><input class="form-control" [(ngModel)]="f.name" /></div>
          <div class="col-md-6"><label class="form-label">Contact person</label><input class="form-control" [(ngModel)]="f.contactPerson" /></div>
          <div class="col-md-4"><label class="form-label">Phone</label><input class="form-control" [(ngModel)]="f.phone" /></div>
          <div class="col-md-4"><label class="form-label">WhatsApp</label><input class="form-control" [(ngModel)]="f.whatsApp" placeholder="10-digit mobile" /></div>
          <div class="col-md-4"><label class="form-label">Email</label><input class="form-control" [(ngModel)]="f.email" /></div>
          <div class="col-md-8"><label class="form-label">Address</label><input class="form-control" [(ngModel)]="f.address" /></div>
          <div class="col-md-2"><label class="form-label">City</label><input class="form-control" [(ngModel)]="f.city" /></div>
          <div class="col-md-2"><label class="form-label">State</label><input class="form-control" [(ngModel)]="f.state" /></div>
          <div class="col-md-4"><label class="form-label">GSTIN</label><input class="form-control" [(ngModel)]="f.gstin" /></div>
          <div class="col-md-8"><label class="form-label">Website</label><input class="form-control" [(ngModel)]="f.website" /></div>
          <div class="col-md-6"><label class="form-label">Bank details</label><textarea class="form-control" rows="2" [(ngModel)]="f.bankDetails"></textarea></div>
          <div class="col-md-6"><label class="form-label">Payment terms</label><textarea class="form-control" rows="2" [(ngModel)]="f.paymentTerms"></textarea></div>
          <div class="col-md-4"><label class="form-label">DotPe store id (for sync)</label><input type="number" class="form-control" [(ngModel)]="f.externalStoreId" /></div>
          <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="se" [(ngModel)]="f.syncEnabled" /><label class="form-check-label" for="se">Daily auto-sync</label></div></div>
          <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="va" [(ngModel)]="f.isActive" /><label class="form-check-label" for="va">Active</label></div></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" (click)="save()">Save vendor</button></ng-container>
      </wc-modal>
    }
  `
})
export class VendorsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected vendors = signal<Vendor[]>([]);
  protected logs = signal<SyncLog[]>([]);
  protected progress = signal<SyncProgress | null>(null);
  protected form = signal<Vendor | null>(null);
  downloadImages = true;
  publishNew = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.load();
    this.poll();
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  load() {
    this.api.get<Vendor[]>('admin/vendors').subscribe(v => this.vendors.set(v));
    this.api.get<SyncLog[]>('admin/vendor-sync/logs').subscribe(l => this.logs.set(l));
  }

  private poll() {
    this.api.get<SyncProgress>('admin/vendor-sync/status').subscribe(p => {
      const wasRunning = this.progress()?.isRunning;
      this.progress.set(p);
      if (p.isRunning && !this.timer) this.timer = setInterval(() => this.poll(), 2000);
      if (!p.isRunning && this.timer) { clearInterval(this.timer); this.timer = undefined; }
      if (wasRunning && !p.isRunning) { this.toast.success('Catalogue sync finished'); this.load(); }
    });
  }

  pct() {
    const p = this.progress();
    return p && p.total ? Math.round((p.processed / p.total) * 100) : 5;
  }

  sync(vendorId: number) {
    this.api.post<SyncProgress>('admin/vendor-sync/start', { vendorId, downloadImages: this.downloadImages, publishNewProducts: this.publishNew }).subscribe(p => {
      this.progress.set(p);
      this.toast.info('Sync started — this takes a few minutes.');
      this.poll();
    });
  }

  duration(l: SyncLog) {
    if (!l.finishedAt) return '…';
    const s = Math.round((new Date(l.finishedAt).getTime() - new Date(l.startedAt).getTime()) / 1000);
    return s > 90 ? `${Math.round(s / 60)} min` : `${s}s`;
  }

  edit(v: Vendor | null) {
    this.form.set(v ? { ...v } : { id: 0, name: '', syncEnabled: false, isActive: true, state: 'Karnataka', city: 'Bengaluru' });
  }

  save() {
    const f = this.form()!;
    const req = f.id ? this.api.put(`admin/vendors/${f.id}`, f) : this.api.post('admin/vendors', f);
    req.subscribe(() => { this.form.set(null); this.toast.success('Vendor saved'); this.load(); });
  }
}
