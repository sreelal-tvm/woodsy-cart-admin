import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Banner } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { ModalComponent } from '../shared/ui';

@Component({
  selector: 'wc-banners',
  imports: [FormsModule, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
      <h2 class="page-title mb-0">Home banners</h2>
      <button class="btn btn-sm btn-primary" (click)="edit(null)"><i class="bi bi-plus-lg me-1"></i>Add banner</button>
    </div>
    <p class="page-subtitle">The hero slider on the store's home page. Use wide images (about 1600 × 600). When there are none, a default hero is shown.</p>
    <div class="row g-3">
      @for (b of rows(); track b.id) {
        <div class="col-md-6 col-xl-4">
          <div class="card h-100" [class.opacity-50]="!b.isActive">
            <img [src]="b.imageUrl | media" class="card-img-top" style="height: 160px; object-fit: cover" alt="" />
            <div class="card-body">
              <h5 class="mb-1">{{ b.title }}</h5>
              <p class="text-muted fs-7 mb-2">{{ b.subtitle }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="fs-8 text-muted">{{ b.linkUrl || 'No link' }} · order {{ b.sortOrder }}</span>
                <span>
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon" (click)="edit(b)"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(b)"><i class="bi bi-trash"></i></button>
                </span>
              </div>
            </div>
          </div>
        </div>
      } @empty { <div class="col-12"><div class="empty-state"><i class="bi bi-images"></i>No banners — the store shows its default hero.</div></div> }
    </div>

    @if (form(); as f) {
      <wc-modal [title]="f.id ? 'Edit banner' : 'Add banner'" (closed)="form.set(null)">
        <div class="row g-2">
          <div class="col-12"><label class="form-label">Image</label><input type="file" class="form-control" accept="image/*" (change)="upload($event)" />
            @if (f.imageUrl) { <img [src]="f.imageUrl | media" class="w-100 rounded mt-2" style="max-height: 160px; object-fit: cover" alt="" /> }</div>
          <div class="col-12"><label class="form-label">Title</label><input class="form-control" [(ngModel)]="f.title" /></div>
          <div class="col-12"><label class="form-label">Subtitle</label><input class="form-control" [(ngModel)]="f.subtitle" /></div>
          <div class="col-6"><label class="form-label">Link</label><input class="form-control" [(ngModel)]="f.linkUrl" placeholder="/shop?category=sofa" /></div>
          <div class="col-6"><label class="form-label">Button text</label><input class="form-control" [(ngModel)]="f.buttonText" placeholder="Shop now" /></div>
          <div class="col-6"><label class="form-label">Sort order</label><input type="number" class="form-control" [(ngModel)]="f.sortOrder" /></div>
          <div class="col-6 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="ba" [(ngModel)]="f.isActive" /><label class="form-check-label" for="ba">Active</label></div></div>
        </div>
        <ng-container footer><button class="btn btn-phoenix-secondary" (click)="form.set(null)">Close</button><button class="btn btn-primary" [disabled]="!f.title || !f.imageUrl" (click)="save()">Save</button></ng-container>
      </wc-modal>
    }
  `
})
export class BannersPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Banner[]>([]);
  protected form = signal<Banner | null>(null);
  constructor() { this.load(); }
  load() { this.api.get<Banner[]>('admin/banners').subscribe(r => this.rows.set(r)); }
  edit(b: Banner | null) { this.form.set(b ? { ...b } : { id: 0, title: '', imageUrl: '', sortOrder: this.rows().length + 1, isActive: true, buttonText: 'Shop now' }); }
  upload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.api.upload<{ url: string }>('admin/uploads', file, 'file', { folder: 'banners' }).subscribe(r => this.form.update(f => f ? { ...f, imageUrl: r.url } : f));
  }
  save() {
    const f = this.form()!;
    const req = f.id ? this.api.put(`admin/banners/${f.id}`, f) : this.api.post('admin/banners', f);
    req.subscribe(() => { this.form.set(null); this.toast.success('Banner saved'); this.load(); });
  }
  remove(b: Banner) { if (confirm('Delete this banner?')) this.api.delete(`admin/banners/${b.id}`).subscribe(() => this.load()); }
}
