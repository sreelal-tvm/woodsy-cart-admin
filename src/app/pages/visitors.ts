import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { environment } from '../../environments/environment';

interface SourceRow { source: string; people: number; guests: number; registered: number; visits: number; seconds: number; }
interface UserRow { id: number; fullName: string; email?: string; phone?: string; visits: number; seconds: number; lastSeenAt: string; orders: number; }
interface Report {
  enabled: boolean; offSince?: string;
  totals: { people: number; guests: number; registered: number; visits: number; seconds: number; onlineNow: number; };
  sources: SourceRow[]; users: UserRow[];
  quiet: { heat: (number | null)[][]; quietHour: number | null; quietAverage: number | null; daysOfData: number; };
  runningSince?: string; restarts: { downAt: string; upAt: string; minutes: number; }[];
}

const SOURCES: Record<string, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: 'bi-instagram' },
  facebook: { label: 'Facebook', icon: 'bi-facebook' },
  threads: { label: 'Threads', icon: 'bi-threads' },
  'google-ads': { label: 'Google Ads', icon: 'bi-badge-ad' },
  google: { label: 'Google search', icon: 'bi-google' },
  other: { label: 'Other websites', icon: 'bi-globe' },
  direct: { label: 'Direct / unknown', icon: 'bi-cursor' }
};

