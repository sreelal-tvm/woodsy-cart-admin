import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { BusinessSettings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';
import { environment } from '../../environments/environment';

interface Staff { id: number; fullName: string; email: string; phone?: string; role: 'Admin' | 'Staff'; isActive: boolean; lastLoginAt?: string; password?: string; }

@Component({
  selector: 'wc-settings',
  imports: [FormsModule, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Business settings</h2>
    <p class="page-subtitle">These details appear on invoices, the storefront footer and order emails.</p>

    <ul class="nav nav-underline mb-4 gap-4">
      @for (t of tabs; track t.key) { <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label }}</a></li> }
    </ul>

    @if (s(); as s) {
      @switch (tab()) {
        @case ('business') {
          <div class="card"><div class="card-body"><div class="row g-3">
            <div class="col-md-6"><label class="form-label">Store name</label><input class="form-control" [(ngModel)]="s.businessName" /></div>
            <div class="col-md-6"><label class="form-label">Legal name (on invoices)</label><input class="form-control" [(ngModel)]="s.legalName" /></div>
            <div class="col-12"><label class="form-label">Tagline</label><input class="form-control" [(ngModel)]="s.tagline" /></div>
            <div class="col-md-6"><label class="form-label">Address line 1</label><input class="form-control" [(ngModel)]="s.addressLine1" /></div>
            <div class="col-md-6"><label class="form-label">Address line 2</label><input class="form-control" [(ngModel)]="s.addressLine2" /></div>
            <div class="col-md-3"><label class="form-label">City</label><input class="form-control" [(ngModel)]="s.city" /></div>
            <div class="col-md-3"><label class="form-label">State</label><input class="form-control" [(ngModel)]="s.state" /></div>
            <div class="col-md-3"><label class="form-label">State code</label><input class="form-control" [(ngModel)]="s.stateCode" /></div>
            <div class="col-md-3"><label class="form-label">Pincode</label><input class="form-control" [(ngModel)]="s.pincode" /></div>
            <div class="col-md-4"><label class="form-label">Phone</label><input class="form-control" [(ngModel)]="s.phone" /></div>
            <div class="col-md-4"><label class="form-label">WhatsApp (for customers)</label><input class="form-control" [(ngModel)]="s.whatsApp" /></div>
            <div class="col-md-4"><label class="form-label">Email</label><input class="form-control" [(ngModel)]="s.email" /></div>
            <div class="col-md-8"><label class="form-label">Phone support hours</label><input class="form-control" [(ngModel)]="s.supportHours" maxlength="100" placeholder="Every day, 10am–10pm" />
              <div class="form-text">Shown under the phone number on the Contact us page. Leave empty to show no hours.</div></div>
            <div class="col-md-4"><label class="form-label">Website</label><input class="form-control" [(ngModel)]="s.website" /></div>
            <div class="col-md-4"><label class="form-label">Instagram URL</label><input class="form-control" [(ngModel)]="s.instagramUrl" /></div>
            <div class="col-md-4"><label class="form-label">Facebook URL</label><input class="form-control" [(ngModel)]="s.facebookUrl" /></div>
            <div class="col-md-4"><label class="form-label">Threads URL</label><input class="form-control" [(ngModel)]="s.threadsUrl" placeholder="https://www.threads.com/@woodsycart" /></div>
            <div class="col-md-4"><label class="form-label">YouTube URL</label><input class="form-control" [(ngModel)]="s.youtubeUrl" placeholder="https://www.youtube.com/@woodsycart" />
              <div class="form-text">Your channel link; Shorts are on the same channel.</div></div>
            <div class="col-md-6"><label class="form-label">Logo for invoices (PNG/JPG)</label>
              <div class="d-flex gap-2 align-items-center">@if (s.logoUrl) { <img class="thumb" [src]="s.logoUrl | media" alt="" /> }<input type="file" class="form-control" accept="image/png,image/jpeg" (change)="uploadLogo($event)" /></div></div>
          </div></div></div>
        }
        @case ('tax') {
          <div class="card"><div class="card-body"><div class="row g-3">
            <div class="col-12">
              <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="gst" [(ngModel)]="s.gstRegistered" /><label class="form-check-label fw-bold" for="gst">I'm registered under GST</label></div>
              <div class="form-text">Off: invoices are "Bills of Supply" without tax. On: "Tax Invoices" with CGST/SGST (Karnataka) or IGST (other states), and input GST on vendor bills is tracked in your P&amp;L.</div>
            </div>
            <div class="col-md-4"><label class="form-label">GSTIN</label><input class="form-control text-uppercase" [(ngModel)]="s.gstin" [disabled]="!s.gstRegistered" /></div>
            <div class="col-md-4"><label class="form-label">PAN</label><input class="form-control text-uppercase" [(ngModel)]="s.pan" /></div>
            <div class="col-md-4"><label class="form-label">Invoice prefix</label><input class="form-control text-uppercase" [(ngModel)]="s.invoicePrefix" /><div class="form-text">e.g. {{ s.invoicePrefix }}/26-27/0001</div></div>
            <div class="col-md-6"><label class="form-label">Bank details (printed on invoice)</label><textarea class="form-control" rows="3" [(ngModel)]="s.bankDetails"></textarea></div>
            <div class="col-md-6"><label class="form-label">UPI id</label><input class="form-control" [(ngModel)]="s.upiId" /></div>
            <div class="col-12"><label class="form-label">Invoice terms & conditions</label><textarea class="form-control" rows="4" [(ngModel)]="s.invoiceTerms"></textarea></div>
          </div></div></div>
        }
        @case ('pricing') {
          <div class="card"><div class="card-body"><div class="row g-3">
            <div class="col-md-4"><label class="form-label">Default commission %</label><input type="number" class="form-control" [(ngModel)]="s.defaultCommissionPercent" />
              <div class="form-text">Added on top of the vendor's price. Category and product overrides win over this.</div></div>
            <div class="col-md-4"><label class="form-label">Price rounding</label>
              <select class="form-select" [(ngModel)]="s.priceRounding">
                <option value="EndWith99">End with 99 (₹12,499)</option><option value="Nearest10">Round up to ₹10</option><option value="Nearest100">Round up to ₹100</option><option value="None">No rounding</option>
              </select></div>
            <div class="col-md-4"><label class="form-label">Default GST %</label>
              <select class="form-select" [(ngModel)]="s.defaultGstRate">@for (g of [0, 5, 12, 18, 28]; track g) { <option [ngValue]="g">{{ g }}%</option> }</select>
              <div class="form-text">Used for new products and vendor items without a GST rate. Each product's own rate can be changed on the product page or in bulk from the product list.</div></div>
            <div class="col-md-8">
              <div class="form-check form-switch mt-md-4">
                <input class="form-check-input" type="checkbox" id="incl" [(ngModel)]="s.vendorPricesIncludeGst" />
                <label class="form-check-label" for="incl">Vendor prices already include GST</label>
              </div>
              <div class="form-text">Leave <b>off</b> for GB Furniture — their website prices are before GST, and 18% is added on top. Your cost is then vendor price + GST.</div>
            </div>
            <div class="col-12">
              <div class="border rounded p-3 bg-body-tertiary fs-7">
                <div class="fw-bold mb-1">Example (vendor price ₹10,000)</div>
                @if (!s.vendorPricesIncludeGst) { ₹10,000 + {{ s.defaultGstRate }}% GST = <b>your cost {{ exampleCost() | inr }}</b> → }
                @else { Your cost <b>₹10,000</b> → }
                + {{ s.defaultCommissionPercent }}% commission → <b>you sell at {{ example() | inr }}</b>
                (your margin {{ example() - exampleCost() | inr }})
              </div>
            </div>
            <div class="col-12"><div class="alert alert-info py-2 fs-7 mb-0">Saving a new commission, rounding or the GST-inclusive switch reprices all products that don't have a manual price.</div></div>
          </div></div></div>
        }
        @case ('maps') {
          <div class="row g-3">
            <div class="col-xl-5">
              <div class="card"><div class="card-body">
                <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="mp" [(ngModel)]="s.mapsEnabled" />
                  <label class="form-check-label fw-bold" for="mp">Let customers pin their location on a map</label></div>
                <label class="form-label">Google Maps API key</label>
                <input class="form-control font-monospace" [(ngModel)]="s.googleMapsApiKey" placeholder="AIza…" autocomplete="off" />
                <div class="form-text">This browser key is visible to visitors by design — that's why step 5 restricts it to your website.</div>
                <div class="border rounded p-3 bg-body-tertiary fs-7 mt-3">
                  <div class="fw-bold mb-1">What customers get</div>
                  On the address form at checkout and in My account: <b>search with Google suggestions</b>, <b>Use my current location</b>, and a map with a pin.
                  Pincode, city, state and area fill in by themselves; the exact point is saved with the order and shown to you (and the vendor) as a Google Maps link.
                </div>
                <div class="alert alert-subtle-info py-2 fs-7 mt-3 mb-0"><i class="bi bi-cash-coin me-1"></i>Cost: Google's India pricing gives 70,000 free map loads, address lookups and search suggestions every month — about 14,000 checkouts. Set the caps in step 6 and you can never be charged.</div>
              </div></div>
            </div>
            <div class="col-xl-7">
              <div class="card"><div class="card-body fs-7">
                <h5>Set up the key (about 10 minutes)</h5>
                <ol class="ps-3 mb-0">
                  <li class="mb-2">Open <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a>, sign in, and create a project named <b>WoodsyCart</b>.</li>
                  <li class="mb-2"><b>Billing</b> → link a billing account (needs a card; India accounts are billed in ₹). Nothing is charged within the free allowance.</li>
                  <li class="mb-2"><b>APIs &amp; Services → Library</b> → enable <b>Maps JavaScript API</b>, <b>Places API (New)</b> and <b>Geocoding API</b>.</li>
                  <li class="mb-2"><b>APIs &amp; Services → Credentials → Create credentials → API key</b>. Copy it into the box on the left.</li>
                  <li class="mb-2">Edit the key:
                    <ul class="mt-1">
                      <li><b>Application restrictions → Websites</b>: add <code>{{ storefront }}/*</code>@if (storefrontWww) {, <code>{{ storefrontWww }}/*</code>} and, for testing, <code>http://localhost:4200/*</code>.</li>
                      <li><b>API restrictions → Restrict key</b>: tick only the three APIs from step 3.</li>
                    </ul></li>
                  <li class="mb-2"><b>Stay free:</b> in <b>APIs &amp; Services → each API → Quotas</b>, set every "…per day" limit to 2,000 (Maps JavaScript: Map loads per day, and 3D Map loads per day to 0; Places API (New): autocomplete and place details; Geocoding: requests) — 2,000 × 31 days stays under the 70,000 free per month, and add a <b>Billing → Budgets &amp; alerts</b> budget of ₹100 with email alerts.</li>
                  <li>Switch the map on here, <b>Save settings</b>, then open the store's checkout to try it.</li>
                </ol>
              </div></div>
            </div>
          </div>
        }
        @case ('checkout') {
          <div class="card"><div class="card-body"><div class="row g-3">
            <div class="col-md-4"><label class="form-label">Delivery fee ₹</label><input type="number" class="form-control" [(ngModel)]="s.shippingFee" /></div>
            <div class="col-md-4"><label class="form-label">Free delivery above ₹</label><input type="number" class="form-control" [(ngModel)]="s.freeShippingThreshold" /><div class="form-text">0 = always charge the fee (or free if fee is 0)</div></div>
            <div class="col-md-4"><label class="form-label">Default delivery days</label><input type="number" class="form-control" [(ngModel)]="s.defaultDeliveryDays" /></div>
            <div class="col-md-4"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" id="cod" [(ngModel)]="s.codEnabled" /><label class="form-check-label" for="cod">Allow cash on delivery</label></div></div>
            <div class="col-md-4"><label class="form-label">COD fee ₹</label><input type="number" class="form-control" [(ngModel)]="s.codFee" /></div>
            <div class="col-md-4"><label class="form-label">Max COD order ₹</label><input type="number" class="form-control" [(ngModel)]="s.codMaxOrderAmount" /></div>
            <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="rp" [(ngModel)]="s.restrictToServiceablePincodes" /><label class="form-check-label" for="rp">Only deliver to pincodes in the delivery list</label></div></div>
            <div class="col-12"><div class="alert alert-warning py-2 fs-7 mb-0"><i class="bi bi-lightbulb me-1"></i>Furniture is made to order — a cancelled COD order still costs you the vendor's price. Keep the COD limit low or ask for an advance on large orders.</div></div>
          </div></div></div>
        }
        @case ('staff') {
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center"><h5 class="mb-0">Team</h5><button class="btn btn-sm btn-primary" (click)="editStaff(null)"><i class="bi bi-plus me-1"></i>Add member</button></div>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  @for (u of staff(); track u.id) {
                    <tr><td class="fw-bold">{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td>
                      <td class="text-muted">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd MMM, h:mm a') : '—' }}</td>
                      <td><span [class]="u.isActive ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-secondary'">{{ u.isActive ? 'Active' : 'Disabled' }}</span></td>
                      <td class="text-end"><button class="btn btn-sm btn-phoenix-secondary btn-icon" (click)="editStaff(u)"><i class="bi bi-pencil"></i></button></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="card mt-3"><div class="card-body">
            <h5>Change my password</h5>
            <div class="row g-2" style="max-width: 600px">
              <div class="col-md-6"><input type="password" class="form-control" [(ngModel)]="pw.currentPassword" placeholder="Current password" autocomplete="current-password" /></div>
              <div class="col-md-6"><input type="password" class="form-control" [(ngModel)]="pw.newPassword" placeholder="New password (8+ chars)" autocomplete="new-password" /></div>
              <div class="col-12"><button class="btn btn-sm btn-phoenix-secondary" [disabled]="pw.newPassword.length < 8" (click)="changePassword()">Update password</button></div>
            </div>
          </div></div>
        }
      }
      @if (tab() !== 'staff') {
        <div class="sticky-actions d-flex justify-content-end mt-3"><button class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save settings' }}</button></div>
      }
    }

    @if (staffForm(); as f) {
      <wc-modal [title]="f.id ? 'Edit team member' : 'Add team member'" (closed)="staffForm.set(null)">
        <div class="row g-2">
          <div class="col-6"><label class="form-label">Name</label><input class="form-control" [(ngModel)]="f.fullName" /></div>
          <div class="col-6"><label class="form-label">Email</label><input class="form-control" [(ngModel)]="f.email" [disabled]="!!f.id" /></div>
          <div class="col-6"><label class="form-label">Phone</label><input class="form-control" [(ngModel)]="f.phone" /></div>
          <div class="col-6"><label class="form-label">Role</label><select class="form-select" [(ngModel)]="f.role"><option value="Staff">Staff</option><option value="Admin">Admin</option></select></div>
          <div class="col-12"><label class="form-label">{{ f.id ? 'Reset password (optional)' : 'Password' }}</label><input type="password" class="form-control" [(ngModel)]="f.password" autocomplete="new-password" /></div>
          <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="sa" [(ngModel)]="f.isActive" /><label class="form-check-label" for="sa">Active</label></div></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="staffForm.set(null)">Close</button><button class="btn btn-primary" (click)="saveStaff()">Save</button></ng-container>
      </wc-modal>
    }
  `
})
export class SettingsPage {
  private api = inject(ApiService);
  /** Live storefront address from config.json (for the Google key's website list). */
  protected storefront = environment.storefrontUrl;
  protected storefrontWww = /^https:\/\/(?!www\.)[^/]+$/.test(environment.storefrontUrl) ? environment.storefrontUrl.replace('https://', 'https://www.') : null;
  private toast = inject(ToastService);
  protected tabs = [
    { key: 'business', label: 'Business' }, { key: 'tax', label: 'GST & invoices' }, { key: 'pricing', label: 'Pricing & commission' },
    { key: 'checkout', label: 'Delivery & payments' }, { key: 'maps', label: 'Maps' }, { key: 'staff', label: 'Team & security' }
  ];
  protected tab = signal('business');
  protected s = signal<BusinessSettings | null>(null);
  protected staff = signal<Staff[]>([]);
  protected staffForm = signal<Staff | null>(null);
  protected saving = signal(false);
  pw = { currentPassword: '', newPassword: '' };

  constructor() {
    this.api.get<BusinessSettings>('admin/settings').subscribe(s => this.s.set(s));
    this.loadStaff();
  }

  exampleCost() {
    const s = this.s()!;
    return s.vendorPricesIncludeGst ? 10000 : Math.round(10000 * (1 + s.defaultGstRate / 100));
  }

  example() {
    const s = this.s()!;
    const raw = this.exampleCost() * (1 + s.defaultCommissionPercent / 100);
    switch (s.priceRounding) {
      case 'Nearest10': return Math.ceil(raw / 10) * 10;
      case 'Nearest100': return Math.ceil(raw / 100) * 100;
      case 'EndWith99': return Math.max(99, Math.ceil(raw / 100) * 100 - 1);
      default: return Math.round(raw);
    }
  }

  save() {
    this.saving.set(true);
    this.api.put<{ repricedProducts: number }>('admin/settings', this.s()).subscribe({
      next: r => { this.saving.set(false); this.toast.success(r.repricedProducts ? `Settings saved · ${r.repricedProducts} products repriced` : 'Settings saved'); },
      error: () => this.saving.set(false)
    });
  }

  uploadLogo(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'branding' }).subscribe(r => this.s.update(s => s ? { ...s, logoUrl: r.url } : s));
  }

  loadStaff() { this.api.get<Staff[]>('admin/staff').subscribe(r => this.staff.set(r)); }
  editStaff(u: Staff | null) { this.staffForm.set(u ? { ...u, password: '' } : { id: 0, fullName: '', email: '', role: 'Staff', isActive: true, password: '' }); }
  saveStaff() {
    const f = this.staffForm()!;
    const req = f.id ? this.api.put(`admin/staff/${f.id}`, f) : this.api.post('admin/staff', f);
    req.subscribe(() => { this.staffForm.set(null); this.toast.success('Team member saved'); this.loadStaff(); });
  }
  changePassword() {
    this.api.post('auth/change-password', this.pw).subscribe(() => { this.pw = { currentPassword: '', newPassword: '' }; this.toast.success('Password updated'); });
  }
}
