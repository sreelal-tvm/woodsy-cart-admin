import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { CategoryRow } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

interface CollectionRow { id: number; name: string; slug: string; imageUrl?: string; sortOrder: number; isActive: boolean; productCount: number; }

@Component({
  selector: 'wc-categories',
  imports: [FormsModule, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Categories</h2>
      <button class="btn btn-sm btn-primary" (click)="edit(null)"><i class="bi bi-plus-lg me-1"></i>Add category</button>
    </div>
    <p class="page-subtitle">Set a commission per category to override the default. Changing it reprices every product in that category.</p>

    <div class="card mb-4">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Category</th><th class="text-end">Products</th><th class="text-end">Live</th><th class="text-end">Commission</th><th class="text-center">On home</th><th class="text-center">Active</th><th class="text-end">Order</th><th></th></tr></thead>
          <tbody>
            @for (c of rows(); track c.id) {
              <tr [class.opacity-50]="!c.isActive">
                <td><div class="d-flex align-items-center gap-2"><img class="thumb thumb-sm" [src]="c.imageUrl | media" alt="" />
                  <div><span class="fw-bold">{{ c.name }}</span><div class="text-muted fs-8">/{{ c.slug }}</div></div></div></td>
                <td class="text-end">{{ c.productCount }}</td>
                <td class="text-end">{{ c.activeCount }}</td>
                <td class="text-end">{{ c.commissionPercent !== null && c.commissionPercent !== undefined ? c.commissionPercent + '%' : 'Default' }}</td>
                <td class="text-center">@if (c.showOnHome) { <i class="bi bi-check-lg text-success"></i> }</td>
                <td class="text-center">@if (c.isActive) { <i class="bi bi-check-lg text-success"></i> }</td>
                <td class="text-end">{{ c.sortOrder }}</td>
                <td class="text-end"><button class="btn btn-sm btn-phoenix-secondary btn-icon" (click)="edit(c)"><i class="bi bi-pencil"></i></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <h4 class="mb-2">Collections</h4>
    <p class="text-muted fs-7">Imported from the vendor (e.g. city availability, "All India Delivery"). Turn off the ones you don't want customers to filter by.</p>
    <div class="card">
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Collection</th><th class="text-end">Products</th><th class="text-center">Visible</th></tr></thead>
          <tbody>
            @for (c of collections(); track c.id) {
              <tr><td>{{ c.name }}</td><td class="text-end">{{ c.productCount }}</td>
                <td class="text-center"><div class="form-check form-switch d-inline-block"><input class="form-check-input" type="checkbox" [(ngModel)]="c.isActive" (change)="saveCollection(c)" /></div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit category' : 'Add category'" (closed)="form.set(null)">
        <div class="row g-2">
          <div class="col-8"><label class="form-label">Name</label><input class="form-control" [(ngModel)]="f.name" /></div>
          <div class="col-4"><label class="form-label">Sort order</label><input type="number" class="form-control" [(ngModel)]="f.sortOrder" /></div>
          <div class="col-6"><label class="form-label">URL slug</label><input class="form-control" [(ngModel)]="f.slug" /></div>
          <div class="col-6"><label class="form-label">Commission % override</label><input type="number" class="form-control" [(ngModel)]="f.commissionPercent" placeholder="Default" /></div>
          <div class="col-12"><label class="form-label">Description</label><textarea class="form-control" rows="2" [(ngModel)]="f.description"></textarea></div>
          <div class="col-12"><label class="form-label">Image</label>
            <div class="d-flex gap-2 align-items-center"><img class="thumb" [src]="f.imageUrl | media" alt="" /><input type="file" class="form-control" accept="image/*" (change)="upload($event)" /></div></div>
          <div class="col-6"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="ca" [(ngModel)]="f.isActive" /><label class="form-check-label" for="ca">Active</label></div></div>
          <div class="col-6"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="ch" [(ngModel)]="f.showOnHome" /><label class="form-check-label" for="ch">Show on home page</label></div></div>
        </div>
        <ng-container footer>
          @if (f.id && !f.productCount) { <button class="btn btn-outline-danger me-auto" (click)="remove(f)">Delete</button> }
          <button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" (click)="save()">Save</button>
        </ng-container>
      </wc-modal>
    }
  `
})
export class CategoriesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<CategoryRow[]>([]);
  protected collections = signal<CollectionRow[]>([]);
  protected form = signal<CategoryRow | null>(null);

  constructor() { this.load(); }

  load() {
    this.api.get<CategoryRow[]>('admin/categories').subscribe(r => this.rows.set(r));
    this.api.get<CollectionRow[]>('admin/collections').subscribe(r => this.collections.set(r));
  }

  edit(c: CategoryRow | null) {
    this.form.set(c ? { ...c } : { id: 0, name: '', slug: '', sortOrder: this.rows().length + 1, isActive: true, showOnHome: true, commissionPercent: null, productCount: 0, activeCount: 0 });
  }

  upload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'categories' }).subscribe(r => this.form.update(f => f ? { ...f, imageUrl: r.url } : f));
  }

  save() {
    const f = this.form()!;
    const body = { ...f, commissionPercent: (f.commissionPercent as unknown) === '' ? null : f.commissionPercent };
    const req = f.id ? this.api.put(`admin/categories/${f.id}`, body) : this.api.post('admin/categories', body);
    req.subscribe(() => { this.form.set(null); this.toast.success('Category saved'); this.load(); });
  }

  remove(c: CategoryRow) {
    if (!confirm(`Delete category ${c.name}?`)) return;
    this.api.delete(`admin/categories/${c.id}`).subscribe(() => { this.form.set(null); this.load(); });
  }

  saveCollection(c: CollectionRow) {
    this.api.put(`admin/collections/${c.id}`, { name: c.name, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive }).subscribe(() => this.toast.success('Collection updated'));
  }
}
