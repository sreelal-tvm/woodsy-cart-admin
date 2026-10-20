import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Paged } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { PagerComponent } from '../shared/ui';

type CleanStatus = 'NotProcessed' | 'Clean' | 'Cleaned' | 'NeedsReview' | 'Failed' | 'Restored' | 'Approved';
interface CleanText { text: string; kind: string; action: 'remove' | 'keep' | 'review'; confidence: number; }
interface CleanReport { texts: CleanText[]; style: string; removed: number; kept: number; review: number; inpaintEngine: string; recentred: boolean; enhanced: boolean; status: string; message: string; }
interface CleanItem { id: number; productId: number; productName: string; originalUrl?: string; currentUrl?: string; status: CleanStatus; cleanedAt?: string; report?: CleanReport; }
interface Settings { auto: boolean; removeMarks: boolean; recentre: boolean; enhance: boolean; }
interface Summary { online: boolean; engine: string; pending: number; counts: Partial<Record<CleanStatus, number>>; settings: Settings; }

@Component({
  selector: 'wc-image-cleaning',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, PagerComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
      <h2 class="page-title mb-0">Image clean-up</h2>
      @if (summary(); as s) {
        <span [class]="s.online ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-danger'">
          <i class="bi" [class.bi-circle-fill]="true"></i> Cleaner {{ s.online ? 'running · ' + (s.engine === 'lama' ? 'AI background repair' : 'standard repair') : 'offline' }}
        </span>
      }
    </div>
    <p class="page-subtitle">Removes the vendor's name, website, prices and phone numbers from product photos — dimensions and model codes are kept. Studio photos also get a clean white background and the product centred. Originals are always kept.</p>

    @if (summary(); as s) {
      @if (!s.online) {
        <div class="alert alert-warning fs-7">The image cleaner isn't running. It starts automatically with the API once installed — see <code>tools/image-cleaner/README.md</code>. Photos wait in the queue until it's back.</div>
      }
      <div class="row g-3 mb-3">
        @for (c of cards; track c.status) {
          <div class="col-6 col-md-4 col-xl-2">
            <a class="card card-body cursor-pointer h-100" [class.border-primary]="filter() === c.status" (click)="setFilter(c.status)">
              <div class="kpi-label">{{ c.label }}</div>
              <div class="kpi-value" [class]="c.cls">{{ s.counts[c.status] ?? 0 }}</div>
            </a>
          </div>
        }
      </div>

      <div class="card mb-3">
        <div class="card-body d-flex flex-wrap gap-4 align-items-center">
          <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="ca" [(ngModel)]="settings.auto" (change)="saveSettings()" /><label class="form-check-label" for="ca">Clean new photos automatically (vendor sync &amp; uploads)</label></div>
          <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="cr" [(ngModel)]="settings.removeMarks" (change)="saveSettings()" /><label class="form-check-label" for="cr">Remove vendor name &amp; prices</label></div>
          <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="cc" [(ngModel)]="settings.recentre" (change)="saveSettings()" /><label class="form-check-label" for="cc">White background &amp; centre (studio shots)</label></div>
          <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" id="ce" [(ngModel)]="settings.enhance" (change)="saveSettings()" /><label class="form-check-label" for="ce">Light &amp; colour correction (room shots)</label></div>
          <div class="ms-auto d-flex gap-2 align-items-center">
            @if (s.pending) { <span class="fs-7 text-muted"><span class="spinner-border spinner-border-sm me-1"></span>{{ s.pending }} in queue</span> }
            <button class="btn btn-sm btn-primary" (click)="run('pending')" [disabled]="!s.online"><i class="bi bi-magic me-1"></i>Clean unprocessed photos</button>
            <button class="btn btn-sm btn-phoenix-secondary" (click)="run('all')" [disabled]="!s.online" title="Re-run on every photo except ones you approved or restored">Re-run all</button>
          </div>
        </div>
      </div>
    }

    <div class="filter-pills mb-3">
      <a [class.active]="filter() === null" (click)="setFilter(null)">All photos</a>
      <a [class.active]="changedOnly" (click)="changedOnly = !changedOnly; load()">{{ changedOnly ? '✓ ' : '' }}Only changed photos</a>
    </div>

    <div class="row g-3">
      @for (i of items().items; track i.id) {
        <div class="col-xl-6">
          <div class="card h-100" [class.border-warning]="i.status === 'NeedsReview'">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <a class="fw-bold text-truncate" [routerLink]="['/products', i.productId]" style="max-width: 70%">{{ i.productName }}</a>
                <span [class]="statusCls(i.status)">{{ i.status | humanize }}</span>
              </div>
              <div class="row g-2">
                <div class="col-6">
                  <div class="fs-8 text-muted mb-1">Original (vendor)</div>
                  <a [href]="i.originalUrl | media" target="_blank" rel="noopener"><img [src]="i.originalUrl | media" class="w-100 rounded border" style="aspect-ratio: 1; object-fit: contain; background: #fff" loading="lazy" alt="" /></a>
                </div>
                <div class="col-6">
                  <div class="fs-8 text-muted mb-1">Shown on store</div>
                  <a [href]="i.currentUrl | media" target="_blank" rel="noopener"><img [src]="i.currentUrl | media" class="w-100 rounded border" style="aspect-ratio: 1; object-fit: contain; background: #fff" loading="lazy" alt="" /></a>
                </div>
              </div>
              @if (i.report; as r) {
                <div class="d-flex flex-wrap gap-1 mt-2">
                  @for (t of r.texts; track $index) {
                    <span class="badge-soft" [class.badge-soft-danger]="t.action === 'remove'" [class.badge-soft-success]="t.action === 'keep'" [class.badge-soft-warning]="t.action === 'review'"
                      [title]="t.kind + ' · ' + (t.confidence * 100 | number: '1.0-0') + '% sure'">
                      {{ t.action === 'remove' ? '✕' : t.action === 'keep' ? '✓' : '?' }} {{ t.text }}
                    </span>
                  }
                </div>
                <div class="fs-8 text-muted mt-1">
                  {{ r.style === 'studio' ? 'Studio photo' : 'Room photo' }}{{ r.recentred ? ' · background whitened & centred' : '' }}{{ r.enhanced ? ' · light/colour corrected' : '' }}{{ r.removed ? ' · ' + r.removed + ' mark(s) removed' : '' }}
                  @if (i.cleanedAt) { · {{ i.cleanedAt | date: 'dd MMM, h:mm a' }} }
                </div>
              }
              <div class="d-flex flex-wrap gap-2 mt-2">
                @if (i.originalUrl !== i.currentUrl) {
                  <button class="btn btn-sm btn-success" (click)="act(i, 'approve')"><i class="bi bi-check-lg me-1"></i>Looks good</button>
                  <button class="btn btn-sm btn-phoenix-secondary" (click)="act(i, 'restore')"><i class="bi bi-arrow-counterclockwise me-1"></i>Use original</button>
                } @else if (i.status === 'Restored' || i.status === 'NeedsReview') {
                  <button class="btn btn-sm btn-phoenix-secondary" (click)="act(i, 'approve')" title="Use the cleaned version">Use cleaned version</button>
                }
                <button class="btn btn-sm btn-phoenix-secondary" (click)="act(i, 'reprocess')"><i class="bi bi-arrow-repeat me-1"></i>Re-run</button>
              </div>
            </div>
          </div>
        </div>
      } @empty {
        <div class="col-12"><div class="empty-state"><i class="bi bi-images"></i>No photos in this view.</div></div>
      }
    </div>
    <wc-pager [page]="page()" [pageSize]="24" [total]="items().total" (pageChange)="page.set($event); load()" />
  `
})
export class ImageCleaningPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected summary = signal<Summary | null>(null);
  protected items = signal<Paged<CleanItem>>({ items: [], total: 0, page: 1, pageSize: 24 });
  protected filter = signal<CleanStatus | null>('NeedsReview');
  protected page = signal(1);
  settings: Settings = { auto: true, removeMarks: true, recentre: true, enhance: true };
  changedOnly = false;
  protected cards: { status: CleanStatus; label: string; cls: string }[] = [
    { status: 'NeedsReview', label: 'To review', cls: 'text-warning' },
    { status: 'Cleaned', label: 'Cleaned', cls: 'text-success' },
    { status: 'Clean', label: 'No marks found', cls: '' },
    { status: 'NotProcessed', label: 'Not processed', cls: 'text-muted' },
    { status: 'Approved', label: 'Approved', cls: 'text-success' },
    { status: 'Failed', label: 'Failed', cls: 'text-danger' }
  ];

  constructor() {
    this.loadSummary();
    this.load();
    const t = setInterval(() => { if (this.summary()?.pending) { this.loadSummary(); } }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  loadSummary() {
    this.api.get<Summary>('admin/image-cleaning/summary').subscribe(s => {
      const wasPending = this.summary()?.pending;
      this.summary.set(s);
      this.settings = { ...s.settings };
      if (wasPending && !s.pending) this.load();
    });
  }

  load() {
    this.api.get<Paged<CleanItem>>('admin/image-cleaning', { status: this.filter(), page: this.page(), pageSize: 24, changedOnly: this.changedOnly })
      .subscribe(r => this.items.set(r));
  }

  setFilter(s: CleanStatus | null) { this.filter.set(s); this.page.set(1); this.load(); }

  saveSettings() { this.api.put('admin/image-cleaning/settings', this.settings).subscribe(() => this.toast.success('Clean-up settings saved')); }

  run(scope: string) {
    this.api.post<{ queued: number }>('admin/image-cleaning/run', { scope }).subscribe(r => {
      this.toast.info(`${r.queued} photos queued for clean-up`);
      this.loadSummary();
    });
  }

  act(i: CleanItem, action: 'approve' | 'restore' | 'reprocess') {
    this.api.post(`admin/image-cleaning/${i.id}/${action}`).subscribe(() => {
      this.toast.success(action === 'approve' ? 'Cleaned photo approved' : action === 'restore' ? 'Original photo restored' : 'Photo re-processed');
      this.load();
      this.loadSummary();
    });
  }

  statusCls(s: CleanStatus) {
    return 'badge-soft badge-soft-' + ({ NeedsReview: 'warning', Cleaned: 'success', Approved: 'success', Clean: 'secondary', NotProcessed: 'secondary', Failed: 'danger', Restored: 'info' } as Record<string, string>)[s];
  }
}
