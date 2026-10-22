import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Paged, ProductDetail, ProductRow } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES, isoDate } from '../../shared/pipes';

type Channel = 'Instagram' | 'Facebook' | 'WhatsApp' | 'Phone' | 'WalkIn' | 'Other';
type PayMode = 'Paid' | 'Advance' | 'PaymentLink' | 'CashOnDelivery';
interface Address { label: string; fullName: string; phone: string; line1: string; line2?: string | null; landmark?: string | null; city: string; state: string; pincode: string; isDefault: boolean; }
interface CustomerHit { id: number; name: string; phone?: string; email?: string; orders: number; lastAddress?: Address; }
interface VariantChoice { id: number; name: string; price: number; available: boolean; }
interface Line { productId: number; variantId: number | null; quantity: number; unitPrice: number | null; name: string; image?: string; variants: VariantChoice[]; }
interface QuoteLine { productId: number; variantId?: number; listPrice: number; regularPrice: number; offerName?: string; unitPrice: number; unitCost: number; lineTotal: number; inStock: boolean; problem?: string; }
interface Quote {
  lines: QuoteLine[]; subTotal: number; discount: number; shippingFee: number; suggestedShippingFee: number; total: number; cost: number; margin: number;
  deliveryDays: number; pincode?: { serviceable: boolean; message: string; area?: string }; warnings: string[];
}
interface Result { id: number; orderNumber: string; customerLink: string; whatsAppText: string; whatsAppUrl: string; }

const CHANNELS: { key: Channel; label: string; icon: string }[] = [
  { key: 'Instagram', label: 'Instagram', icon: 'bi-instagram' }, { key: 'WhatsApp', label: 'WhatsApp', icon: 'bi-whatsapp' },
  { key: 'Facebook', label: 'Facebook', icon: 'bi-facebook' }, { key: 'Phone', label: 'Phone call', icon: 'bi-telephone' },
  { key: 'WalkIn', label: 'Walk-in / showroom', icon: 'bi-shop' }, { key: 'Other', label: 'Other', icon: 'bi-three-dots' }
];
const MOBILE = /^([+]?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}$/;

