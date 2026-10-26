import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Paged } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';
import { SocialPostRow, SocialSettings, SocialStatus, SocialSummary, socialStatusCls, socialStatusLabel } from './social-models';

type Tab = 'queue' | 'posted' | 'outdated' | 'failed' | 'settings';
interface PageChoice { id: string; name: string; instagram?: string; }

/** Admin → Marketing → Social media: Instagram and Facebook posting of products. */
@Component({
  selector: 'wc-social',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
      <h2 class="page-title mb-0">Social media</h2>
      @if (sum(); as s) {
        <span [class]="s.connected ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-secondary'">
          {{ s.connected ? 'Connected' + (s.instagram ? ' · @' + s.instagram : '') + (s.page ? ' · ' + s.page : '') : 'Not connected' }}
        </span>
      }
    </div>
    <p class="page-subtitle">Posts your products to Instagram and your Facebook Page — one post per product, at a steady pace. Choose products on the <a routerLink="/products">Products</a> page (tick them, then <b>Post to social media</b>) or on each product's page.</p>

    @if (sum(); as s) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Instagram, last 24 hours</div>
          <div class="kpi-value" [class.text-danger]="s.quota.used >= s.quota.limit">{{ s.quota.used }} / {{ s.quota.limit }}</div>
          <div class="fs-8 text-muted">{{ s.quota.fromMeta ? 'From Instagram' : 'Counted by WoodsyCart' }}</div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Next post</div>
          <div class="kpi-value fs-5">{{ s.nextPostAt ? (s.nextPostAt | date: 'EEE, h:mm a') : '—' }}</div>
          <div class="fs-8 text-muted">{{ queued(s) }} in queue</div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Products posted</div>
          <div class="kpi-value text-success">{{ s.postedProducts }}</div>
          <a class="fs-8" routerLink="/products" [queryParams]="{ social: 'not-posted' }">{{ s.notPosted }} published products not posted yet</a>
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Need attention</div>
          <div class="kpi-value" [class.text-warning]="count(s, 'OutOfDate') + count(s, 'Failed') > 0">{{ count(s, 'OutOfDate') + count(s, 'Failed') }}</div>
          <div class="fs-8 text-muted">{{ count(s, 'OutOfDate') }} out of date · {{ count(s, 'Failed') }} failed</div>
        </div></div>
      </div>
    }

    <div class="filter-pills mb-3">
      @for (t of tabs; track t.key) { <a [class.active]="current() === t.key" (click)="setTab(t.key)">{{ t.label }}</a> }
    </div>

    @if (current() !== 'settings') {
      <div class="card">
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead><tr><th>Product</th><th>Platform</th><th>Status</th><th>{{ current() === 'queue' ? 'Posts at' : 'Posted' }}</th><th></th></tr></thead>
            <tbody>
              @for (r of rows().items; track r.id) {
                <tr>
                  <td>
                    <div class="d-flex gap-2 align-items-center">
                      <img class="thumb" [src]="r.image | media" alt="" loading="lazy" />
                      <div class="min-w-0">
                        <a class="fw-bold d-block text-truncate" style="max-width: 320px" [routerLink]="['/products', r.productId]">{{ r.productName }}</a>
                        @if (r.changes.length) { <span class="fs-8 text-warning">Changed: {{ r.changes.join(', ') }}</span> }
                        @if (r.lastError && r.status !== 'Published') { <span class="fs-8 text-danger d-block">{{ r.lastError }}</span> }
                        @if (r.customCaption) { <span class="fs-8 text-muted d-block">Custom caption</span> }
                      </div>
                    </div>
                  </td>
                  <td><i class="bi me-1" [class.bi-instagram]="r.platform === 'Instagram'" [class.bi-facebook]="r.platform === 'Facebook'"></i>{{ r.platform }}</td>
                  <td><span [class]="cls(r.status)">{{ label(r.status) }}</span></td>
                  <td class="fs-7 text-nowrap">{{ (current() === 'queue' ? r.scheduledAt : r.publishedAt) | date: 'EEE d MMM, h:mm a' }}</td>
                  <td class="text-end text-nowrap">
                    @if (r.permalink) { <a class="btn btn-sm btn-phoenix-secondary" [href]="r.permalink" target="_blank" rel="noopener">View</a> }
                    @if (r.status === 'Queued') { <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'remove')">Remove</button> }
                    @if (r.status === 'Failed') {
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'retry')">Try again</button>
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'remove')">Remove</button>
                    }
                    @if (r.status === 'OutOfDate') {
                      @if (r.platform === 'Instagram') {
                        <button class="btn btn-sm btn-primary ms-1" (click)="copy(r)"><i class="bi bi-clipboard me-1"></i>Copy caption</button>
                        <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'mark-updated')">Mark as updated</button>
                      }
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="replace(r)">Replace post</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state"><i class="bi bi-instagram"></i>{{ emptyText() }}</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />
      @if (current() === 'outdated') {
        <div class="fs-8 text-muted mt-2">Instagram doesn't let apps change a caption after posting. <b>Copy caption</b>, then in the Instagram app open the post → ⋯ → <b>Edit</b>, paste and save, and click <b>Mark as updated</b> here. Likes and comments stay. Facebook posts are updated automatically.</div>
      }
    } @else if (cfg(); as c) {
      <div class="row g-3">
        <div class="col-xl-6">
          <div class="card mb-3"><div class="card-body">
            <h5>Connection</h5>
            @if (c.connected) {
              <div class="fs-7 mb-2">
                <div><i class="bi bi-instagram me-1"></i>Instagram: <b>{{ c.instagramUsername ? '@' + c.instagramUsername : 'not linked to the Page' }}</b></div>
                <div><i class="bi bi-facebook me-1"></i>Facebook Page: <b>{{ c.pageName }}</b></div>
                <div class="text-muted fs-8">Connected {{ c.connectedAt | date: 'd MMM y, h:mm a' }} · Meta app {{ c.metaAppId }}</div>
              </div>
              <div class="d-flex gap-2 mb-3">
                <button class="btn btn-sm btn-phoenix-secondary" (click)="showConnect.set(!showConnect())">Change account</button>
                <button class="btn btn-sm btn-outline-danger" (click)="disconnect()">Disconnect</button>
              </div>
            } @else {
              <p class="fs-7 text-muted">Connect through your Meta app (one-time). Instagram must be a professional account (Business or Creator) linked to your Facebook Page.</p>
            }
            @if (!c.connected || showConnect()) {
              <ol class="fs-8 text-muted ps-3">
                <li>developers.facebook.com → <b>My Apps</b> → your app → <b>App settings → Basic</b>: copy the <b>App ID</b> and <b>App secret</b>.</li>
                <li><b>Tools → Graph API Explorer</b>: pick your app, <b>Get User Access Token</b> with: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>business_management</code>. Allow your Page and Instagram account, then copy the token.</li>
                <li>Paste all three below. Only an encrypted Page token is kept; the secret and this token are not stored.</li>
              </ol>
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">App ID</label><input class="form-control" [(ngModel)]="conn.appId" autocomplete="off" /></div>
                <div class="col-md-6"><label class="form-label">App secret</label><input type="password" class="form-control" [(ngModel)]="conn.appSecret" autocomplete="new-password" /></div>
                <div class="col-12"><label class="form-label">User access token</label><input type="password" class="form-control" [(ngModel)]="conn.userToken" autocomplete="off" /></div>
                @if (pages().length) {
                  <div class="col-12"><label class="form-label">Facebook Page</label>
                    <select class="form-select" [(ngModel)]="conn.pageId">
                      @for (p of pages(); track p.id) { <option [ngValue]="p.id">{{ p.name }}{{ p.instagram ? ' (Instagram @' + p.instagram + ')' : ' (no Instagram linked)' }}</option> }
                    </select></div>
                }
                <div class="col-12"><button class="btn btn-primary btn-sm" (click)="connect()" [disabled]="connecting()">{{ connecting() ? 'Connecting…' : 'Connect' }}</button></div>
              </div>
            }
            @if (!c.publicPhotos) { <div class="alert alert-warning fs-8 mt-3 mb-0">Photos must be reachable on the internet. Posting works on the live and QA servers (Smtp:ApiUrl set to an https address), not on localhost.</div> }
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5>Posting</h5>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="ig" [(ngModel)]="c.instagramEnabled" /><label class="form-check-label" for="ig">Post to Instagram</label></div>
            <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="fb" [(ngModel)]="c.facebookEnabled" /><label class="form-check-label" for="fb">Post to the Facebook Page</label></div>
            <label class="form-label">Posting times (India time, one product each)</label>
            <input class="form-control" [(ngModel)]="c.postTimes" placeholder="11:00, 15:00, 20:30" />
            <div class="form-text mb-3">2–3 posts a day spread out reach more people than many at once. <b>Post now</b> still posts immediately, up to Instagram's daily limit.</div>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aq" [(ngModel)]="c.autoQueueNewProducts" /><label class="form-check-label" for="aq">Add new products to the queue automatically once published (vendor sync and new products)</label></div>
          </div></div>
        </div>

        <div class="col-xl-6">
          <div class="card mb-3"><div class="card-body">
            <h5>Caption</h5>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="pr" [(ngModel)]="c.includePrice" /><label class="form-check-label" for="pr">Include the price</label></div>
            <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="mrp" [(ngModel)]="c.showMrp" [disabled]="!c.includePrice" /><label class="form-check-label" for="mrp">Show MRP and savings</label></div>
            <div class="row g-2 mb-3">
              <div class="col-md-6"><label class="form-label">WhatsApp number</label><input class="form-control" [(ngModel)]="c.whatsApp" placeholder="917892200921" /></div>
              <div class="col-md-6"><label class="form-label">City in captions</label><input class="form-control" [(ngModel)]="c.city" placeholder="Bengaluru" /></div>
              <div class="col-md-8"><label class="form-label">Extra hashtags</label><input class="form-control" [(ngModel)]="c.hashtags" placeholder="#FurnitureBangalore #HomeDecor" /></div>
              <div class="col-md-4"><label class="form-label">Hashtags per post</label><input type="number" class="form-control" [(ngModel)]="c.maxHashtags" min="1" max="30" /></div>
            </div>
            <div class="form-text mb-2">#WoodsyCart, the category and the category + city come first, then your extra hashtags and the product's tags. 3–5 focused hashtags reach better than 30.</div>
            <label class="form-label d-flex justify-content-between"><span>Template</span><a class="fs-8" href="javascript:void(0)" (click)="c.template = c.defaultTemplate">Reset to default</a></label>
            <textarea class="form-control fs-8" rows="18" [(ngModel)]="c.template" style="font-family: var(--bs-font-monospace)"></textarea>
            <div class="form-text">Fields: @for (t of c.tokens; track t) { <code class="me-1">{{ '{' + t + '}' }}</code> } — a line whose field is empty is left out.</div>
          </div></div>
          <div class="text-end"><button class="btn btn-primary" (click)="save()">Save settings</button></div>
        </div>
      </div>
    }
  `
})
export class SocialPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly tab = input<string>();

  protected tabs: { key: Tab; label: string }[] = [
    { key: 'queue', label: 'Queue' }, { key: 'posted', label: 'Posted' }, { key: 'outdated', label: 'Out of date' },
    { key: 'failed', label: 'Failed' }, { key: 'settings', label: 'Settings' }
  ];
  protected current = signal<Tab>('queue');
  protected sum = signal<SocialSummary | null>(null);
  protected rows = signal<Paged<SocialPostRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected page = signal(1);
  protected cfg = signal<SocialSettings | null>(null);
  protected showConnect = signal(false);
  protected connecting = signal(false);
  protected pages = signal<PageChoice[]>([]);
  protected conn: { appId: string; appSecret: string; userToken: string; pageId: string | null } = { appId: '', appSecret: '', userToken: '', pageId: null };
  protected label = socialStatusLabel;
  protected cls = socialStatusCls;

  constructor() {
    effect(() => {
      const t = this.tab() as Tab | undefined;
      untracked(() => this.setTab(t && this.tabs.some(x => x.key === t) ? t : 'queue'));
    });
    this.loadSummary();
  }

  setTab(t: Tab) {
    this.current.set(t);
    this.page.set(1);
    if (t === 'settings') this.loadSettings(); else this.load();
  }

  loadSummary() { this.api.get<SocialSummary>('admin/social/summary').subscribe(s => this.sum.set(s)); }

  loadSettings() {
    this.api.get<SocialSettings>('admin/social/settings').subscribe(c => { this.cfg.set(c); this.conn.appId = c.metaAppId ?? ''; });
  }

  load() {
    const status: Record<string, SocialStatus> = { queue: 'Queued', posted: 'Published', outdated: 'OutOfDate', failed: 'Failed' };
    this.api.get<Paged<SocialPostRow>>('admin/social/posts', { status: status[this.current()], page: this.page(), pageSize: 25 })
      .subscribe(r => this.rows.set(r));
  }

  count(s: SocialSummary, st: SocialStatus) { return (s.counts.Instagram?.[st] ?? 0) + (s.counts.Facebook?.[st] ?? 0); }
  queued(s: SocialSummary) { return this.count(s, 'Queued'); }

  emptyText() {
    return ({ queue: 'Nothing in the queue. Tick products on the Products page and choose "Post to social media".', posted: 'Nothing posted yet.',
      outdated: 'All live posts match their products.', failed: 'No failed posts.', settings: '' })[this.current()];
  }

  act(r: SocialPostRow, action: 'remove' | 'retry' | 'mark-updated') {
    this.api.post(`admin/social/posts/${r.id}/${action}`).subscribe(() => { this.toast.success('Done'); this.load(); this.loadSummary(); });
  }

  replace(r: SocialPostRow) {
    if (!confirm(`Delete the ${r.platform} post of "${r.productName}" and post it again? Likes and comments on the old post are lost.`)) return;
    this.api.post(`admin/social/posts/${r.id}/replace`).subscribe(() => { this.toast.success('Posting again within a minute'); this.load(); this.loadSummary(); });
  }

  copy(r: SocialPostRow) {
    this.api.get<{ caption: string }>(`admin/social/posts/${r.id}/caption`).subscribe(c =>
      navigator.clipboard.writeText(c.caption).then(() => this.toast.success('Caption copied. Paste it into the post in Instagram (⋯ → Edit), then click "Mark as updated".')));
  }

  connect() {
    this.connecting.set(true);
    this.api.post<{ connected: boolean; pages?: PageChoice[]; message?: string }>('admin/social/connect', this.conn).subscribe({
      next: r => {
        this.connecting.set(false);
        if (r.pages?.length) { this.pages.set(r.pages); this.conn.pageId ??= r.pages[0].id; }
        if (r.connected) {
          this.toast.success(r.message ?? 'Connected');
          this.conn.appSecret = ''; this.conn.userToken = ''; this.pages.set([]); this.showConnect.set(false);
          this.loadSettings(); this.loadSummary();
        } else if (r.message) this.toast.info(r.message);
      },
      error: () => this.connecting.set(false)
    });
  }

  disconnect() {
    if (!confirm('Disconnect Instagram and Facebook? Queued posts wait until you connect again.')) return;
    this.api.post('admin/social/disconnect').subscribe(() => { this.toast.success('Disconnected'); this.loadSettings(); this.loadSummary(); });
  }

  save() {
    const c = this.cfg()!;
    this.api.put<SocialSettings>('admin/social/settings', c).subscribe(s => { this.cfg.set(s); this.toast.success('Social media settings saved'); });
  }
}
