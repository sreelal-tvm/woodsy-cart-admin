import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AdminOption, ProductDetail } from '../../core/models';
import { ToastService } from '../../core/toast.service';

interface EditValue {
  id?: number; value: string; colorCode: string | null; vendorValue?: string; vendorColorCode?: string;
  fromVendor: boolean; isHidden: boolean; variants: number; copyFromValueId?: number | null;
}
interface EditOption { id?: number; name: string; vendorName?: string; isColour: boolean; fromVendor: boolean; values: EditValue[]; }

const HEX = /^#[0-9a-f]{6}$/i;

/** Options & colours editor on the product page: rename, recolour, reorder, add and remove — kept through vendor syncs. */
@Component({
  selector: 'wc-product-options',
  imports: [FormsModule],
  styles: [`
    .opt-card { border: 1px solid var(--bs-border-color); border-radius: .5rem; padding: 1rem; margin-bottom: 1rem; }
    .val-row { display: flex; align-items: center; gap: .5rem; padding: .4rem 0; border-bottom: 1px dashed var(--bs-border-color); flex-wrap: wrap; }
    .val-row:last-of-type { border-bottom: 0; }
    .val-row.hidden-val { opacity: .5; }
    .swatch { width: 2rem; height: 2rem; border-radius: 50%; border: 1px solid rgba(0,0,0,.15); flex: none; position: relative; overflow: hidden; }
    .swatch input[type=color] { position: absolute; inset: -8px; width: 3rem; height: 3rem; border: 0; padding: 0; cursor: pointer; opacity: 0; }
    .swatch.empty { background: repeating-linear-gradient(45deg, #eee, #eee 4px, #fff 4px, #fff 8px); }
    .hex { width: 6.5rem; font-family: var(--bs-font-monospace); }
    .vendor-note { font-size: .75rem; color: var(--phoenix-gray-600, #6B5A4E); }
    .vendor-dot { display: inline-block; width: .7rem; height: .7rem; border-radius: 50%; border: 1px solid rgba(0,0,0,.15); vertical-align: -1px; }
  `],
  template: `
    <div class="alert alert-subtle-info fs-7 py-2">
      <i class="bi bi-info-circle me-1"></i>Colours and names start exactly as the vendor sends them. Anything you change here is kept when the vendor syncs,
      and new colours the vendor adds still appear automatically.
      @if (hasVariants()) { A new value copies the prices of the value you pick, and keeps following the vendor's price for it. }
    </div>

    @for (o of options(); track $index; let oi = $index) {
      <div class="opt-card">
        <div class="d-flex flex-wrap gap-2 align-items-center mb-1">
          <input class="form-control form-control-sm fw-bold" style="max-width: 220px" [(ngModel)]="o.name" (ngModelChange)="touch()" placeholder="Option name" />
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" [id]="'col' + oi" [(ngModel)]="o.isColour" (ngModelChange)="touch()" />
            <label class="form-check-label fs-7" [for]="'col' + oi">Colour swatches</label>
          </div>
          <div class="ms-auto d-flex gap-1">
            <button class="btn btn-sm btn-phoenix-secondary btn-icon" [disabled]="oi === 0" (click)="moveOption(oi, -1)" title="Move up"><i class="bi bi-arrow-up"></i></button>
            <button class="btn btn-sm btn-phoenix-secondary btn-icon" [disabled]="oi === options().length - 1" (click)="moveOption(oi, 1)" title="Move down"><i class="bi bi-arrow-down"></i></button>
            @if (!o.fromVendor) { <button class="btn btn-sm btn-phoenix-secondary btn-icon text-danger" (click)="removeOption(oi)" title="Remove option"><i class="bi bi-trash"></i></button> }
          </div>
        </div>
        @if (o.vendorName) {
          <div class="vendor-note mb-2">From the vendor as "{{ o.vendorName }}"
            @if (o.name !== defaultName(o)) { · <a role="button" class="link-primary" (click)="o.name = defaultName(o); touch()">use "{{ defaultName(o) }}"</a> }</div>
        } @else { <div class="vendor-note mb-2">Added by you</div> }

        @for (v of o.values; track $index; let vi = $index) {
          <div class="val-row" [class.hidden-val]="v.isHidden">
            <div class="d-flex flex-column">
              <button class="btn btn-link btn-sm p-0 lh-1" [disabled]="vi === 0" (click)="moveValue(o, vi, -1)" title="Move up"><i class="bi bi-chevron-up"></i></button>
              <button class="btn btn-link btn-sm p-0 lh-1" [disabled]="vi === o.values.length - 1" (click)="moveValue(o, vi, 1)" title="Move down"><i class="bi bi-chevron-down"></i></button>
            </div>
            @if (o.isColour) {
              <label class="swatch" [class.empty]="!v.colorCode" [style.background]="v.colorCode" title="Pick colour">
                <input type="color" [ngModel]="v.colorCode || '#cccccc'" (ngModelChange)="v.colorCode = $event; touch()" [disabled]="v.isHidden" />
              </label>
              <input class="form-control form-control-sm hex" [ngModel]="v.colorCode" (ngModelChange)="setHex(v, $event)" placeholder="#rrggbb" [disabled]="v.isHidden" />
            }
            <input class="form-control form-control-sm" style="max-width: 220px" [(ngModel)]="v.value" (ngModelChange)="touch()" [disabled]="v.isHidden" />
            @if (hasVariants() && v.id) { <span class="badge-soft badge-soft-secondary" title="Active variants with this value">{{ v.variants }} variant{{ v.variants === 1 ? '' : 's' }}</span> }
            @if (!v.id) { <span class="badge-soft badge-soft-primary">New</span> }

            <div class="ms-auto d-flex align-items-center gap-2">
              @if (v.fromVendor) {
                <span class="vendor-note text-end">Vendor: {{ v.vendorValue }}
                  @if (v.vendorColorCode) { <span class="vendor-dot ms-1" [style.background]="v.vendorColorCode"></span> {{ v.vendorColorCode }} }
                  @if (differsFromVendor(v)) { · <a role="button" class="link-primary" (click)="resetToVendor(v)">use vendor's</a> }
                </span>
              }
              @if (v.isHidden) {
                <button class="btn btn-sm btn-phoenix-secondary" (click)="v.isHidden = false; touch()"><i class="bi bi-arrow-counterclockwise me-1"></i>Restore</button>
              } @else {
                <button class="btn btn-sm btn-phoenix-secondary btn-icon text-danger" (click)="removeValue(o, vi)" [title]="v.fromVendor ? 'Remove (hidden from customers; the vendor sync won\\'t bring it back)' : 'Remove'"><i class="bi bi-x-lg"></i></button>
              }
            </div>
          </div>
        }

        <!-- Add a value -->
        <div class="d-flex flex-wrap gap-2 align-items-center mt-3">
          @if (o.isColour) {
            <label class="swatch" [style.background]="draft(oi).colorCode"><input type="color" [(ngModel)]="draft(oi).colorCode" /></label>
          }
          <input class="form-control form-control-sm" style="max-width: 200px" [(ngModel)]="draft(oi).value" [placeholder]="o.isColour ? 'New colour, e.g. Teak' : 'New value'" (keyup.enter)="addValue(o, oi)" />
          @if (hasVariants() && o.id && savedValues(o).length) {
            <select class="form-select form-select-sm w-auto" [(ngModel)]="draft(oi).copyFrom" title="Prices and stock are copied from this value">
              @for (sv of savedValues(o); track sv.id) { <option [ngValue]="sv.id">Price like {{ sv.value }}</option> }
            </select>
          }
          <button class="btn btn-sm btn-phoenix-primary" [disabled]="!draft(oi).value.trim()" (click)="addValue(o, oi)"><i class="bi bi-plus me-1"></i>Add</button>
        </div>
      </div>
    } @empty {
      <p class="text-muted fs-7">This product has no options yet.</p>
    }

    @if (addingOption()) {
      <div class="opt-card">
        <div class="row g-2 align-items-end">
          <div class="col-md-4"><label class="form-label">New option</label><input class="form-control form-control-sm" [(ngModel)]="newOption.name" placeholder="Colour" /></div>
          <div class="col-md-6"><label class="form-label">Values <span class="text-muted">(comma separated)</span></label><input class="form-control form-control-sm" [(ngModel)]="newOption.values" placeholder="Teak, Walnut, White" /></div>
          <div class="col-md-2 d-flex gap-1"><button class="btn btn-sm btn-primary" [disabled]="!newOption.name.trim() || !newOption.values.trim()" (click)="addOption()">Add</button>
            <button class="btn btn-sm btn-phoenix-secondary" (click)="addingOption.set(false)">Cancel</button></div>
        </div>
        <div class="form-text">
          @if (hasVariants()) { Every current variant gets the first value; each further value becomes a copy of them with the same prices. }
          @else { Each value becomes a choice at the product's price, so customers' picks are recorded on their order. }
        </div>
      </div>
    } @else {
      <button class="btn btn-sm btn-phoenix-secondary" (click)="addingOption.set(true)"><i class="bi bi-plus me-1"></i>Add option</button>
    }

    <div class="d-flex gap-2 justify-content-end mt-3 border-top pt-3">
      @if (dirty()) { <span class="text-warning fs-7 me-auto align-self-center"><i class="bi bi-exclamation-circle me-1"></i>Unsaved changes</span> }
      <button class="btn btn-phoenix-secondary" [disabled]="!dirty() || saving()" (click)="reset()">Discard</button>
      <button class="btn btn-primary" [disabled]="!dirty() || saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save options' }}</button>
    </div>
  `
})
export class ProductOptionsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly product = input.required<ProductDetail>();
  readonly saved = output<ProductDetail>();

  protected options = signal<EditOption[]>([]);
  protected dirty = signal(false);
  protected saving = signal(false);
  protected addingOption = signal(false);
  protected newOption = { name: 'Colour', values: '' };
  private drafts: { value: string; colorCode: string; copyFrom: number | null }[] = [];
  protected hasVariants = computed(() => this.product().variants.length > 0);

  constructor() {
    effect(() => this.load(this.product().options ?? []));
  }

  private load(src: AdminOption[]) {
    this.options.set(src.map(o => ({
      id: o.id, name: o.name, vendorName: o.vendorName ?? undefined, isColour: o.isColour, fromVendor: o.fromVendor,
      values: o.values.map(v => ({
        id: v.id, value: v.value, colorCode: v.colorCode ?? null, vendorValue: v.vendorValue ?? undefined, vendorColorCode: v.vendorColorCode ?? undefined,
        fromVendor: v.fromVendor, isHidden: v.isHidden, variants: v.variants
      }))
    })));
    this.drafts = [];
    this.dirty.set(false);
  }

  touch() { this.dirty.set(true); }
  reset() { this.load(this.product().options ?? []); }

  draft(i: number) {
    while (this.drafts.length <= i) this.drafts.push({ value: '', colorCode: '#8b5a2b', copyFrom: null });
    return this.drafts[i];
  }

  savedValues(o: EditOption) { return o.values.filter(v => v.id && !v.isHidden); }

  defaultName(o: EditOption) {
    const colourOptions = this.options().filter(x => /colou?r|shade/i.test(x.vendorName ?? x.name)).length;
    return o.vendorName && /colou?r|shade/i.test(o.vendorName) && colourOptions === 1 ? 'Colour' : (o.vendorName ?? o.name);
  }

  differsFromVendor(v: EditValue) {
    return v.fromVendor && (v.value !== v.vendorValue || (v.colorCode ?? null) !== (v.vendorColorCode ?? null));
  }

  resetToVendor(v: EditValue) { v.value = v.vendorValue ?? v.value; v.colorCode = v.vendorColorCode ?? null; this.touch(); }

  setHex(v: EditValue, hex: string) {
    const h = hex.trim();
    v.colorCode = !h ? null : (h.startsWith('#') ? h : '#' + h);
    this.touch();
  }

  moveOption(i: number, dir: -1 | 1) {
    const list = [...this.options()];
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    this.options.set(list);
    this.touch();
  }

  moveValue(o: EditOption, i: number, dir: -1 | 1) {
    [o.values[i], o.values[i + dir]] = [o.values[i + dir], o.values[i]];
    this.touch();
  }

  removeValue(o: EditOption, i: number) {
    const v = o.values[i];
    if (o.values.filter(x => !x.isHidden).length === 1) { this.toast.error('An option needs at least one value — remove the option instead.'); return; }
    if (v.fromVendor) v.isHidden = true; // hidden, so the next sync doesn't bring it back
    else o.values.splice(i, 1);
    this.touch();
  }

  removeOption(i: number) {
    const list = [...this.options()];
    list.splice(i, 1);
    this.options.set(list);
    this.drafts.splice(i, 1);
    this.touch();
  }

  addValue(o: EditOption, i: number) {
    const d = this.draft(i);
    const name = d.value.trim();
    if (!name) return;
    if (o.values.some(v => !v.isHidden && v.value.trim().toLowerCase() === name.toLowerCase())) { this.toast.error(`"${name}" is already there.`); return; }
    const copyFrom = d.copyFrom ?? this.savedValues(o)[0]?.id ?? null;
    o.values.push({ value: name, colorCode: o.isColour ? d.colorCode : null, fromVendor: false, isHidden: false, variants: 0, copyFromValueId: copyFrom });
    d.value = '';
    this.touch();
  }

  addOption() {
    const values = this.newOption.values.split(',').map(v => v.trim()).filter(Boolean);
    const isColour = /colou?r|shade/i.test(this.newOption.name);
    this.options.update(list => [...list, {
      name: this.newOption.name.trim(), isColour, fromVendor: false,
      values: values.map(v => ({ value: v, colorCode: isColour ? '#cccccc' : null, fromVendor: false, isHidden: false, variants: 0 }))
    }]);
    this.newOption = { name: 'Colour', values: '' };
    this.addingOption.set(false);
    this.touch();
  }

  save() {
    for (const o of this.options()) {
      for (const v of o.values) {
        if (o.isColour && v.colorCode && !HEX.test(v.colorCode)) { this.toast.error(`"${v.colorCode}" isn't a colour code like #8b5a2b.`); return; }
      }
    }
    const body = this.options().map(o => ({
      id: o.id ?? null, name: o.name, isColour: o.isColour,
      values: o.values.map(v => ({ id: v.id ?? null, value: v.value, colorCode: o.isColour ? v.colorCode : (v.fromVendor ? v.colorCode : null), isHidden: v.isHidden, copyFromValueId: v.copyFromValueId ?? null }))
    }));
    this.saving.set(true);
    this.api.put<ProductDetail>(`admin/products/${this.product().id}/options`, body).subscribe({
      next: p => { this.saving.set(false); this.toast.success('Options saved'); this.saved.emit(p); },
      error: () => this.saving.set(false)
    });
  }
}
