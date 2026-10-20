import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AdminImage, AdminVariant, Lookups, ProductDetail } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { environment } from '../../../environments/environment';
import { ProductOptionsComponent } from './product-options';

const blank = (): ProductDetail => ({
  vendorCost: 0, vendorPricesIncludeGst: false,
  id: 0, name: '', slug: '', description: '', descriptionHtml: '', categoryId: 0, vendorId: undefined, brand: 'WoodsyCart', sku: '', hsnCode: '9403', gstRate: 18,
  material: '', dimensions: '', warranty: '', deliveryDays: 7, assemblyIncluded: true, vendorMrp: 0, vendorPrice: 0, vendorPriceChanged: false,
  mrp: 0, sellingPrice: 0, commissionPercentOverride: null, effectiveCommission: 0, manualPrice: false, isActive: true, isAvailable: true,
  isFeatured: false, lockContent: false, source: 'Manual', collectionIds: [], tagIds: [], images: [], variants: [], soldCount: 0, ratingAverage: 0, ratingCount: 0
});

@Component({
  selector: 'wc-product-edit',
  imports: [FormsModule, RouterLink, DatePipe, ProductOptionsComponent, ...SHARED_PIPES],
  templateUrl: './product-edit.html'
})
export class ProductEditPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  readonly id = input<string>();

  protected p = signal<ProductDetail | null>(null);
  protected lookups = signal<Lookups | null>(null);
  protected preview = signal<{ commission: number; gstRate: number; includesGst: boolean; cost: number; gstAmount: number; mrp: number; selling: number; margin: number } | null>(null);
  protected saving = signal(false);
  protected tab = signal<'pricing' | 'options' | 'details' | 'seo'>('pricing');
  protected storefront = environment.storefrontUrl;

  constructor() {
    this.api.get<Lookups>('admin/products/lookups').subscribe(l => {
      this.lookups.set(l);
      const p = this.p();
      if (p && !p.categoryId && l.categories.length) p.categoryId = l.categories[0].id;
    });
    effect(() => {
      const id = this.id();
      if (id && id !== 'new') this.api.get<ProductDetail>(`admin/products/${id}`).subscribe(p => { this.p.set(p); this.calc(); });
      else {
        const b = blank();
        const l = untracked(() => this.lookups());
        b.categoryId = l?.categories[0]?.id ?? 0;
        b.vendorId = l?.vendors[0]?.id;
        this.p.set(b);
      }
    });
  }

  /** The options editor saved: take the fresh variants/options but keep any unsaved edits to the main form. */
  optionsSaved(fresh: ProductDetail) {
    this.p.update(p => (p ? { ...p, variants: fresh.variants, options: fresh.options, sellingPrice: fresh.sellingPrice, mrp: fresh.mrp } : fresh));
  }

  calc() {
    const p = this.p();
    if (!p) return;
    this.api.post<{ commission: number; gstRate: number; includesGst: boolean; cost: number; gstAmount: number; mrp: number; selling: number; margin: number }>('admin/products/price-preview', {
      vendorMrp: p.vendorMrp, vendorPrice: p.vendorPrice, commission: p.commissionPercentOverride ?? null, categoryId: p.categoryId, gstRate: p.gstRate
    }).subscribe(r => this.preview.set(r));
  }

  toggleId(list: number[], id: number) {
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
  }

  addVariant() {
    const p = this.p()!;
    p.variants.push({ name: '', vendorMrp: p.vendorMrp, vendorPrice: p.vendorPrice, mrp: p.mrp, sellingPrice: p.sellingPrice, isAvailable: true, isActive: true });
  }

  removeVariant(v: AdminVariant) {
    const p = this.p()!;
    if (v.id) v.isActive = false;
    else p.variants.splice(p.variants.indexOf(v), 1);
  }

  save() {
    const p = this.p()!;
    if (!p.name || !p.categoryId) { this.toast.error('Name and category are required.'); return; }
    this.saving.set(true);
    const body = { ...p, commissionPercentOverride: p.commissionPercentOverride === null || (p.commissionPercentOverride as unknown) === '' ? null : p.commissionPercentOverride };
    const req = p.id ? this.api.put<ProductDetail>(`admin/products/${p.id}`, body) : this.api.post<ProductDetail>('admin/products', body);
    req.subscribe({
      next: saved => {
        this.saving.set(false);
        this.toast.success('Product saved');
        if (!p.id) this.router.navigate(['/products', saved.id]);
        else { this.p.set(saved); this.calc(); }
      },
      error: () => this.saving.set(false)
    });
  }

  upload(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    const p = this.p()!;
    if (!files.length || !p.id) return;
    this.api.upload<AdminImage[]>(`admin/products/${p.id}/images`, files, 'files').subscribe(imgs => {
      this.p.set({ ...p, images: imgs });
      this.toast.success('Images uploaded');
    });
  }

  removeImage(img: AdminImage) {
    if (!confirm('Remove this image? Content will be locked so vendor sync does not re-add it.')) return;
    const p = this.p()!;
    this.api.delete(`admin/products/images/${img.id}`).subscribe(() => this.p.set({ ...p, lockContent: true, images: p.images.filter(i => i.id !== img.id) }));
  }

  moveImage(img: AdminImage, dir: -1 | 1) {
    const p = this.p()!;
    const list = [...p.images];
    const i = list.indexOf(img);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.p.set({ ...p, images: list });
    this.api.put(`admin/products/${p.id}/images/order`, list.map(x => x.id)).subscribe();
  }

  remove() {
    const p = this.p()!;
    if (!confirm(`Delete "${p.name}"?`)) return;
    this.api.delete(`admin/products/${p.id}`).subscribe(() => { this.toast.success('Product deleted'); this.router.navigate(['/products']); });
  }
}
