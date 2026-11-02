import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/api.service';
import { CategoryRow, Paged, ProductRow } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

type OfferStatus = 'live' | 'upcoming' | 'ended' | 'off';
type Scope = 'AllProducts' | 'Categories' | 'Products';
type Repeat = 'Once' | 'Daily' | 'Weekly' | 'MonthlyWeekday' | 'MonthlyDates';
type Rounding = 'None' | 'EndWith99' | 'Nearest10' | 'Nearest100';
interface OfferWindow { startsAt: string; endsAt: string; }
interface OfferStats { orders: number; units: number; revenue: number; discountGiven: number; margin: number; }
interface OfferRow {
  id: number; name: string; slug: string; tagline?: string; bannerImageUrl?: string; themeColor: string;
  startsAt: string; endsAt: string; status: OfferStatus; isActive: boolean; showOnHome: boolean; sortOrder: number;
  discountType: 'Percent' | 'Flat'; value: number; maxDiscount?: number; scope: Scope; productsOnOffer: number; stats: OfferStats;
  repeat: Repeat; schedule?: string; window?: OfferWindow; excluded: number;
}
interface PickedProduct { id: number; name: string; imageUrl?: string; price: number; }
interface OfferForm {
  id: number; name: string; slug: string; tagline: string; description: string; bannerImageUrl?: string; themeColor: string;
  startsAt: string; endsAt: string; isActive: boolean; showOnHome: boolean; sortOrder: number;
  discountType: 'Percent' | 'Flat'; value: number | null; maxDiscount: number | null; minMarginPercent: number; scope: Scope; couponCode: string;
  categoryIds: number[]; products: PickedProduct[];
  repeat: Repeat; repeatDays: number[]; repeatWeeks: number[]; windowStart: string; windowMinutes: number;
  rounding: Rounding; notify: boolean; excludedProducts: PickedProduct[];
  /** Repeating deals: the first and last day (the API keeps startsAt / endsAt). */
  fromDate: string; untilDate: string;
}
interface Preview { products: number; limitedByMargin: number; nextWindows?: OfferWindow[]; }

/** Ready-made starting points; dates are left for you to set. Flash deals also fill in their schedule. */
const TEMPLATES: { name: string; tagline: string; color: string; flash?: Partial<OfferForm> }[] = [
  { name: 'Monday Flash Deal', tagline: '15 minutes only — flash prices every Monday at 8 pm', color: '#f59f00',
    flash: { repeat: 'Weekly', repeatDays: [1], windowStart: '20:00', windowMinutes: 15 } },
  { name: 'Weekend Flash Sale', tagline: 'One hour of flash prices every Saturday and Sunday', color: '#d6336c',
    flash: { repeat: 'Weekly', repeatDays: [0, 6], windowStart: '19:00', windowMinutes: 60 } },
  { name: 'Payday Deal', tagline: 'Salary day treat — 30 minutes of special prices', color: '#0c8599',
    flash: { repeat: 'MonthlyDates', repeatDays: [1], windowStart: '19:30', windowMinutes: 30 } },
  { name: 'Diwali Offers', tagline: 'Light up your home — festive prices on furniture', color: '#e8590c' },
  { name: 'Onam Offers', tagline: 'Onam special — new furniture for the season', color: '#2b8a3e' },
  { name: 'Christmas Sale', tagline: 'Merry Christmas — gift your home something new', color: '#c92a2a' },
  { name: 'New Year Sale', tagline: 'Start the year with a fresh look', color: '#5f3dc4' },
  { name: 'Republic Day Sale', tagline: 'Big savings this Republic Day', color: '#1971c2' }
];

/** "2026-11-01T10:00" in the browser's time (IST) ⇄ ISO UTC for the API. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** "2026-11-01" for a date input. */
const toDateInput = (d: Date) => toLocalInput(d.toISOString()).slice(0, 10);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS = [{ value: 1, label: '1st' }, { value: 2, label: '2nd' }, { value: 3, label: '3rd' }, { value: 4, label: '4th' }, { value: 5, label: 'Last' }];
const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