/** Orders → New order: an order taken on Instagram, WhatsApp, Facebook, the phone or in person. */
@Component({
  selector: 'wc-new-order',
  imports: [FormsModule, RouterLink, ...SHARED_PIPES],
  styles: [`
    .channel { border: 1px solid var(--bs-border-color); border-radius: .5rem; padding: .55rem .8rem; background: transparent; display: inline-flex; gap: .4rem; align-items: center; font-weight: 600; }
    .channel.on { border-color: #9A5226; background: rgba(154, 82, 38,.08); color: #9A5226; }
    .hits { position: absolute; z-index: 5; left: 0; right: 0; top: 100%; max-height: 300px; overflow: auto; }
    .line-img { width: 48px; height: 48px; object-fit: cover; border-radius: .375rem; }
    .pay { border: 1px solid var(--bs-border-color); border-radius: .5rem; padding: .5rem .75rem; display: block; cursor: pointer; }
    .pay.on { border-color: #9A5226; background: rgba(154, 82, 38,.06); }
  `],
  template: `
    <nav class="fs-7 mb-2"><a routerLink="/orders">Orders</a> <i class="bi bi-chevron-right text-quiet mx-1"></i> <span class="text-muted">New order</span></nav>
    <h2 class="page-title">New order</h2>
    <p class="page-subtitle">For orders taken on Instagram, WhatsApp, Facebook, the phone or in person. It becomes a normal order: purchase order, invoice and profit work the same way.</p>

    @if (result(); as r) {
      <div class="card border-success">
        <div class="card-body text-center py-5">
          <i class="bi bi-check-circle-fill text-success display-5"></i>
          <h3 class="mt-3">Order {{ r.orderNumber }} created</h3>
          <p class="text-muted">Send the customer their order summary, payment and tracking link.</p>
          <pre class="text-start border rounded p-3 mx-auto bg-body-tertiary fs-7" style="max-width: 560px; white-space: pre-wrap; font-family: inherit">{{ r.whatsAppText }}</pre>
          <div class="d-flex flex-wrap gap-2 justify-content-center">
            <a class="btn btn-success" [href]="r.whatsAppUrl" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Send on WhatsApp</a>
            <button class="btn btn-phoenix-secondary" (click)="copy(r.whatsAppText)"><i class="bi bi-clipboard me-1"></i>Copy message</button>
            <a class="btn btn-phoenix-secondary" [routerLink]="['/orders', r.id]">Open order</a>
            <button class="btn btn-phoenix-secondary" (click)="startOver()"><i class="bi bi-plus me-1"></i>Another order</button>
          </div>
        </div>
      </div>
    } @else {
      <div class="row g-3">
        <div class="col-xl-8">
          <!-- 1. Channel -->
          <div class="card mb-3"><div class="card-body">
            <h5 class="mb-3">1. Where did this order come from?</h5>
            <div class="d-flex flex-wrap gap-2 mb-2">
              @for (c of channels; track c.key) {
                <button type="button" class="channel" [class.on]="channel === c.key" (click)="channel = c.key"><i class="bi {{ c.icon }}"></i>{{ c.label }}</button>
              }
            </div>
            <input class="form-control" [(ngModel)]="channelRef" placeholder="Reference (optional) — e.g. Instagram @handle, chat or post link" />
          </div></div>

          <!-- 2. Customer -->
          <div class="card mb-3"><div class="card-body">
            <h5 class="mb-3">2. Customer</h5>
            <div class="position-relative mb-3">
              <div class="search-box"><i class="bi bi-search"></i>
                <input class="form-control" [(ngModel)]="customerSearch" (ngModelChange)="findCustomers()" placeholder="Find an existing customer by mobile, name or email…" /></div>
              @if (hits().length) {
                <div class="hits list-group shadow-sm">
                  @for (h of hits(); track h.id) {
                    <button type="button" class="list-group-item list-group-item-action" (click)="pickCustomer(h)">
                      <b>{{ h.name }}</b> <span class="text-muted fs-7">{{ h.phone }}{{ h.email ? ' · ' + h.email : '' }} · {{ h.orders }} order{{ h.orders === 1 ? '' : 's' }}</span>
                    </button>
                  }
                </div>
              }
            </div>
            @if (customerId) { <div class="alert alert-subtle-info py-2 fs-7">Existing customer — this order joins their history. <a role="button" class="link-primary" (click)="customerId = null">Treat as new</a></div> }
            <div class="row g-2">
              <div class="col-md-4"><label class="form-label">Name</label><input class="form-control" [(ngModel)]="name" (ngModelChange)="addr.fullName = $event" /></div>
              <div class="col-md-4"><label class="form-label">Mobile</label>
                <input class="form-control" [class.is-invalid]="phone && !validPhone()" [(ngModel)]="phone" (ngModelChange)="addr.phone = $event" inputmode="tel" placeholder="98765 43210" />
                @if (phone && !validPhone()) { <div class="invalid-feedback">Enter a 10-digit mobile number</div> }</div>
              <div class="col-md-4"><label class="form-label">Email <span class="text-muted">(optional)</span></label><input class="form-control" [(ngModel)]="email" placeholder="For the order email" /></div>
              <div class="col-12"><label class="form-label">Flat / house no., building, street</label><input class="form-control" [(ngModel)]="addr.line1" /></div>
              <div class="col-md-6"><label class="form-label">Area / locality <span class="text-muted">(optional)</span></label><input class="form-control" [(ngModel)]="addr.line2" /></div>
              <div class="col-md-6"><label class="form-label">Landmark <span class="text-muted">(optional)</span></label><input class="form-control" [(ngModel)]="addr.landmark" /></div>
              <div class="col-md-4"><label class="form-label">Pincode</label><input class="form-control" [(ngModel)]="addr.pincode" (ngModelChange)="requote()" maxlength="6" inputmode="numeric" /></div>
              <div class="col-md-4"><label class="form-label">City</label><input class="form-control" [(ngModel)]="addr.city" /></div>
              <div class="col-md-4"><label class="form-label">State</label><input class="form-control" [(ngModel)]="addr.state" /></div>
              @if (quote()?.pincode; as pin) {
                <div class="col-12 fs-7" [class.text-success]="pin.serviceable" [class.text-danger]="!pin.serviceable"><i class="bi" [class.bi-check-circle]="pin.serviceable" [class.bi-x-circle]="!pin.serviceable"></i> {{ pin.message }}</div>
              }
            </div>
          </div></div>

          <!-- 3. Products -->
          <div class="card mb-3"><div class="card-body">
            <h5 class="mb-3">3. Products</h5>
            <div class="position-relative mb-3">
              <div class="search-box"><i class="bi bi-search"></i>
                <input class="form-control" [(ngModel)]="productSearch" (ngModelChange)="findProducts()" placeholder="Search products to add…" /></div>
              @if (productHits().length) {
                <div class="hits list-group shadow-sm">
                  @for (p of productHits(); track p.id) {
                    <button type="button" class="list-group-item list-group-item-action d-flex gap-2 align-items-center" (click)="addProduct(p)">
                      <img class="line-img" [src]="p.imageUrl | media" alt="" /><span class="flex-grow-1 text-truncate">{{ p.name }}</span>
                      <span class="text-muted">{{ p.variantsCount ? 'from ' : '' }}{{ p.sellingPrice | inr }}</span>
                      @if (!p.isAvailable) { <span class="badge-soft badge-soft-danger">Out of stock</span> }
                    </button>
                  }
                </div>
              }
            </div>
            @for (l of lines(); track $index; let i = $index) {
              @let q = quoteLine(l);
              <div class="d-flex flex-wrap gap-2 align-items-center border-bottom py-2">
                <img class="line-img" [src]="l.image | media" alt="" />
                <div class="flex-grow-1" style="min-width: 200px">
                  <div class="fw-bold">{{ l.name }}</div>
                  @if (l.variants.length) {
                    <select class="form-select form-select-sm mt-1" [(ngModel)]="l.variantId" (ngModelChange)="l.unitPrice = null; requote()">
                      <option [ngValue]="null" disabled>Choose an option…</option>
                      @for (v of l.variants; track v.id) { <option [ngValue]="v.id">{{ v.name }} — {{ v.price | inr }}{{ v.available ? '' : ' (out of stock)' }}</option> }
                    </select>
                  }
                  @if (q?.offerName) { <div class="fs-8 text-warning fw-bold"><i class="bi bi-stars"></i> {{ q!.offerName }} price (regular {{ q!.regularPrice | inr }})</div> }
                  @if (q && !q.inStock) { <div class="fs-8 text-danger">Out of stock at the vendor — confirm with them</div> }
                </div>
                <div style="width: 80px"><label class="form-label fs-8 mb-0">Qty</label>
                  <input type="number" min="1" class="form-control form-control-sm" [(ngModel)]="l.quantity" (ngModelChange)="requote()" /></div>
                <div style="width: 120px"><label class="form-label fs-8 mb-0">Price each ₹</label>
                  <input type="number" class="form-control form-control-sm" [class.is-invalid]="q && (l.unitPrice ?? q.listPrice) < q.unitCost"
                         [ngModel]="l.unitPrice ?? q?.listPrice" (ngModelChange)="setPrice(l, $event)" /></div>
                <div class="text-end" style="width: 110px">
                  <div class="fw-bold">{{ (q?.lineTotal ?? 0) | inr }}</div>
                  @if (q) { <div class="fs-8" [class.text-danger]="q.unitPrice < q.unitCost" [class.text-muted]="q.unitPrice >= q.unitCost">cost {{ q.unitCost | inr }}</div> }
                  @if (l.unitPrice !== null && q && l.unitPrice !== q.listPrice) { <a role="button" class="fs-8 link-primary" (click)="l.unitPrice = null; requote()">store price</a> }
                </div>
                <button class="btn btn-sm text-danger" (click)="removeLine(i)" title="Remove"><i class="bi bi-x-lg"></i></button>
              </div>
            } @empty { <p class="text-muted fs-7 mb-0">Search above and click a product to add it.</p> }
          </div></div>

          <!-- Notes -->
          <div class="card"><div class="card-body row g-2">
            <div class="col-md-4"><label class="form-label">Expected delivery</label><input type="date" class="form-control" [(ngModel)]="deliveryDate" [min]="today" />
              <div class="form-text">Empty = about {{ (quote()?.deliveryDays ?? 7) + 2 }} days from today</div></div>
            <div class="col-md-8"><label class="form-label">Note for the customer <span class="text-muted">(shown on their order)</span></label><input class="form-control" [(ngModel)]="customerNotes" /></div>
            <div class="col-md-8"><label class="form-label">Internal note</label><input class="form-control" [(ngModel)]="adminNotes" placeholder="Only your team sees this" /></div>
            <div class="col-md-4"><label class="form-label">Customer GSTIN <span class="text-muted">(optional)</span></label><input class="form-control text-uppercase" [(ngModel)]="gstin" /></div>
          </div></div>
        </div>

        <div class="col-xl-4">
          <!-- Summary -->
          <div class="card mb-3"><div class="card-body fs-7">
            <h5 class="mb-3">Summary</h5>
            <div class="d-flex justify-content-between mb-2"><span class="text-muted">Items</span><span>{{ (quote()?.subTotal ?? 0) | inr: true }}</span></div>
            <div class="d-flex justify-content-between align-items-center mb-2"><span class="text-muted">Discount ₹</span>
              <input type="number" min="0" class="form-control form-control-sm text-end" style="width: 110px" [(ngModel)]="discount" (ngModelChange)="requote()" /></div>
            <div class="d-flex justify-content-between align-items-center mb-1"><span class="text-muted">Delivery ₹</span>
              <input type="number" min="0" class="form-control form-control-sm text-end" style="width: 110px" [ngModel]="shipping ?? quote()?.suggestedShippingFee" (ngModelChange)="shipping = $event; requote()" /></div>
            @if (shipping !== null && quote() && shipping !== quote()!.suggestedShippingFee) { <div class="text-end mb-2"><a role="button" class="fs-8 link-primary" (click)="shipping = null; requote()">use usual fee ({{ quote()!.suggestedShippingFee | inr }})</a></div> }
            <div class="d-flex justify-content-between border-top pt-2 fs-6 fw-bold"><span>Total</span><span>{{ (quote()?.total ?? 0) | inr: true }}</span></div>
            <div class="d-flex justify-content-between mt-2 text-muted"><span>Vendor cost (incl. GST)</span><span>{{ (quote()?.cost ?? 0) | inr }}</span></div>
            <div class="d-flex justify-content-between fw-bold" [class.text-success]="(quote()?.margin ?? 0) >= 0" [class.text-danger]="(quote()?.margin ?? 0) < 0"><span>Your margin</span><span>{{ (quote()?.margin ?? 0) | inr }}</span></div>
            @for (w of quote()?.warnings ?? []; track w) { <div class="alert alert-subtle-warning py-1 px-2 mt-2 mb-0 fs-8"><i class="bi bi-exclamation-triangle me-1"></i>{{ w }}</div> }
          </div></div>

          <!-- Payment -->
          <div class="card mb-3"><div class="card-body fs-7">
            <h5 class="mb-3">Payment</h5>
            @for (m of payModes; track m.key) {
              <label class="pay mb-2" [class.on]="payMode === m.key">
                <input type="radio" class="form-check-input me-2" name="pm" [checked]="payMode === m.key" (change)="payMode = m.key" />
                <b>{{ m.label }}</b><div class="text-muted fs-8 ms-4">{{ m.help }}</div>
              </label>
            }
            @if (payMode === 'Paid' || payMode === 'Advance') {
              <div class="row g-2 mt-1">
                <div class="col-6"><label class="form-label">Received by</label>
                  <select class="form-select form-select-sm" [(ngModel)]="payMethod"><option value="Upi">UPI</option><option value="BankTransfer">Bank transfer</option><option value="CashOnDelivery">Cash</option><option value="Card">Card (swipe)</option></select></div>
                <div class="col-6"><label class="form-label">{{ payMode === 'Advance' ? 'Advance ₹' : 'Amount ₹' }}</label>
                  @if (payMode === 'Advance') { <input type="number" class="form-control form-control-sm" [(ngModel)]="advance" /> }
                  @else { <div class="form-control-plaintext form-control-sm fw-bold">{{ (quote()?.total ?? 0) | inr: true }}</div> }</div>
                <div class="col-6"><label class="form-label">UTR / reference</label><input class="form-control form-control-sm" [(ngModel)]="payRef" /></div>
                <div class="col-6"><label class="form-label">Date</label><input type="date" class="form-control form-control-sm" [(ngModel)]="paidOn" /></div>
              </div>
            }
          </div></div>

          <button class="btn btn-primary btn-lg w-100" [disabled]="!canCreate() || saving()" (click)="create()">{{ saving() ? 'Creating…' : 'Create order' }}</button>
          @if (missingText(); as m) { <div class="text-muted fs-8 text-center mt-2">{{ m }}</div> }
        </div>
      </div>
    }
  `
})
export class NewOrderPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected readonly channels = CHANNELS;
  protected readonly payModes: { key: PayMode; label: string; help: string }[] = [
    { key: 'Paid', label: 'Paid in full', help: 'The customer has already paid (UPI, bank transfer, cash…)' },
    { key: 'Advance', label: 'Advance received', help: 'Part paid now; the rest is due later' },
    { key: 'PaymentLink', label: 'Send a payment link', help: 'Not paid yet — the customer pays from their order page (UPI, confirmed automatically)' },
    { key: 'CashOnDelivery', label: 'Cash on delivery', help: 'Collected when the furniture is delivered' }
  ];
  protected readonly today = isoDate(new Date());

  channel: Channel | null = null; channelRef = '';
  customerId: number | null = null; customerSearch = ''; name = ''; phone = ''; email = '';
  addr: Address = this.emptyAddress();
  productSearch = '';
  discount = 0; shipping: number | null = null;
  deliveryDate = ''; customerNotes = ''; adminNotes = ''; gstin = '';
  payMode: PayMode = 'PaymentLink'; payMethod = 'Upi'; advance: number | null = null; payRef = ''; paidOn = isoDate(new Date());

  protected hits = signal<CustomerHit[]>([]);
  protected productHits = signal<ProductRow[]>([]);
  protected lines = signal<Line[]>([]);
  protected quote = signal<Quote | null>(null);
  protected saving = signal(false);
  protected result = signal<Result | null>(null);
  private timers: Record<string, ReturnType<typeof setTimeout>> = {};

  protected validPhone = () => MOBILE.test(this.phone.trim());
  /** What's still needed before the order can be created (shown under the button). */
  protected missingText(): string | null {
    if (!this.channel) return 'Choose where the order came from.';
    if (!this.name.trim() || !this.validPhone()) return 'Enter the customer’s name and 10-digit mobile.';
    if (!this.addr.line1.trim() || this.addr.pincode.length !== 6 || !this.addr.city.trim()) return 'Complete the delivery address.';
    if (!this.lines().length) return 'Add at least one product.';
    if (this.items().length !== this.lines().length) return 'Choose an option for every product.';
    if (this.payMode === 'Advance' && !((this.advance ?? 0) > 0)) return 'Enter the advance amount.';
    return null;
  }

  private emptyAddress(): Address { return { label: 'Home', fullName: '', phone: '', line1: '', line2: '', landmark: '', city: 'Bengaluru', state: 'Karnataka', pincode: '', isDefault: false }; }

  private debounce(key: string, fn: () => void, ms = 250) { clearTimeout(this.timers[key]); this.timers[key] = setTimeout(fn, ms); }

  findCustomers() {
    const q = this.customerSearch.trim();
    if (q.length < 2) { this.hits.set([]); return; }
    this.debounce('c', () => this.api.get<CustomerHit[]>('admin/orders/customer-lookup', { q }).subscribe(h => this.hits.set(h)));
  }

  pickCustomer(h: CustomerHit) {
    this.customerId = h.id; this.name = h.name; this.phone = h.phone ?? ''; this.email = h.email ?? '';
    this.addr = h.lastAddress ? { ...h.lastAddress, line2: h.lastAddress.line2 ?? '', landmark: h.lastAddress.landmark ?? '' } : { ...this.emptyAddress(), fullName: h.name, phone: h.phone ?? '' };
    this.hits.set([]); this.customerSearch = '';
    this.requote();
  }

  findProducts() {
    const q = this.productSearch.trim();
    if (q.length < 2) { this.productHits.set([]); return; }
    this.debounce('p', () => this.api.get<Paged<ProductRow>>('admin/products', { search: q, status: 'published', pageSize: 12 }).subscribe(r => this.productHits.set(r.items)));
  }

  addProduct(p: ProductRow) {
    this.productHits.set([]); this.productSearch = '';
    const line: Line = { productId: p.id, variantId: null, quantity: 1, unitPrice: null, name: p.name, image: p.imageUrl, variants: [] };
    if (!p.variantsCount) { this.lines.update(l => [...l, line]); this.requote(); return; }
    this.api.get<ProductDetail>(`admin/products/${p.id}`).subscribe(d => {
      line.variants = d.variants.filter(v => v.isActive && v.id).map(v => ({ id: v.id!, name: v.name, price: v.sellingPrice, available: v.isAvailable }));
      line.variantId = line.variants.find(v => v.available)?.id ?? line.variants[0]?.id ?? null;
      this.lines.update(l => [...l, line]);
      this.requote();
    });
  }

  removeLine(i: number) { this.lines.update(l => l.filter((_, j) => j !== i)); this.requote(); }

  setPrice(l: Line, v: number | null) { l.unitPrice = v === null || v === undefined || isNaN(+v) ? null : +v; this.requote(); }

  quoteLine(l: Line) { return this.quote()?.lines.find(q => q.productId === l.productId && (q.variantId ?? null) === l.variantId) ?? null; }

  private items() { return this.lines().filter(l => !l.variants.length || l.variantId).map(l => ({ productId: l.productId, variantId: l.variantId, quantity: Math.max(1, +l.quantity || 1), unitPrice: l.unitPrice })); }

  requote() {
    this.debounce('q', () => {
      const items = this.items();
      if (!items.length) { this.quote.set(null); return; }
      this.api.post<Quote>('admin/orders/manual/quote', { items, discount: +this.discount || 0, shippingFee: this.shipping, pincode: this.addr.pincode.length === 6 ? this.addr.pincode : null })
        .subscribe(q => this.quote.set(q));
    }, 300);
  }

  canCreate() {
    return !!this.channel && !!this.name.trim() && this.validPhone() && !!this.addr.line1.trim() && this.addr.pincode.length === 6
      && !!this.addr.city.trim() && this.items().length > 0 && this.items().length === this.lines().length && !!this.quote()
      && (this.payMode !== 'Advance' || (this.advance ?? 0) > 0);
  }

  create() {
    this.saving.set(true);
    this.api.post<Result>('admin/orders/manual', {
      customerId: this.customerId, name: this.name, phone: this.phone, email: this.email || null,
      address: { ...this.addr, fullName: this.addr.fullName || this.name, phone: this.addr.phone || this.phone, line2: this.addr.line2 || null, landmark: this.addr.landmark || null },
      channel: this.channel, channelReference: this.channelRef || null, items: this.items(),
      discount: +this.discount || 0, shippingFee: this.shipping, customerNotes: this.customerNotes || null, adminNotes: this.adminNotes || null,
      expectedDeliveryDate: this.deliveryDate || null, customerGstin: this.gstin || null,
      paymentMode: this.payMode, paymentMethod: this.payMethod, amountPaid: this.payMode === 'Advance' ? this.advance : null,
      paymentReference: this.payRef || null, paidAt: this.payMode === 'Paid' || this.payMode === 'Advance' ? new Date(this.paidOn).toISOString() : null
    }).subscribe({
      next: r => { this.saving.set(false); this.result.set(r); this.toast.success(`Order ${r.orderNumber} created`); },
      error: () => this.saving.set(false)
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text).then(() => this.toast.success('Copied')); }

  startOver() {
    this.result.set(null); this.lines.set([]); this.quote.set(null);
    this.customerId = null; this.name = this.phone = this.email = this.channelRef = this.customerNotes = this.adminNotes = this.gstin = this.payRef = this.deliveryDate = '';
    this.addr = this.emptyAddress(); this.discount = 0; this.shipping = null; this.advance = null; this.payMode = 'PaymentLink';
  }
}
