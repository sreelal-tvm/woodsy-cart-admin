import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { environment } from '../../environments/environment';

interface Campaign { id: number; createdAt: string; kind: string; title: string; body: string; url: string; imageUrl?: string; audience: string;
  devices: number; sent: number; failed: number; createdBy?: string; }
interface Audience { all: number; ordered: number; notOrdered: number; }

const LINKS = [
  { label: 'Home', url: '/' }, { label: 'Shop', url: '/shop' }, { label: 'Offers', url: '/offers' },
  { label: 'Newest', url: '/shop?sort=newest' }, { label: 'Deals', url: '/shop?sort=discount' }, { label: 'Cart', url: '/cart' }
];
const KINDS: Record<string, string | undefined> = { Custom: 'Written here', OfferLive: 'Offer is live', NewArrivals: 'New arrivals' };
const AUDIENCES: Record<string, string | undefined> = { All: 'Everyone', Ordered: 'Bought before', NotOrdered: 'Not ordered yet' };

/** Admin → Email & notifications → Send notification: write an app notification to customers, test it, and see what went out. */
@Component({
  selector: 'wc-push-send',
  imports: [FormsModule, DatePipe],
  styles: [`
    .link-chip { border: 1px solid var(--bs-border-color); border-radius: 2rem; padding: .2rem .7rem; background: transparent; font-size: .8rem; font-weight: 600; }
    .link-chip.on { border-color: #9A5226; background: rgba(154, 82, 38, .08); color: #9A5226; }
    .phone { background: #1f1b18; border-radius: 1.4rem; padding: 1rem .8rem 1.4rem; }
    .ntf { background: rgba(255, 255, 255, .94); color: #1f1b18; border-radius: 1rem; padding: .7rem .8rem; font-size: .85rem; }
    .ntf img.icon { width: 1.1rem; height: 1.1rem; border-radius: .3rem; }
    .ntf .big { width: 100%; max-height: 11rem; object-fit: cover; border-radius: .6rem; margin-top: .5rem; }
    .aud { border: 1px solid var(--bs-border-color); border-radius: .6rem; padding: .5rem .75rem; cursor: pointer; flex: 1 1 9rem; }
    .aud.on { border-color: #9A5226; background: rgba(154, 82, 38, .06); }
  `],
  template: `
    <div class="row g-3">
      <div class="col-xl-7">
        <div class="card"><div class="card-body">
          <h5 class="mb-1">Send a notification to customers</h5>
          <p class="text-muted fs-7">Goes to every customer phone with notifications on that allows offers. Tapping it opens the page you choose.</p>

          <label class="form-label d-flex justify-content-between">Title <span class="text-muted fw-normal">{{ title.length }}/65</span></label>
          <input class="form-control mb-3" [(ngModel)]="title" maxlength="65" placeholder="Diwali sale is live 🪔" />

          <label class="form-label d-flex justify-content-between">Message <span class="text-muted fw-normal">{{ body.length }}/180</span></label>
          <textarea class="form-control mb-3" rows="3" [(ngModel)]="body" maxlength="180" placeholder="Up to 20% off on sofas and beds — this weekend only."></textarea>

          <label class="form-label">Opens</label>
          <div class="d-flex flex-wrap gap-2 mb-2">
            @for (l of links; track l.url) { <button type="button" class="link-chip" [class.on]="url === l.url" (click)="url = l.url">{{ l.label }}</button> }
          </div>
          <input class="form-control mb-1" [(ngModel)]="url" [placeholder]="store + '/product/…'" />
          <div class="form-text mb-3">A page of the store: pick one above, or paste a product, offer or category link.</div>

          <label class="form-label">Picture <span class="text-muted fw-normal">(optional)</span></label>
          <input class="form-control mb-1" [(ngModel)]="image" placeholder="https://… (wide picture)" />
          <div class="form-text mb-3">Leave empty: a product link shows the product's photo, an offer link its banner.</div>

          <label class="form-label">Send to</label>
          <div class="d-flex flex-wrap gap-2 mb-3">
            @for (a of audienceKeys; track a) {
              <label class="aud" [class.on]="audience === a"><input class="form-check-input me-2" type="radio" name="aud" [value]="a" [(ngModel)]="audience" />
                <b>{{ audiences[a] }}</b> <span class="text-muted fs-7 d-block">{{ count(a) }} device{{ count(a) === 1 ? '' : 's' }}</span></label>
            }
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <button class="btn btn-phoenix-secondary" [disabled]="busy()" (click)="test()"><i class="bi bi-phone me-1"></i>Send a test to my devices</button>
            <button class="btn btn-primary" [disabled]="busy() || !count(audience)" (click)="send()"><i class="bi bi-send me-1"></i>Send to {{ count(audience) }} device{{ count(audience) === 1 ? '' : 's' }}</button>
          </div>
        </div></div>
      </div>

      <div class="col-xl-5">
        <div class="phone mb-3">
          <div class="ntf">
            <div class="d-flex align-items-center gap-2 mb-1 fs-8 text-muted"><img class="icon" src="icons/icon-96x96.png" alt="" />WoodsyCart · now</div>
            <b class="d-block">{{ title || 'Title' }}</b>
            <div>{{ body || 'Your message' }}</div>
            @if (image) { <img class="big" [src]="image" alt="" /> }
          </div>
        </div>
        <p class="text-muted fs-8">How it looks differs a little between phones. Android shows the picture when the notification is expanded.</p>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-body pb-0"><h5 class="mb-0">Sent notifications</h5><p class="text-muted fs-7">Written here, plus offers and new arrivals sent automatically.</p></div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead><tr><th>When</th><th>Notification</th><th>To</th><th class="text-end">Devices</th><th class="text-end">Delivered</th></tr></thead>
          <tbody>
            @for (c of history(); track c.id) {
              <tr>
                <td class="text-nowrap text-muted fs-7">{{ c.createdAt | date: 'dd MMM, h:mm a' }}<div class="fs-8">{{ kinds[c.kind] ?? c.kind }}</div></td>
                <td class="fs-7"><b>{{ c.title }}</b><div class="text-muted">{{ c.body }}</div><a class="fs-8" [href]="c.url" target="_blank" rel="noopener">Opens {{ path(c.url) }}</a></td>
                <td class="fs-7 text-nowrap">{{ audiences[c.audience] ?? c.audience }}@if (c.createdBy && c.createdBy !== 'Automatic') { <div class="fs-8 text-muted">by {{ c.createdBy }}</div> }</td>
                <td class="text-end">{{ c.devices }}</td>
                <td class="text-end">{{ c.sent }}@if (c.failed) { <div class="fs-8 text-danger">{{ c.failed }} failed</div> }</td>
              </tr>
            } @empty { <tr><td colspan="5"><div class="empty-state"><i class="bi bi-bell"></i>Nothing sent yet.</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class PushSendComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected readonly store = environment.storefrontUrl.replace(/\/$/, '');
  protected readonly links = LINKS;
  protected readonly kinds = KINDS;
  protected readonly audiences = AUDIENCES;
  protected readonly audienceKeys = ['All', 'Ordered', 'NotOrdered'];
  protected history = signal<Campaign[]>([]);
  protected counts = signal<Audience | null>(null);
  protected busy = signal(false);
  title = '';
  body = '';
  url = '/offers';
  image = '';
  audience = 'All';

  constructor() { this.load(); }

  load() {
    this.api.get<Campaign[]>('admin/push/campaigns').subscribe(h => this.history.set(h));
    this.api.get<Audience>('admin/push/campaigns/audience').subscribe(c => this.counts.set(c));
  }

  count(a: string) {
    const c = this.counts();
    return !c ? 0 : a === 'Ordered' ? c.ordered : a === 'NotOrdered' ? c.notOrdered : c.all;
  }

  path(url: string) { try { const u = new URL(url); return u.pathname + (u.searchParams.get('sort') ? '?sort=' + u.searchParams.get('sort') : ''); } catch { return url; } }

  private request() { return { title: this.title, body: this.body, url: this.url, imageUrl: this.image || null, audience: this.audience }; }

  test() {
    this.busy.set(true);
    this.api.post<{ devices: number }>('admin/push/campaigns/test', this.request()).subscribe({
      next: r => { this.busy.set(false); this.toast.success(`Test sent to your ${r.devices} device${r.devices === 1 ? '' : 's'}`); },
      error: () => this.busy.set(false)
    });
  }

  send() {
    const n = this.count(this.audience);
    if (!confirm(`Send "${this.title}" to ${n} customer device${n === 1 ? '' : 's'} now? This can't be undone.`)) return;
    this.busy.set(true);
    this.api.post<Campaign>('admin/push/campaigns', this.request()).subscribe({
      next: c => {
        this.busy.set(false);
        this.toast.success(`Sending to ${c.devices} device${c.devices === 1 ? '' : 's'}`);
        this.title = ''; this.body = ''; this.image = '';
        this.load();
        setTimeout(() => this.load(), 8000); // delivered counts come in as it sends
      },
      error: () => this.busy.set(false)
    });
  }
}