@Component({
  selector: 'wc-offers',
  imports: [FormsModule, DatePipe, DecimalPipe, ModalComponent, ...SHARED_PIPES],
  styles: [`
    .offer-card { border-left: 4px solid var(--offer-color); }
    .offer-banner { width: 120px; height: 64px; object-fit: cover; border-radius: .5rem; background: var(--phoenix-gray-100, #F3EEE7); }
    .offer-swatch { width: 120px; height: 64px; border-radius: .5rem; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; text-align: center; font-size: .8rem; padding: .25rem; }
    .stat .label { font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; color: var(--phoenix-gray-600, #6B5A4E); }
    .stat .value { font-weight: 700; }
    .pick-list { max-height: 220px; overflow: auto; }
    .pick-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: .375rem; }
    .cat-grid { columns: 2; max-height: 220px; overflow: auto; }
    .banner-preview { width: 100%; max-height: 140px; object-fit: cover; border-radius: .5rem; }
    .chip-row { display: flex; flex-wrap: wrap; gap: .35rem; }
    .chip-row .btn { min-width: 2.6rem; }
    .date-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: .3rem; max-width: 22rem; }
  `],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Offers &amp; flash deals</h2>
      <button class="btn btn-sm btn-primary" (click)="create()"><i class="bi bi-plus-lg me-1"></i>New offer</button>
    </div>
    <p class="page-subtitle">Festival offers like Diwali or Onam, and flash deals that run for a few minutes — once, or on a schedule such as every Monday at 8 pm. Prices change automatically when an offer starts and go back when it ends, and never drop below your cost plus the minimum margin.</p>

    @for (o of rows(); track o.id) {
      <div class="card offer-card mb-3" [style.--offer-color]="o.themeColor">
        <div class="card-body d-flex flex-wrap gap-3 align-items-center">
          @if (o.bannerImageUrl) { <img class="offer-banner" [src]="o.bannerImageUrl | media" alt="" /> }
          @else { <div class="offer-swatch" [style.background]="o.themeColor">{{ o.name }}</div> }
          <div class="flex-grow-1" style="min-width: 220px">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h5 class="mb-0">{{ o.name }}</h5>
              <span [class]="'badge-soft ' + statusClass(o.status)">{{ statusLabel(o.status) }}</span>
              @if (o.repeat !== 'Once') { <span class="badge-soft badge-soft-warning"><i class="bi bi-lightning-charge-fill me-1"></i>Flash deal</span> }
            </div>
            @if (o.schedule) {
              <div class="fs-7"><i class="bi bi-arrow-repeat me-1"></i>{{ o.schedule }}</div>
              <div class="text-muted fs-7">
                {{ o.startsAt | date: 'd MMM y' }} – {{ lastDay(o) | date: 'd MMM y' }}
                @if (o.window && o.status === 'live') { · <span class="text-success">on now, till {{ o.window.endsAt | date: 'h:mm a' }}</span> }
                @else if (o.window && o.status === 'upcoming') { · next {{ o.window.startsAt | date: 'EEE d MMM, h:mm a' }} }
              </div>
            } @else {
              <div class="text-muted fs-7">{{ o.startsAt | date: 'd MMM y, h:mm a' }} – {{ o.endsAt | date: 'd MMM y, h:mm a' }}</div>
            }
            <div class="fs-7 mt-1">
              <b>{{ o.discountType === 'Percent' ? o.value + '% off' : (o.value | inr) + ' off' }}</b>
              @if (o.maxDiscount) { <span class="text-muted"> (up to {{ o.maxDiscount | inr }})</span> }
              · {{ scopeLabel(o.scope) }}
              @if (o.excluded) { <span class="text-muted"> ({{ o.excluded }} left out)</span> }
              @if (o.status === 'live') { · <span class="text-success">{{ o.productsOnOffer }} products on offer</span> }
            </div>
          </div>
          <div class="d-flex gap-4 flex-wrap">
            <div class="stat"><div class="label">Orders</div><div class="value">{{ o.stats.orders }}</div></div>
            <div class="stat"><div class="label">Sales</div><div class="value">{{ o.stats.revenue | inr }}</div></div>
            <div class="stat"><div class="label">Discount given</div><div class="value">{{ o.stats.discountGiven | inr }}</div></div>
            <div class="stat"><div class="label">Margin</div><div class="value" [class.text-danger]="o.stats.margin < 0">{{ o.stats.margin | inr }}</div></div>
          </div>
          <div class="text-nowrap">
            @if (o.status === 'live') { <a class="btn btn-sm btn-phoenix-secondary btn-icon" [href]="storefront + '/offers/' + o.slug" target="_blank" title="View on site"><i class="bi bi-box-arrow-up-right"></i></a> }
            <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1" (click)="edit(o)" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(o)" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>
    } @empty {
      <div class="card"><div class="card-body"><div class="empty-state"><i class="bi bi-stars"></i>No offers yet. Create one for the next festival — it switches on and off by itself.</div></div></div>
    }

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit offer' : 'New offer'" size="lg" (closed)="form.set(null)">
        @if (!f.id) {
          <div class="mb-3">
            <div class="form-label">Quick start</div>
            <div class="d-flex flex-wrap gap-1">
              @for (t of templates; track t.name) {
                <button type="button" class="btn btn-sm btn-phoenix-secondary" (click)="useTemplate(t)">@if (t.flash) { <i class="bi bi-lightning-charge-fill me-1" [style.color]="t.color"></i> } @else { <span class="d-inline-block rounded-circle me-1" [style.background]="t.color" style="width:.6rem;height:.6rem"></span> }{{ t.name }}</button>
              }
            </div>
          </div>
        }
        <div class="row g-2">
          <div class="col-md-8"><label class="form-label">Offer name</label><input class="form-control" [(ngModel)]="f.name" placeholder="Diwali Offers" /></div>
          <div class="col-md-4"><label class="form-label">Colour</label><input type="color" class="form-control form-control-color w-100" [(ngModel)]="f.themeColor" /></div>
          <div class="col-12"><label class="form-label">Short text (banner and badges)</label><input class="form-control" [(ngModel)]="f.tagline" placeholder="Up to 15% off on sofas and beds" maxlength="120" /></div>
          <div class="col-12"><label class="form-label">Description <span class="text-muted">(optional, shown on the offer page)</span></label><textarea class="form-control" rows="2" [(ngModel)]="f.description"></textarea></div>
          <div class="col-12">
            <label class="form-label">Banner image <span class="text-muted">(wide, about 1600 × 500)</span></label>
            @if (f.bannerImageUrl) { <img class="banner-preview mb-2" [src]="f.bannerImageUrl | media" alt="" /> }
            <div class="d-flex gap-2">
              <input type="file" class="form-control" accept="image/*" (change)="upload($event)" />
              @if (f.bannerImageUrl) { <button type="button" class="btn btn-phoenix-secondary" (click)="patch({ bannerImageUrl: undefined })">Remove</button> }
            </div>
            <div class="form-text">No image? The banner uses the colour above.</div>
          </div>

          <div class="col-12"><label class="form-label">When</label>
            <select class="form-select" [ngModel]="f.repeat" (ngModelChange)="setRepeat($event)">
              <option value="Once">One time (festival offer, or a single flash deal)</option>
              <option value="Daily">Repeats every day</option>
              <option value="Weekly">Repeats every week (e.g. every Monday)</option>
              <option value="MonthlyWeekday">Repeats monthly on a weekday (e.g. 1st Friday)</option>
              <option value="MonthlyDates">Repeats monthly on dates (e.g. the 5th)</option>
            </select>
          </div>
          @if (f.repeat === 'Once') {
            <div class="col-md-6"><label class="form-label">Starts</label><input type="datetime-local" class="form-control" [(ngModel)]="f.startsAt" (ngModelChange)="schedulePreview()" /></div>
            <div class="col-md-6"><label class="form-label">Ends</label><input type="datetime-local" class="form-control" [(ngModel)]="f.endsAt" (ngModelChange)="schedulePreview()" /></div>
            <div class="col-12">
              <div class="chip-row align-items-center fs-7"><span class="text-muted me-1"><i class="bi bi-lightning-charge"></i> Flash deal — ends after</span>
                @for (m of [5, 10, 15, 30, 60]; track m) { <button type="button" class="btn btn-sm btn-phoenix-secondary" (click)="endAfter(m)">{{ m }} min</button> }
              </div>
            </div>
          } @else {
            @if (f.repeat === 'Weekly' || f.repeat === 'MonthlyWeekday') {
              @if (f.repeat === 'MonthlyWeekday') {
                <div class="col-12"><label class="form-label">Week of the month</label>
                  <div class="chip-row">@for (w of weeks; track w.value) {
                    <button type="button" class="btn btn-sm" [class.btn-primary]="f.repeatWeeks.includes(w.value)" [class.btn-phoenix-secondary]="!f.repeatWeeks.includes(w.value)" (click)="toggleIn('repeatWeeks', w.value)">{{ w.label }}</button>
                  }</div></div>
              }
              <div class="col-12"><label class="form-label">Day</label>
                <div class="chip-row">@for (d of days; track $index) {
                  <button type="button" class="btn btn-sm" [class.btn-primary]="f.repeatDays.includes($index)" [class.btn-phoenix-secondary]="!f.repeatDays.includes($index)" (click)="toggleIn('repeatDays', $index)">{{ d }}</button>
                }</div></div>
            }
            @if (f.repeat === 'MonthlyDates') {
              <div class="col-12"><label class="form-label">Dates of the month</label>
                <div class="date-grid">@for (n of dates; track n) {
                  <button type="button" class="btn btn-sm px-0" [class.btn-primary]="f.repeatDays.includes(n)" [class.btn-phoenix-secondary]="!f.repeatDays.includes(n)" (click)="toggleIn('repeatDays', n)">{{ n }}</button>
                }</div>
                <div class="form-text">Months without the date (e.g. 31st) are skipped.</div></div>
            }
            <div class="col-md-3 col-6"><label class="form-label">Starts at</label><input type="time" class="form-control" [(ngModel)]="f.windowStart" (ngModelChange)="schedulePreview()" /></div>
            <div class="col-md-3 col-6"><label class="form-label">Runs for</label>
              <select class="form-select" [(ngModel)]="f.windowMinutes" (ngModelChange)="schedulePreview()">
                @for (m of durationOptions(); track m) { <option [ngValue]="m">{{ durationLabel(m) }}</option> }
              </select></div>
            <div class="col-md-3 col-6"><label class="form-label">From</label><input type="date" class="form-control" [(ngModel)]="f.fromDate" (ngModelChange)="schedulePreview()" /></div>
            <div class="col-md-3 col-6"><label class="form-label">Until</label><input type="date" class="form-control" [(ngModel)]="f.untilDate" (ngModelChange)="schedulePreview()" /></div>
          }

          <div class="col-md-4"><label class="form-label">Discount</label>
            <select class="form-select" [(ngModel)]="f.discountType" (ngModelChange)="schedulePreview()"><option value="Percent">% off</option><option value="Flat">₹ off each item</option></select></div>
          <div class="col-md-4"><label class="form-label">{{ f.discountType === 'Percent' ? 'Percent' : 'Amount ₹' }}</label>
            <input type="number" min="1" class="form-control" [(ngModel)]="f.value" (ngModelChange)="schedulePreview()" /></div>
          <div class="col-md-4"><label class="form-label">Max off per item ₹</label>
            <input type="number" class="form-control" [(ngModel)]="f.maxDiscount" [disabled]="f.discountType !== 'Percent'" placeholder="No limit" (ngModelChange)="schedulePreview()" /></div>
          <div class="col-md-6"><label class="form-label">Offer price rounding</label>
            <select class="form-select" [(ngModel)]="f.rounding" (ngModelChange)="schedulePreview()">
              <option value="None">Original (no rounding)</option><option value="EndWith99">End with 99 (₹12,499)</option>
              <option value="Nearest10">Round down to ₹10 (₹12,340)</option><option value="Nearest100">Round down to ₹100 (₹12,300)</option>
            </select>
            <div class="form-text">Always rounds down, so the discount is never less than advertised.</div></div>
          @if (exampleRegular(); as ex) {
            <div class="col-md-6 d-flex align-items-center"><div class="fs-7 text-muted">Example: {{ ex | inr }} → <b class="text-body">{{ examplePrice() | inr }}</b>&nbsp;(before the margin limit)</div></div>
          }

          <div class="col-12"><label class="form-label">Applies to</label>
            <div class="btn-group w-100" role="group">
              @for (s of scopes; track s.value) {
                <button type="button" class="btn btn-sm" [class.btn-primary]="f.scope === s.value" [class.btn-phoenix-secondary]="f.scope !== s.value" (click)="patch({ scope: s.value }); schedulePreview()">{{ s.label }}</button>
              }
            </div>
          </div>
          @if (f.scope === 'Categories') {
            <div class="col-12"><div class="cat-grid border rounded p-2">
              @for (c of categories(); track c.id) {
                <div class="form-check"><input class="form-check-input" type="checkbox" [id]="'oc' + c.id" [checked]="f.categoryIds.includes(c.id)" (change)="toggleCategory(c.id)" />
                  <label class="form-check-label" [for]="'oc' + c.id">{{ c.name }} <span class="text-muted fs-8">({{ c.activeCount }})</span></label></div>
              }
            </div></div>
          }
          @if (f.scope === 'Products') {
            <div class="col-12">
              <input class="form-control mb-2" placeholder="Search products to add…" [(ngModel)]="productSearch" (ngModelChange)="searchProducts()" />
              @if (results().length) {
                <div class="pick-list border rounded mb-2">
                  @for (p of results(); track p.id) {
                    <button type="button" class="dropdown-item d-flex align-items-center gap-2 py-1" (click)="addProduct(p, 'products')" [disabled]="isPicked(p.id)">
                      <img class="pick-thumb" [src]="p.imageUrl | media" alt="" /><span class="flex-grow-1 text-truncate">{{ p.name }}</span><span class="text-muted">{{ p.sellingPrice | inr }}</span>
                      <i class="bi" [class.bi-check2]="isPicked(p.id)" [class.bi-plus]="!isPicked(p.id)"></i>
                    </button>
                  }
                </div>
              }
              <div class="d-flex flex-wrap gap-1">
                @for (p of f.products; track p.id) {
                  <span class="badge-soft badge-soft-primary d-inline-flex align-items-center gap-1">{{ p.name }}<button type="button" class="btn btn-link btn-sm p-0 lh-1" (click)="removeProduct(p.id, 'products')"><i class="bi bi-x"></i></button></span>
                } @empty { <span class="text-muted fs-7">No products chosen yet.</span> }
              </div>
            </div>
          } @else {
            <div class="col-12">
              <label class="form-label">Leave out products <span class="text-muted">(optional)</span></label>
              <input class="form-control mb-2" placeholder="Search products to leave out of this offer…" [(ngModel)]="excludeSearch" (ngModelChange)="searchProducts(true)" />
              @if (excludeResults().length) {
                <div class="pick-list border rounded mb-2">
                  @for (p of excludeResults(); track p.id) {
                    <button type="button" class="dropdown-item d-flex align-items-center gap-2 py-1" (click)="addProduct(p, 'excludedProducts')" [disabled]="isExcluded(p.id)">
                      <img class="pick-thumb" [src]="p.imageUrl | media" alt="" /><span class="flex-grow-1 text-truncate">{{ p.name }}</span><span class="text-muted">{{ p.sellingPrice | inr }}</span>
                      <i class="bi" [class.bi-check2]="isExcluded(p.id)" [class.bi-dash-circle]="!isExcluded(p.id)"></i>
                    </button>
                  }
                </div>
              }
              <div class="d-flex flex-wrap gap-1">
                @for (p of f.excludedProducts; track p.id) {
                  <span class="badge-soft badge-soft-secondary d-inline-flex align-items-center gap-1"><i class="bi bi-dash-circle"></i>{{ p.name }}<button type="button" class="btn btn-link btn-sm p-0 lh-1" (click)="removeProduct(p.id, 'excludedProducts')"><i class="bi bi-x"></i></button></span>
                }
              </div>
            </div>
          }

          <div class="col-md-4"><label class="form-label">Minimum margin %</label>
            <input type="number" min="0" class="form-control" [(ngModel)]="f.minMarginPercent" (ngModelChange)="schedulePreview()" />
            <div class="form-text">Over your cost incl. GST.</div></div>
          <div class="col-md-4"><label class="form-label">Coupon code <span class="text-muted">(optional)</span></label>
            <input class="form-control text-uppercase" [(ngModel)]="f.couponCode" placeholder="DIWALI10" />
            <div class="form-text">Shown on the banner. Create it under Coupons.</div></div>
          <div class="col-md-4"><label class="form-label">Order on home page</label><input type="number" class="form-control" [(ngModel)]="f.sortOrder" /></div>

          <div class="col-md-4"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="oh" [(ngModel)]="f.showOnHome" /><label class="form-check-label" for="oh">Show on the home page</label></div></div>
          <div class="col-md-4"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="on" [(ngModel)]="f.notify" /><label class="form-check-label" for="on">App notification when it goes live</label></div></div>
          <div class="col-md-4"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="oa" [(ngModel)]="f.isActive" /><label class="form-check-label" for="oa">Enabled</label></div></div>

          @if (preview(); as p) {
            <div class="col-12">
              <div class="alert alert-subtle-info py-2 mb-0 fs-7">
                <i class="bi bi-info-circle me-1"></i><b>{{ p.products | number }}</b> products will get the offer price.
                @if (p.limitedByMargin) { <b>{{ p.limitedByMargin | number }}</b> get a smaller discount (or none) because of the minimum margin. }
                @if (f.repeat !== 'Once') {
                  <div class="mt-1">@if (p.nextWindows?.length) { <i class="bi bi-calendar-event me-1"></i>Next:
                    @for (w of p.nextWindows; track w.startsAt; let last = $last) { {{ w.startsAt | date: 'EEE d MMM, h:mm a' }}–{{ w.endsAt | date: 'h:mm a' }}@if (!last) {; } }
                  } @else { <span class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>No deal time falls between From and Until.</span> }</div>
                }
              </div>
            </div>
          }
        </div>
        <ng-container footer>
          <button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button>
          <button class="btn btn-primary" [disabled]="!canSave() || saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save offer' }}</button>
        </ng-container>
      </wc-modal>
    }
  `
})
export class OffersPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected readonly templates = TEMPLATES;
  protected readonly scopes: { value: Scope; label: string }[] = [
    { value: 'AllProducts', label: 'All products' }, { value: 'Categories', label: 'Categories' }, { value: 'Products', label: 'Chosen products' }
  ];
  protected readonly storefront = environment.storefrontUrl;
  protected readonly days = DAYS;
  protected readonly weeks = WEEKS;
  protected readonly dates = Array.from({ length: 31 }, (_, i) => i + 1);

  protected rows = signal<OfferRow[]>([]);
  protected categories = signal<CategoryRow[]>([]);
  protected form = signal<OfferForm | null>(null);
  protected preview = signal<Preview | null>(null);
  protected results = signal<ProductRow[]>([]);
  protected excludeResults = signal<ProductRow[]>([]);
  protected excludeSearch = '';
  protected saving = signal(false);
  protected productSearch = '';
  private previewTimer?: ReturnType<typeof setTimeout>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected canSave = computed(() => {
    const f = this.form();
    if (!f || !f.name.trim() || !f.value) return false;
    return f.repeat === 'Once' ? !!f.startsAt && !!f.endsAt : !!f.fromDate && !!f.untilDate && !!f.windowStart && f.windowMinutes > 0;
  });

  /** The rounding example uses a typical price. */
  protected exampleRegular = computed(() => (this.form()?.value ? 12999 : 0));
  protected examplePrice = computed(() => {
    const f = this.form();
    if (!f?.value) return 0;
    let off = f.discountType === 'Percent' ? 12999 * f.value / 100 : f.value;
    if (f.discountType === 'Percent' && f.maxDiscount) off = Math.min(off, f.maxDiscount);
    const p = Math.floor(12999 - off);
    switch (f.rounding) {
      case 'Nearest10': return Math.floor(p / 10) * 10;
      case 'Nearest100': return Math.floor(p / 100) * 100;
      case 'EndWith99': return Math.floor((p + 1) / 100) * 100 - 1;
      default: return p;
    }
  });

  protected durationOptions = computed(() => {
    const m = this.form()?.windowMinutes ?? 0;
    return DURATIONS.includes(m) || !m ? DURATIONS : [...DURATIONS, m].sort((a, b) => a - b);
  });

  constructor() {
    this.load();
    this.api.get<CategoryRow[]>('admin/categories').subscribe(r => this.categories.set(r.filter(c => c.isActive)));
  }

  load() { this.api.get<OfferRow[]>('admin/offers').subscribe(r => this.rows.set(r)); }

  /** Repeating deals end at midnight after their last day. */
  lastDay(o: OfferRow) { return new Date(new Date(o.endsAt).getTime() - 60_000); }

  durationLabel(m: number) { return m < 60 ? `${m} minutes` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : m === 60 ? '1 hour' : `${m / 60} hours`; }

  statusLabel(s: OfferStatus) { return { live: 'Live now', upcoming: 'Scheduled', ended: 'Ended', off: 'Off' }[s]; }
  statusClass(s: OfferStatus) { return { live: 'badge-soft-success', upcoming: 'badge-soft-info', ended: 'badge-soft-secondary', off: 'badge-soft-warning' }[s]; }
  scopeLabel(s: Scope) { return { AllProducts: 'All products', Categories: 'Chosen categories', Products: 'Chosen products' }[s]; }

  patch(p: Partial<OfferForm>) { this.form.update(f => (f ? { ...f, ...p } : f)); }

  create() {
    const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
    const end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 0, 0);
    this.form.set({
      id: 0, name: '', slug: '', tagline: '', description: '', themeColor: '#e8590c',
      startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(end.toISOString()), isActive: true, showOnHome: true, sortOrder: 0,
      discountType: 'Percent', value: 10, maxDiscount: null, minMarginPercent: 5, scope: 'AllProducts', couponCode: '', categoryIds: [], products: [],
      repeat: 'Once', repeatDays: [], repeatWeeks: [], windowStart: '20:00', windowMinutes: 15, rounding: 'None', notify: true, excludedProducts: [],
      fromDate: toDateInput(new Date()), untilDate: toDateInput(new Date(Date.now() + 90 * 86_400_000))
    });
    this.resetSearch();
    this.schedulePreview();
  }

  useTemplate(t: (typeof TEMPLATES)[number]) {
    this.patch({ name: t.name, tagline: t.tagline, themeColor: t.color, ...(t.flash ?? { repeat: 'Once' }) });
    this.schedulePreview();
  }

  setRepeat(r: Repeat) {
    const f = this.form()!;
    // Sensible first picks so the preview shows windows straight away.
    const today = new Date();
    const days = r === 'Weekly' || r === 'MonthlyWeekday' ? (f.repeatDays.filter(d => d < 7).length ? f.repeatDays.filter(d => d < 7) : [today.getDay()])
      : r === 'MonthlyDates' ? (f.repeat === 'MonthlyDates' && f.repeatDays.length ? f.repeatDays : [today.getDate()]) : [];
    this.patch({ repeat: r, repeatDays: days, repeatWeeks: r === 'MonthlyWeekday' && !f.repeatWeeks.length ? [1] : f.repeatWeeks });
    this.schedulePreview();
  }

  toggleIn(key: 'repeatDays' | 'repeatWeeks', n: number) {
    const list = this.form()![key];
    this.patch({ [key]: list.includes(n) ? list.filter(x => x !== n) : [...list, n].sort((a, b) => a - b) });
    this.schedulePreview();
  }

  /** One-time flash deal: ends N minutes after it starts. */
  endAfter(minutes: number) {
    const f = this.form()!;
    const start = f.startsAt ? new Date(f.startsAt) : new Date();
    this.patch({ startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(new Date(start.getTime() + minutes * 60_000).toISOString()) });
    this.schedulePreview();
  }

  private resetSearch() { this.results.set([]); this.excludeResults.set([]); this.productSearch = ''; this.excludeSearch = ''; }

  edit(o: OfferRow) {
    this.api.get<OfferForm & { products: PickedProduct[] }>(`admin/offers/${o.id}`).subscribe(d => {
      this.form.set({
        ...d, tagline: d.tagline ?? '', description: d.description ?? '', couponCode: d.couponCode ?? '',
        startsAt: toLocalInput(d.startsAt), endsAt: toLocalInput(d.endsAt), maxDiscount: d.maxDiscount ?? null,
        windowStart: d.windowStart ?? '20:00', windowMinutes: d.windowMinutes || 15,
        fromDate: toDateInput(new Date(d.startsAt)), untilDate: toDateInput(new Date(new Date(d.endsAt).getTime() - 60_000))
      });
      this.resetSearch();
      this.schedulePreview();
    });
  }

  toggleCategory(id: number) {
    const f = this.form()!;
    this.patch({ categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter(x => x !== id) : [...f.categoryIds, id] });
    this.schedulePreview();
  }

  searchProducts(exclude = false) {
    clearTimeout(this.searchTimer);
    const q = (exclude ? this.excludeSearch : this.productSearch).trim();
    const target = exclude ? this.excludeResults : this.results;
    if (q.length < 2) { target.set([]); return; }
    this.searchTimer = setTimeout(() =>
      this.api.get<Paged<ProductRow>>('admin/products', { search: q, status: 'published', pageSize: 20 }).subscribe(r => target.set(r.items)), 250);
  }

  isPicked(id: number) { return this.form()?.products.some(p => p.id === id) ?? false; }
  isExcluded(id: number) { return this.form()?.excludedProducts.some(p => p.id === id) ?? false; }
  addProduct(p: ProductRow, list: 'products' | 'excludedProducts') {
    if (this.form()![list].some(x => x.id === p.id)) return;
    this.patch({ [list]: [...this.form()![list], { id: p.id, name: p.name, imageUrl: p.imageUrl, price: p.sellingPrice }] });
    this.schedulePreview();
  }
  removeProduct(id: number, list: 'products' | 'excludedProducts') { this.patch({ [list]: this.form()![list].filter(p => p.id !== id) }); this.schedulePreview(); }

  upload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'offers' }).subscribe(r => this.patch({ bannerImageUrl: r.url }));
  }

  private body() {
    const f = this.form()!;
    const once = f.repeat === 'Once';
    // Repeating deals run between the start of From and the end of Until (local time).
    const until = new Date(`${f.untilDate}T00:00`); until.setDate(until.getDate() + 1);
    return {
      name: f.name.trim(), slug: f.slug || null, tagline: f.tagline || null, description: f.description || null,
      bannerImageUrl: f.bannerImageUrl ?? null, themeColor: f.themeColor,
      startsAt: (once ? new Date(f.startsAt) : new Date(`${f.fromDate}T00:00`)).toISOString(),
      endsAt: (once ? new Date(f.endsAt) : until).toISOString(),
      repeat: f.repeat, repeatDays: f.repeatDays, repeatWeeks: f.repeatWeeks, windowStart: once ? null : f.windowStart, windowMinutes: once ? 0 : f.windowMinutes,
      rounding: f.rounding, notify: f.notify, excludedProductIds: f.scope === 'Products' ? [] : f.excludedProducts.map(p => p.id),
      isActive: f.isActive, showOnHome: f.showOnHome, sortOrder: f.sortOrder || 0,
      discountType: f.discountType, value: f.value || 0, maxDiscount: f.discountType === 'Percent' && f.maxDiscount ? f.maxDiscount : null,
      minMarginPercent: f.minMarginPercent ?? 0, scope: f.scope, couponCode: f.couponCode || null,
      categoryIds: f.categoryIds, productIds: f.products.map(p => p.id)
    };
  }

  schedulePreview() {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      const f = this.form();
      const dated = f && (f.repeat === 'Once' ? f.startsAt && f.endsAt : f.fromDate && f.untilDate && f.windowStart);
      if (!f || !f.value || !dated) { this.preview.set(null); return; }
      this.api.post<Preview>('admin/offers/preview', { ...this.body(), name: f.name || 'preview' }).subscribe(p => this.preview.set(p));
    }, 300);
  }

  save() {
    const f = this.form()!;
    this.saving.set(true);
    const req = f.id ? this.api.put<Preview>(`admin/offers/${f.id}`, this.body()) : this.api.post<Preview>('admin/offers', this.body());
    req.subscribe({
      next: r => {
        this.saving.set(false);
        this.form.set(null);
        const starts = f.repeat === 'Once' ? new Date(f.startsAt) : new Date(this.preview()?.nextWindows?.[0]?.startsAt ?? Date.now());
        this.toast.success(!f.isActive ? 'Offer saved (switched off)'
          : f.repeat !== 'Once' && !r.products ? `Flash deal saved — next one ${starts.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
          : starts > new Date() ? `Offer saved — starts ${starts.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
          : `Offer is live — ${r.products} products now on offer`);
        this.load();
      },
      error: () => this.saving.set(false)
    });
  }

  remove(o: OfferRow) {
    if (!confirm(`Delete "${o.name}"? Prices go back to normal straight away.`)) return;
    this.api.delete(`admin/offers/${o.id}`).subscribe(() => { this.toast.success('Offer deleted'); this.load(); });
  }
}
