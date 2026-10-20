import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

interface ProviderField { key: string; label: string; secret: boolean; placeholder?: string; help?: string; required: boolean; value?: string; hasValue: boolean; }
interface Provider {
  code: string; name: string; description: string; methods: string[]; implemented: boolean; isEnabled: boolean; isTestMode: boolean;
  isConfigured: boolean; fields: ProviderField[]; docsUrl?: string; feeNote?: string;
}
interface MethodOption { method: string; isEnabled: boolean; providerCode: string; label: string; description?: string; sortOrder: number; allowedProviders: string[]; }
interface Alert { id: number; createdAt: string; source: string; sender?: string; rawText: string; amount?: number; utr?: string; status: string; orderId?: number; orderNumber?: string; note?: string; }
interface Awaiting { id: number; orderNumber: string; createdAt: string; customer: string; phone: string; paymentProvider?: string; paymentMethod: string; total: number; upiAmount?: number; amountPaid: number; customerUtr?: string; }
interface Parsed { isCredit: boolean; amount?: number; utr?: string; reason?: string; }

@Component({
  selector: 'wc-payments',
  imports: [FormsModule, RouterLink, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Payment integrations</h2>
    <p class="page-subtitle">Choose how customers pay. UPI goes straight to your business UPI ID (no gateway, no commission); cards, net banking and EMI can go through a payment gateway.</p>

    <ul class="nav nav-underline mb-4 gap-4">
      <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'methods'" (click)="tab.set('methods')">Checkout methods</a></li>
      <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'providers'" (click)="tab.set('providers')">Providers</a></li>
      <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'upi'" (click)="tab.set('upi'); loadUpi()">
        UPI verification @if (awaitingCount()) { <span class="badge rounded-pill bg-warning ms-1">{{ awaitingCount() }}</span> }</a></li>
    </ul>

    @switch (tab()) {
      <!-- ============ CHECKOUT METHODS ============ -->
      @case ('methods') {
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">What customers see at checkout</h5>
            <div class="text-muted fs-7">A method appears only when it's on and its provider is enabled and fully configured.</div>
          </div>
          <div class="table-responsive">
            <table class="table align-middle">
              <thead><tr><th style="width: 60px">On</th><th>Method</th><th>Shown to customer</th><th>Processed by</th><th>Status</th><th style="width: 90px">Order</th></tr></thead>
              <tbody>
                @for (m of methods(); track m.method) {
                  <tr>
                    <td><div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" [(ngModel)]="m.isEnabled" /></div></td>
                    <td class="fw-bold">{{ m.method | humanize }}</td>
                    <td>
                      <input class="form-control form-control-sm mb-1" [(ngModel)]="m.label" />
                      <input class="form-control form-control-sm" [(ngModel)]="m.description" placeholder="Short description" />
                    </td>
                    <td style="min-width: 220px">
                      <select class="form-select form-select-sm" [(ngModel)]="m.providerCode">
                        @for (code of m.allowedProviders; track code) {
                          <option [value]="code">{{ providerName(code) }}{{ isImplemented(code) ? '' : ' (coming soon)' }}</option>
                        }
                      </select>
                      @if (m.method === 'Upi' && m.providerCode === 'DirectUpi') { <div class="fs-8 text-success mt-1"><i class="bi bi-check-circle"></i> No gateway — ₹0 commission</div> }
                    </td>
                    <td><span [class]="methodStatus(m).cls">{{ methodStatus(m).text }}</span></td>
                    <td><input type="number" class="form-control form-control-sm" [(ngModel)]="m.sortOrder" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-transparent d-flex justify-content-between align-items-center">
            <span class="fs-7 text-muted">Tip: keep <b>UPI</b> first — it's free for you and the fastest for customers.</span>
            <button class="btn btn-primary" (click)="saveMethods()">Save checkout methods</button>
          </div>
        </div>
      }

      <!-- ============ PROVIDERS ============ -->
      @case ('providers') {
        <div class="row g-3">
          @for (p of providers(); track p.code) {
            <div class="col-xl-6">
              <div class="card h-100" [class.border-primary]="p.isEnabled">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div>
                      <h5 class="mb-1">{{ p.name }}</h5>
                      <div class="d-flex flex-wrap gap-1">
                        @if (!p.implemented) { <span class="badge-soft badge-soft-secondary">Integration coming soon</span> }
                        @else if (p.isEnabled && p.isConfigured) { <span class="badge-soft badge-soft-success">Active</span> }
                        @else if (p.isEnabled) { <span class="badge-soft badge-soft-warning">Needs setup</span> }
                        @else { <span class="badge-soft badge-soft-secondary">Off</span> }
                        @for (m of p.methods; track m) { <span class="badge-soft badge-soft-primary">{{ m | humanize }}</span> }
                      </div>
                    </div>
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="edit(p)"><i class="bi bi-pencil me-1"></i>Configure</button>
                  </div>
                  <p class="fs-7 text-muted mb-2">{{ p.description }}</p>
                  @if (p.feeNote) { <div class="fs-7"><i class="bi bi-cash-coin me-1 text-success"></i>{{ p.feeNote }}</div> }
                  @if (p.fields.length) {
                    <div class="fs-8 text-muted mt-2">
                      @for (f of p.fields; track f.key) { <span class="me-3">{{ f.label }}: <b [class.text-danger]="f.required && !f.hasValue">{{ f.hasValue ? (f.secret ? 'saved' : f.value) : 'not set' }}</b></span> }
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ============ UPI VERIFICATION ============ -->
      @case ('upi') {
        <div class="row g-3">
          <div class="col-xl-7">
            <div class="card mb-3">
              <div class="card-header"><h5 class="mb-0">Waiting for payment</h5><div class="text-muted fs-7">Direct UPI and bank-transfer orders not yet paid. Orders with a customer reference (UTR) are listed first.</div></div>
              <div class="table-responsive">
                <table class="table align-middle">
                  <thead><tr><th>Order</th><th>Customer</th><th class="text-end">Amount to receive</th><th>Customer UTR</th><th></th></tr></thead>
                  <tbody>
                    @for (o of awaiting(); track o.id) {
                      <tr>
                        <td><a class="fw-bold" [routerLink]="['/orders', o.id]">#{{ o.orderNumber }}</a><div class="fs-8 text-muted">{{ o.createdAt | date: 'dd MMM, h:mm a' }} · {{ o.paymentProvider === 'BankTransfer' ? 'Bank transfer' : 'UPI' }}</div></td>
                        <td>{{ o.customer }}<div class="fs-8 text-muted">{{ o.phone }}</div></td>
                        <td class="text-end fw-bold">{{ (o.upiAmount ?? o.total) - o.amountPaid | inr: true }}</td>
                        <td>@if (o.customerUtr) { <span class="font-monospace">{{ o.customerUtr }}</span> } @else { <span class="text-muted">—</span> }</td>
                        <td class="text-end"><button class="btn btn-sm btn-soft-primary" (click)="openConfirm(o)">Confirm paid</button></td>
                      </tr>
                    } @empty { <tr><td colspan="5"><div class="empty-state py-4"><i class="bi bi-check2-all"></i>Nothing waiting — all payments are confirmed.</div></td></tr> }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Payment alerts received</h5>
                <select class="form-select form-select-sm w-auto" [(ngModel)]="alertFilter" (change)="loadAlerts()">
                  <option value="">All</option><option value="Unmatched">Unmatched</option><option value="Matched">Matched</option><option value="Duplicate">Duplicate</option><option value="NotACredit">Not a credit</option>
                </select>
              </div>
              <div class="table-responsive" style="max-height: 520px">
                <table class="table table-sm align-middle">
                  <thead class="sticky-top bg-body"><tr><th>Received</th><th class="text-end">Amount</th><th>UTR</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    @for (a of alerts(); track a.id) {
                      <tr>
                        <td><span class="fs-8 text-muted">{{ a.createdAt | date: 'dd MMM, h:mm:ss a' }} · {{ a.source }}{{ a.sender ? ' · ' + a.sender : '' }}</span>
                          <div class="fs-8 text-truncate" style="max-width: 320px" [title]="a.rawText">{{ a.rawText }}</div></td>
                        <td class="text-end fw-bold">{{ a.amount | inr: true }}</td>
                        <td class="font-monospace fs-8">{{ a.utr || '—' }}</td>
                        <td><span [class]="alertCls(a.status)">{{ a.status | humanize }}</span>
                          @if (a.orderNumber) { <div class="fs-8"><a [routerLink]="['/orders', a.orderId]">#{{ a.orderNumber }}</a></div> }
                          @else if (a.note) { <div class="fs-8 text-muted" style="max-width: 200px">{{ a.note }}</div> }</td>
                        <td class="text-end text-nowrap">
                          @if (a.status === 'Unmatched') {
                            <button class="btn btn-sm btn-soft-primary" (click)="matching.set(a)">Match</button>
                            <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="ignore(a)">Ignore</button>
                          }
                        </td>
                      </tr>
                    } @empty { <tr><td colspan="5" class="text-center text-muted py-4">No alerts yet. Set up the forwarder on your phone →</td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="col-xl-5">
            <div class="card mb-3">
              <div class="card-header"><h5 class="mb-0"><i class="bi bi-phone me-2 text-primary"></i>Automatic confirmation setup</h5></div>
              <div class="card-body fs-7">
                <p>Your phone forwards every <b>"money received"</b> SMS or PhonePe/Paytm Business notification to this address. The amount (unique per order) and UPI reference are matched to the order, which is then confirmed automatically.</p>
                @if (setup(); as s) {
                  <label class="form-label">Forwarding address (POST)</label>
                  <div class="input-group input-group-sm mb-2">
                    <input class="form-control font-monospace" [value]="s.webhookUrl" readonly />
                    <button class="btn btn-phoenix-secondary" (click)="copy(s.webhookUrl)"><i class="bi bi-copy"></i></button>
                  </div>
                  <div class="text-danger fs-8 mb-2"><i class="bi bi-shield-lock me-1"></i>Keep this address private — it contains your secret key. <a class="cursor-pointer" (click)="regenerate()">Generate a new key</a> if it leaks.</div>
                }
                <ol class="ps-3 mb-0">
                  <li>On the Android phone that receives your bank / PhonePe Business alerts, install an SMS &amp; notification forwarder app (for example the open-source <b>httpSMS</b> or "SMS Forwarder").</li>
                  <li>Add a rule: forward messages containing <b>credited</b> or <b>received</b> to the address above (method POST).</li>
                  <li>Keep the phone on with internet. Use the box below to test that your bank's SMS is read correctly.</li>
                  <li>When this API goes live, the address changes to your real domain — update the app then.</li>
                </ol>
              </div>
            </div>

            <div class="card">
              <div class="card-header"><h5 class="mb-0">Test a bank SMS</h5></div>
              <div class="card-body">
                <textarea class="form-control fs-7 mb-2" rows="3" [(ngModel)]="sample" placeholder="Paste a 'credited' SMS from your bank or UPI app"></textarea>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-phoenix-secondary" (click)="parse()">Check how it's read</button>
                  <button class="btn btn-sm btn-soft-primary" (click)="addManual()" title="Use if your phone was offline when the payment came in">Add as a payment alert</button>
                </div>
                @if (parsed(); as r) {
                  <div class="mt-3 fs-7 border rounded p-2">
                    @if (r.isCredit) {
                      <i class="bi bi-check-circle text-success me-1"></i>Credit · amount <b>{{ r.amount | inr: true }}</b> · UTR <b>{{ r.utr || 'not found' }}</b>
                      @if (r.reason) { <div class="text-warning">{{ r.reason }}</div> }
                    } @else { <i class="bi bi-x-circle text-danger me-1"></i>{{ r.reason }} }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }
    }

    <!-- Configure provider -->
    @if (editing(); as p) {
      <wc-modal [title]="'Configure ' + p.name" (closed)="editing.set(null)">
        @if (!p.implemented) { <div class="alert alert-info py-2 fs-7">Checkout for {{ p.name }} isn't built yet. You can save your credentials now; we'll switch it on once the integration is added.</div> }
        @for (f of p.fields; track f.key) {
          @if (f.key !== 'alertKey') {
            <div class="mb-3">
              <label class="form-label">{{ f.label }} @if (f.required) { <span class="text-danger">*</span> }</label>
              <input class="form-control" [type]="f.secret ? 'password' : 'text'" [(ngModel)]="form[f.key]" [placeholder]="f.secret && f.hasValue ? 'Saved — type to replace' : (f.placeholder ?? '')" autocomplete="off" />
              @if (f.help) { <div class="form-text">{{ f.help }}</div> }
            </div>
          }
        }
        @if (!p.fields.length) { <p class="fs-7 text-muted">No settings needed. Cash on delivery limits and fee are in Settings → Delivery &amp; payments.</p> }
        <div class="d-flex flex-wrap gap-4">
          <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="pe" [(ngModel)]="formEnabled" [disabled]="!p.implemented" /><label class="form-check-label" for="pe">Enabled</label></div>
          @if (gatewayCodes.includes(p.code)) {
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="pt" [(ngModel)]="formTest" /><label class="form-check-label" for="pt">Test mode</label></div>
          }
        </div>
        @if (p.docsUrl) { <a class="fs-7 d-inline-block mt-2" [href]="p.docsUrl" target="_blank" rel="noopener">Where do I find these? <i class="bi bi-box-arrow-up-right"></i></a> }
        @if (testResult(); as t) { <div class="alert py-2 fs-7 mt-3 mb-0" [class.alert-success]="t.ok" [class.alert-danger]="!t.ok">{{ t.message }}</div> }
        <ng-container footer>
          @if (p.implemented && p.fields.length) { <button class="btn btn-phoenix-secondary me-auto" (click)="test(p)">Test connection</button> }
          <button class="btn btn-phoenix-secondary" (click)="editing.set(null)">Close</button>
          <button class="btn btn-primary" (click)="saveProvider(p)">Save</button>
        </ng-container>
      </wc-modal>
    }

    <!-- Match an alert -->
    @if (matching(); as a) {
      <wc-modal title="Match payment to an order" (closed)="matching.set(null)">
        <p class="fs-7">Received <b>{{ a.amount | inr: true }}</b>@if (a.utr) { (UTR {{ a.utr }}) }. Pick the order it belongs to:</p>
        <select class="form-select" [(ngModel)]="matchOrderId">
          <option [ngValue]="null">Select order…</option>
          @for (o of awaiting(); track o.id) { <option [ngValue]="o.id">#{{ o.orderNumber }} · {{ o.customer }} · {{ (o.upiAmount ?? o.total) - o.amountPaid | inr: true }}</option> }
        </select>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="matching.set(null)">Close</button><button class="btn btn-primary" [disabled]="!matchOrderId" (click)="match(a)">Mark order paid</button></ng-container>
      </wc-modal>
    }

    <!-- Confirm manually -->
    @if (confirming(); as o) {
      <wc-modal [title]="'Confirm payment for #' + o.orderNumber" (closed)="confirming.set(null)">
        <div class="alert alert-warning py-2 fs-7">Only confirm after you've seen the money in your bank or UPI business app — never from a screenshot.</div>
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Amount received</label><input type="number" class="form-control" [(ngModel)]="confirmAmount" /></div>
          <div class="col-6"><label class="form-label">UPI reference / UTR</label><input class="form-control" [(ngModel)]="confirmRef" /></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="confirming.set(null)">Close</button><button class="btn btn-primary" (click)="confirm(o)">Confirm paid</button></ng-container>
      </wc-modal>
    }
  `
})
export class PaymentsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected tab = signal<'methods' | 'providers' | 'upi'>('methods');
  protected providers = signal<Provider[]>([]);
  protected methods = signal<MethodOption[]>([]);
  protected awaiting = signal<Awaiting[]>([]);
  protected alerts = signal<Alert[]>([]);
  protected setup = signal<{ webhookUrl: string; key: string } | null>(null);
  protected parsed = signal<Parsed | null>(null);
  protected editing = signal<Provider | null>(null);
  protected matching = signal<Alert | null>(null);
  protected confirming = signal<Awaiting | null>(null);
  protected testResult = signal<{ ok: boolean; message: string } | null>(null);
  protected awaitingCount = computed(() => this.awaiting().filter(a => a.customerUtr).length);
  protected gatewayCodes = ['Razorpay', 'PhonePe', 'Cashfree', 'PayU', 'PaytmPg'];
  form: Record<string, string> = {};
  formEnabled = false;
  formTest = true;
  alertFilter = '';
  sample = '';
  matchOrderId: number | null = null;
  confirmAmount = 0;
  confirmRef = '';

  constructor() {
    this.loadProviders();
    this.api.get<MethodOption[]>('admin/payments/methods').subscribe(m => this.methods.set(m));
    this.api.get<Awaiting[]>('admin/payments/awaiting').subscribe(a => this.awaiting.set(a));
  }

  loadProviders() { this.api.get<Provider[]>('admin/payments/providers').subscribe(p => this.providers.set(p)); }

  loadUpi() {
    this.api.get<Awaiting[]>('admin/payments/awaiting').subscribe(a => this.awaiting.set(a));
    this.api.get<{ webhookUrl: string; key: string }>('admin/payments/upi/setup').subscribe(s => this.setup.set(s));
    this.loadAlerts();
  }

  loadAlerts() { this.api.get<Alert[]>('admin/payments/alerts', { status: this.alertFilter }).subscribe(a => this.alerts.set(a)); }

  providerName(code: string) { return this.providers().find(p => p.code === code)?.name ?? code; }
  isImplemented(code: string) { return this.providers().find(p => p.code === code)?.implemented ?? false; }

  methodStatus(m: MethodOption) {
    const p = this.providers().find(x => x.code === m.providerCode);
    if (!m.isEnabled) return { text: 'Off', cls: 'badge-soft badge-soft-secondary' };
    if (!p?.implemented) return { text: 'Provider not built yet', cls: 'badge-soft badge-soft-danger' };
    if (m.providerCode === 'CashOnDelivery') return { text: 'Live', cls: 'badge-soft badge-soft-success' };
    if (!p.isEnabled || !p.isConfigured) return { text: 'Configure provider', cls: 'badge-soft badge-soft-warning' };
    return { text: 'Live', cls: 'badge-soft badge-soft-success' };
  }

  saveMethods() {
    this.api.put<MethodOption[]>('admin/payments/methods', this.methods()).subscribe(m => { this.methods.set(m); this.toast.success('Checkout methods saved'); });
  }

  edit(p: Provider) {
    this.form = Object.fromEntries(p.fields.map(f => [f.key, f.secret ? '' : (f.value ?? '')]));
    this.formEnabled = p.isEnabled;
    this.formTest = p.isTestMode;
    this.testResult.set(null);
    this.editing.set(p);
  }

  saveProvider(p: Provider) {
    // Empty secret inputs mean "keep the saved value".
    const values: Record<string, string | null> = {};
    for (const f of p.fields) {
      if (f.key === 'alertKey') continue;
      const v = this.form[f.key] ?? '';
      if (f.secret && v === '' && f.hasValue) continue;
      values[f.key] = v;
    }
    this.api.put<Provider[]>(`admin/payments/providers/${p.code}`, { isEnabled: this.formEnabled, isTestMode: this.formTest, values }).subscribe(list => {
      this.providers.set(list);
      this.editing.set(null);
      this.toast.success(`${p.name} saved`);
    });
  }

  test(p: Provider) {
    this.api.post<{ ok: boolean; message: string }>(`admin/payments/providers/${p.code}/test`).subscribe(r => this.testResult.set(r));
  }

  copy(text: string) { navigator.clipboard.writeText(text).then(() => this.toast.success('Copied')); }

  regenerate() {
    if (!confirm('Generate a new key? The forwarder app on your phone must be updated with the new address.')) return;
    this.api.post<{ webhookUrl: string; key: string }>('admin/payments/upi/regenerate-key').subscribe(s => { this.setup.set(s); this.toast.success('New key generated'); });
  }

  parse() { this.api.post<Parsed>('admin/payments/upi/parse', { text: this.sample }).subscribe(r => this.parsed.set(r)); }

  addManual() {
    this.api.post<{ message: string }>('admin/payments/alerts', { text: this.sample }).subscribe(r => { this.toast.info(r.message); this.sample = ''; this.loadUpi(); });
  }

  match(a: Alert) {
    this.api.post<{ message: string }>(`admin/payments/alerts/${a.id}/match`, { orderId: this.matchOrderId }).subscribe(r => {
      this.toast.success(r.message); this.matching.set(null); this.matchOrderId = null; this.loadUpi();
    });
  }

  ignore(a: Alert) { this.api.post(`admin/payments/alerts/${a.id}/ignore`).subscribe(() => this.loadAlerts()); }

  openConfirm(o: Awaiting) {
    this.confirmAmount = (o.upiAmount ?? o.total) - o.amountPaid;
    this.confirmRef = o.customerUtr ?? '';
    this.confirming.set(o);
  }

  confirm(o: Awaiting) {
    this.api.post(`admin/payments/orders/${o.id}/confirm`, { amount: this.confirmAmount, reference: this.confirmRef || null }).subscribe(() => {
      this.toast.success(`Order ${o.orderNumber} marked paid`); this.confirming.set(null); this.loadUpi();
    });
  }

  alertCls(s: string) {
    return 'badge-soft badge-soft-' + ({ Matched: 'success', Unmatched: 'warning', Duplicate: 'secondary', Ignored: 'secondary', NotACredit: 'secondary' } as Record<string, string>)[s];
  }
}
