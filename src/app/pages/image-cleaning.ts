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
type BgStatus = 'None' | 'Marked' | 'Queued' | 'Ready' | 'Applied' | 'Discarded' | 'Failed';
interface CleanItem {
  id: number; productId: number; productName: string; originalUrl?: string; currentUrl?: string; status: CleanStatus; cleanedAt?: string; report?: CleanReport;
  background: BgStatus; backgroundUrl?: string; backgroundModel?: 'fast' | 'detailed'; backgroundNote?: string; backgroundAt?: string;
}
interface Settings { auto: boolean; removeMarks: boolean; recentre: boolean; enhance: boolean; }
interface BgSummary { models: Partial<Record<'fast' | 'detailed', boolean>>; pending: number; counts: Partial<Record<BgStatus, number>>; }
interface Summary { online: boolean; engine: string; pending: number; counts: Partial<Record<CleanStatus, number>>; background: BgSummary; settings: Settings; }

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
            <a class="card card-body cursor-pointer h-100" [class.border-primary]="!bgFilter() && filter() === c.status" (click)="setFilter(c.status)">
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

      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-3 align-items-center">
            <div class="fw-bold"><i class="bi bi-square me-1"></i>White background</div>
            <div class="filter-pills m-0">
              @for (b of bgPills; track b.status) {
                <a [class.active]="bgFilter() === b.status" (click)="setBgFilter(b.status)">{{ b.label }} ({{ s.background.counts[b.status] ?? 0 }})</a>
              }
            </div>
            <div class="ms-auto d-flex gap-2 align-items-center">
              @if (s.background.pending) { <span class="fs-7 text-muted"><span class="spinner-border spinner-border-sm me-1"></span>{{ s.background.pending }} being replaced</span> }
              <button class="btn btn-sm btn-primary" (click)="runBackgrounds()" [disabled]="!s.online || !s.background.models.fast || !s.background.counts.Marked">
                <i class="bi bi-magic me-1"></i>Replace background on {{ s.background.counts.Marked ?? 0 }} marked photos
              </button>
            </div>
          </div>
          <div class="fs-8 text-muted mt-2">Mark photos taken in a showroom or factory, then replace their backgrounds in one go (about 6 seconds a photo). Each result waits under <b>Ready to check</b>; the store changes only when you click <b>Use white background</b>. If a cut-out is wrong, <b>Try detailed cut-out</b> (1–2 minutes) usually gets it right.</div>
          @if (s.online && (!s.background.models.fast || !s.background.models.detailed)) {
            <div class="alert alert-warning fs-7 mt-2 mb-0">A background-removal model is missing in <code>tools/image-cleaner/models</code> — see the cleaner's README.</div>
          }
        </div>
      </div>
    }

    <div class="filter-pills mb-3">
      <a [class.active]="!bgFilter() && filter() === null" (click)="setFilter(null)">All photos</a>
      <a [class.active]="changedOnly" (click)="changedOnly = !changedOnly; load()">{{ changedOnly ? '✓ ' : '' }}Only changed photos</a>
    </div>

    <div class="row g-3">
      @for (i of items().items; track i.id) {
        <div class="col-xl-6">
          <div class="card h-100" [class.border-warning]="i.status === 'NeedsReview' || i.background === 'Ready'">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <a class="fw-bold text-truncate" [routerLink]="['/products', i.productId]" style="max-width: 70%">{{ i.productName }}</a>
                <span class="d-flex gap-1">
                  @if (bgLabel[i.background]; as l) { <span [class]="bgCls(i.background)">{{ l }}</span> }
                  <span [class]="statusCls(i.status)">{{ i.status | humanize }}</span>
                </span>
              </div>
              <div class="row g-2">
                <div [class]="showCandidate(i) ? 'col-4' : 'col-6'">
                  <div class="fs-8 text-muted mb-1">Original (vendor)</div>
                  <a [href]="i.originalUrl | media" target="_blank" rel="noopener"><img [src]="i.originalUrl | media" class="w-100 rounded border" style="aspect-ratio: 1; object-fit: contain; background: #fff" loading="lazy" alt="" /></a>
                </div>
                <div [class]="showCandidate(i) ? 'col-4' : 'col-6'">
                  <div class="fs-8 text-muted mb-1">Shown on store</div>
                  <a [href]="i.currentUrl | media" target="_blank" rel="noopener"><img [src]="i.currentUrl | media" class="w-100 rounded border" style="aspect-ratio: 1; object-fit: contain; background: #fff" loading="lazy" alt="" /></a>
                </div>
                @if (showCandidate(i)) {
                  <div class="col-4">
                    <div class="fs-8 text-muted mb-1">White background{{ i.backgroundModel === 'detailed' ? ' (detailed)' : '' }}</div>
                    @if (i.background === 'Queued') {
                      <div class="w-100 rounded border d-flex flex-column align-items-center justify-content-center text-muted fs-8 text-center p-2" style="aspect-ratio: 1">
                        <span class="spinner-border spinner-border-sm mb-2"></span>{{ i.backgroundModel === 'detailed' ? 'Detailed cut-out, 1–2 min…' : 'Cutting out…' }}
                      </div>
                    } @else {
                      <a [href]="i.backgroundUrl | media" target="_blank" rel="noopener"><img [src]="i.backgroundUrl | media" class="w-100 rounded border border-primary" style="aspect-ratio: 1; object-fit: contain; background: #fff" loading="lazy" alt="" /></a>
                    }
                  </div>
                }
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
              <div class="d-flex flex-wrap gap-2 mt-2 pt-2 border-top align-items-center">
                @switch (i.background) {
                  @case ('Queued') { <span class="fs-8 text-muted">Replacing the background…</span> }
                  @case ('Ready') {
                    <button class="btn btn-sm btn-success" (click)="bg(i, 'apply')"><i class="bi bi-check-lg me-1"></i>Use white background</button>
                    @if (i.backgroundModel !== 'detailed') {
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="makeBg(i, 'detailed')" title="Slower (1–2 minutes) but better when the product touches a busy background"><i class="bi bi-scissors me-1"></i>Try detailed cut-out</button>
                    } @else {
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="makeBg(i, 'fast')"><i class="bi bi-arrow-repeat me-1"></i>Try fast cut-out</button>
                    }
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="bg(i, 'discard')">Keep as it was</button>
                  }
                  @case ('Applied') {
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="bg(i, 'discard')"><i class="bi bi-arrow-counterclockwise me-1"></i>Undo white background</button>
                  }
                  @default {
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="makeBg(i, 'fast')" [disabled]="!summary()?.online"><i class="bi bi-square me-1"></i>White background</button>
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="mark(i)" [title]="i.background === 'Marked' ? 'Remove from the next batch run' : 'Add to the next batch run (showroom or factory background)'">
                      <i class="bi me-1" [class.bi-bookmark-check-fill]="i.background === 'Marked'" [class.bi-bookmark]="i.background !== 'Marked'"></i>{{ i.background === 'Marked' ? 'Marked' : 'Mark for batch' }}
                    </button>
                    @if (i.background === 'Failed' && i.backgroundNote) { <span class="fs-8 text-danger">Failed: {{ i.backgroundNote }}</span> }
                  }
                }
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
  protected bgFilter = signal<BgStatus | null>(null);
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

  protected bgPills: { status: BgStatus; label: string }[] = [
    { status: 'Marked', label: 'Marked' },
    { status: 'Ready', label: 'Ready to check' },
    { status: 'Applied', label: 'On store' },
    { status: 'Failed', label: 'Failed' }
  ];
  protected bgLabel: Partial<Record<BgStatus, string>> = {
    Marked: 'Marked for white background', Queued: 'Replacing background', Ready: 'White background to check', Applied: 'White background', Failed: 'Background failed'
  };

  constructor() {
    this.loadSummary();
    this.load();
    const t = setInterval(() => { if (this.busy(this.summary())) { this.loadSummary(); this.load(); } }, 4000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  loadSummary() {
    this.api.get<Summary>('admin/image-cleaning/summary').subscribe(s => {
      const wasBusy = this.busy(this.summary());
      this.summary.set(s);
      this.settings = { ...s.settings };
      if (wasBusy && !this.busy(s)) this.load();
    });
  }

  load() {
    this.api.get<Paged<CleanItem>>('admin/image-cleaning', { status: this.bgFilter() ? null : this.filter(), background: this.bgFilter(), page: this.page(), pageSize: 24, changedOnly: this.changedOnly })
      .subscribe(r => this.items.set(r));
  }

  setFilter(s: CleanStatus | null) { this.filter.set(s); this.bgFilter.set(null); this.page.set(1); this.load(); }
  setBgFilter(s: BgStatus) { this.bgFilter.set(this.bgFilter() === s ? null : s); this.page.set(1); this.load(); }

  private busy(s: Summary | null) { return !!(s?.pending || s?.background.pending); }
  protected showCandidate(i: CleanItem) { return i.background === 'Ready' || i.background === 'Queued'; }

  makeBg(i: CleanItem, model: 'fast' | 'detailed') {
    this.api.post(`admin/image-cleaning/${i.id}/background`, { model }).subscribe(() => {
      this.toast.info(model === 'detailed' ? 'Detailed cut-out started — about 1–2 minutes' : 'Replacing the background…');
      this.load();
      this.loadSummary();
    });
  }

  bg(i: CleanItem, action: 'apply' | 'discard') {
    this.api.post(`admin/image-cleaning/${i.id}/background/${action}`).subscribe(() => {
      this.toast.success(action === 'apply' ? 'White background is now on the store' : 'Photo kept as it was');
      this.load();
      this.loadSummary();
    });
  }

  mark(i: CleanItem) {
    const marked = i.background !== 'Marked';
    this.api.post('admin/image-cleaning/background/mark', { ids: [i.id], marked }).subscribe(() => {
      i.background = marked ? 'Marked' : 'None';
      this.loadSummary();
    });
  }

  runBackgrounds() {
    this.api.post<{ queued: number }>('admin/image-cleaning/background/run').subscribe(r => {
      this.toast.info(`${r.queued} photos queued for a white background`);
      this.loadSummary();
      this.load();
    });
  }

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

  bgCls(s: BgStatus) {
    return 'badge-soft badge-soft-' + ({ Marked: 'info', Queued: 'secondary', Ready: 'warning', Applied: 'success', Failed: 'danger' } as Record<string, string>)[s];
  }
}