@Component({
  selector: 'wc-visitors',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <h2 class="page-title">Visitors</h2>
        <p class="page-subtitle mb-0">How many people use the store, where they came from and how long they stay. No pages, location or IP addresses are recorded.</p>
      </div>
      <button class="btn btn-sm btn-phoenix-secondary" (click)="load()"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button>
    </div>

    @if (r(); as r) {
      <div class="card mb-3"><div class="card-body d-flex flex-wrap align-items-center gap-3">
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" id="rec" [ngModel]="r.enabled" (ngModelChange)="setEnabled($event)" [disabled]="saving()" />
          <label class="form-check-label fw-bold" for="rec">Record visitor statistics</label>
        </div>
        <span class="text-muted fs-7">
          @if (r.enabled) { On: the store checks in once a minute while a visitor has it on screen. }
          @else { Recording off since {{ r.offSince | date: 'd MMM, h:mm a' }}. Visitors' phones send nothing; numbers below are from before. }
        </span>
        <span class="ms-auto fs-7">
          <a [href]="storefront + '/?wc_nostats=1'" target="_blank" rel="noopener" title="Open this link on each phone / laptop you use, so your own visits aren't counted">Don't count this device</a>
          · <a [href]="storefront + '/?wc_nostats=0'" target="_blank" rel="noopener">Count it again</a>
        </span>
      </div></div>

      <div class="filter-pills mb-3">
        @for (p of periods; track p.days) { <a [class.active]="days === p.days" (click)="days = p.days; load()">{{ p.label }}</a> }
      </div>

      <div class="row g-3 mb-3">
        @for (t of tiles(r); track t.label) {
          <div class="col-6 col-md-4 col-xl-2">
            <div class="card h-100"><div class="card-body">
              <div class="kpi-label">{{ t.label }}</div>
              <div class="kpi-value mt-1">{{ t.value }}</div>
              @if (t.note) { <div class="text-muted fs-8">{{ t.note }}</div> }
            </div></div>
          </div>
        }
      </div>

      <div class="row g-3 mb-3">
        <div class="col-xl-7">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Where visitors came from</h5></div>
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead><tr><th>Source</th><th class="text-end">Visitors</th><th class="text-end">Guests</th><th class="text-end">Registered</th><th class="text-end">Visits</th><th class="text-end">Usage time</th></tr></thead>
                <tbody>
                  @for (s of r.sources; track s.source) {
                    <tr [class.text-muted]="!s.visits">
                      <td class="text-nowrap"><i class="bi me-2" [class]="src(s.source).icon"></i>{{ src(s.source).label }}</td>
                      <td class="text-end fw-bold">{{ s.people }}</td><td class="text-end">{{ s.guests }}</td><td class="text-end">{{ s.registered }}</td>
                      <td class="text-end">{{ s.visits }}</td><td class="text-end text-nowrap">{{ dur(s.seconds) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="card-footer fs-8 text-muted">Add <code>?utm_source=instagram</code>, <code>?utm_source=facebook</code> and <code>?utm_source=threads</code> to your bio links. Product links in new automatic posts are tagged already, and Google Ads is recognised by its own click ID.</div>
          </div>
        </div>
        <div class="col-xl-5">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Server restarts</h5></div>
            <div class="card-body">
              @if (r.runningSince) { <p class="fs-7 mb-2">Running since <b>{{ r.runningSince | date: 'd MMM, h:mm a' }}</b>.</p> }
              @for (x of r.restarts; track x.upAt) {
                <div class="d-flex justify-content-between fs-7 py-1 border-bottom">
                  <span>{{ x.downAt | date: 'd MMM, h:mm a' }} → {{ x.upAt | date: 'h:mm a' }}</span>
                  <span class="text-muted">down {{ dur(x.minutes * 60) }}</span>
                </div>
              } @empty { <p class="text-muted fs-7 mb-0">No restarts recorded yet.</p> }
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header d-flex flex-wrap justify-content-between gap-2">
          <h5 class="mb-0">Quietest time to restart</h5>
          <span class="fs-7 text-muted">Average people on the site, last 8 weeks (India time)</span>
        </div>
        <div class="card-body">
          @if (r.quiet.quietHour !== null) {
            <p class="mb-3"><i class="bi bi-moon-stars text-primary me-1"></i>Best time to restart: <b>{{ hourRange(r.quiet.quietHour) }}</b>
              <span class="text-muted fs-7 ms-1">({{ (r.quiet.quietAverage ?? 0) < 0.1 ? 'almost nobody on the site then' : 'about ' + r.quiet.quietAverage + ' people on the site then' }})</span></p>
          } @else {
            <p class="text-muted fs-7 mb-3">Collecting data: a recommendation appears after about a week ({{ r.quiet.daysOfData }} days so far). Hours when the server was down or recording was off don't count as quiet.</p>
          }
          <div class="table-responsive">
            <table class="heat">
              <thead><tr><th></th>@for (h of hours; track h) { <th>{{ h % 3 === 0 ? hourLabel(h) : '' }}</th> }</tr></thead>
              <tbody>
                @for (row of r.quiet.heat; track $index; let d = $index) {
                  <tr>
                    <th>{{ dayNames[d] }}</th>
                    @for (v of row; track $index; let h = $index) {
                      <td [style.background]="cell(v, max())" [class.none]="v === null" [class.best]="h === r.quiet.quietHour"
                          [title]="dayNames[d] + ' ' + hourRange(h) + ': ' + (v === null ? 'no data yet' : v + ' people on average')"></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h5 class="mb-0">Registered customers who visited</h5></div>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th class="text-end">Visits</th><th class="text-end">Usage time</th><th class="text-end">Orders</th><th>Last seen</th></tr></thead>
            <tbody>
              @for (u of r.users; track u.id) {
                <tr>
                  <td><a class="fw-bold" [routerLink]="['/customers', u.id]">{{ u.fullName }}</a></td>
                  <td class="text-nowrap">{{ u.phone }}</td>
                  <td>@if (u.email) { <a [href]="'mailto:' + u.email">{{ u.email }}</a> }</td>
                  <td class="text-end">{{ u.visits }}</td><td class="text-end text-nowrap">{{ dur(u.seconds) }}</td><td class="text-end">{{ u.orders }}</td>
                  <td class="text-nowrap">{{ u.lastSeenAt | date: 'd MMM, h:mm a' }}</td>
                </tr>
              } @empty { <tr><td colspan="7" class="text-muted text-center py-4">No signed-in customers in this period.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    } @else { <div class="text-muted">Loading…</div> }
  `,
  styles: [`
    .heat { border-collapse: separate; border-spacing: 2px; font-size: .7rem; }
    .heat th { font-weight: 600; color: var(--bs-secondary-color); padding: 0 .25rem; text-align: left; white-space: nowrap; }
    .heat td { width: 1.6rem; min-width: 1.6rem; height: 1.4rem; border-radius: 3px; }
    .heat td.none { background: repeating-linear-gradient(45deg, var(--bs-border-color), var(--bs-border-color) 2px, transparent 2px, transparent 5px) !important; }
    .heat td.best { outline: 2px solid var(--bs-success); outline-offset: -2px; }
  `]
})
export class VisitorsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected r = signal<Report | null>(null);
  protected saving = signal(false);
  protected storefront = environment.storefrontUrl;
  protected days = 7;
  protected readonly periods = [{ days: 0, label: 'Today' }, { days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }];
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  constructor() { this.load(); }

  load() { this.api.get<Report>('admin/visitors', { days: this.days }).subscribe(r => this.r.set(r)); }

  setEnabled(on: boolean) {
    this.saving.set(true);
    this.api.put('admin/visitors/switch', { enabled: on }).subscribe({
      next: () => { this.saving.set(false); this.toast.success(on ? 'Recording switched on' : 'Recording switched off'); this.load(); },
      error: () => { this.saving.set(false); this.load(); }
    });
  }

  protected tiles(r: Report) {
    const t = r.totals;
    return [
      { label: 'Visitors', value: t.people, note: `${t.visits} visits` },
      { label: 'Guests', value: t.guests, note: '' },
      { label: 'Registered', value: t.registered, note: 'signed in at least once' },
      { label: 'Usage time', value: this.dur(t.seconds), note: 'all visitors together' },
      { label: 'Per visitor', value: this.dur(t.people ? t.seconds / t.people : 0), note: 'average' },
      { label: 'On the site now', value: t.onlineNow, note: 'last 2 minutes' }
    ];
  }

  protected src(s: string) { return SOURCES[s] ?? { label: s, icon: 'bi-question-circle' }; }

  protected dur(seconds: number) {
    const m = Math.round(seconds / 60);
    if (m < 1) return seconds > 0 ? '< 1 min' : '0 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  }

  protected max() {
    let max = 0;
    for (const row of this.r()?.quiet.heat ?? []) for (const v of row) if (v !== null && v > max) max = v;
    return max;
  }

  protected cell(v: number | null, max: number) {
    if (v === null) return '';
    const pct = max > 0 ? Math.round(8 + (v / max) * 82) : 8;
    return `color-mix(in srgb, var(--bs-primary) ${pct}%, transparent)`;
  }

  protected hourLabel(h: number) { return h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`; }
  protected hourRange(h: number) {
    const f = (x: number) => { const n = x % 12 || 12; return `${n}`; };
    const ap = (x: number) => (x % 24 < 12 ? 'am' : 'pm');
    return `${f(h)}–${f(h + 1)} ${ap(h + 1)}`;
  }
}
