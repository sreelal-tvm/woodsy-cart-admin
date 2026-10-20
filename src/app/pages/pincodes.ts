import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Pincode } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';

@Component({
  selector: 'wc-pincodes',
  imports: [FormsModule, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Delivery pincodes</h2>
    <p class="page-subtitle">Customers can only check out to these pincodes (switch this off in Settings to allow anywhere). Add areas as your vendor expands.</p>
    <div class="row g-3">
      <div class="col-xl-4">
        <div class="card">
          <div class="card-header"><h5 class="mb-0">Add pincodes in bulk</h5></div>
          <div class="card-body">
            <label class="form-label">Pincodes</label>
            <textarea class="form-control mb-2" rows="4" [(ngModel)]="bulk.pincodes" placeholder="560001, 560002, 560003"></textarea>
            <div class="row g-2 mb-2">
              <div class="col-6"><label class="form-label">Delivery days</label><input type="number" class="form-control" [(ngModel)]="bulk.deliveryDays" /></div>
              <div class="col-6"><label class="form-label">Extra charge ₹</label><input type="number" class="form-control" [(ngModel)]="bulk.extraCharge" /></div>
            </div>
            <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="bc" [(ngModel)]="bulk.codAvailable" /><label class="form-check-label" for="bc">Cash on delivery available</label></div>
            <button class="btn btn-primary w-100" (click)="saveBulk()">Save pincodes</button>
          </div>
        </div>
      </div>
      <div class="col-xl-8">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center gap-2">
            <h5 class="mb-0">{{ rows().length }} pincodes</h5>
            <div class="search-box" style="width: 220px"><i class="bi bi-search"></i><input class="form-control form-control-sm" [ngModel]="filter()" (ngModelChange)="filter.set($event)" placeholder="Filter" /></div>
          </div>
          <div class="table-responsive" style="max-height: 640px">
            <table class="table table-sm align-middle">
              <thead class="sticky-top bg-body"><tr><th>Pincode</th><th>Area</th><th class="text-end">Days</th><th class="text-end">Extra ₹</th><th class="text-center">COD</th><th class="text-center">Active</th><th></th></tr></thead>
              <tbody>
                @for (p of filtered(); track p.id) {
                  <tr>
                    <td class="fw-bold">{{ p.pincode }}</td>
                    <td><input class="form-control form-control-sm" [(ngModel)]="p.area" /></td>
                    <td style="width: 80px"><input type="number" class="form-control form-control-sm text-end" [(ngModel)]="p.deliveryDays" /></td>
                    <td style="width: 90px"><input type="number" class="form-control form-control-sm text-end" [(ngModel)]="p.extraCharge" /></td>
                    <td class="text-center"><input class="form-check-input" type="checkbox" [(ngModel)]="p.codAvailable" /></td>
                    <td class="text-center"><input class="form-check-input" type="checkbox" [(ngModel)]="p.isActive" /></td>
                    <td class="text-end text-nowrap">
                      <button class="btn btn-sm btn-phoenix-secondary btn-icon" (click)="save(p)"><i class="bi bi-check-lg"></i></button>
                      <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(p)"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PincodesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Pincode[]>([]);
  protected filter = signal('');
  protected filtered = computed(() => {
    const f = this.filter().toLowerCase();
    return f ? this.rows().filter(p => p.pincode.includes(f) || (p.area ?? '').toLowerCase().includes(f)) : this.rows();
  });
  bulk = { pincodes: '', deliveryDays: 7, extraCharge: 0, codAvailable: true };

  constructor() { this.load(); }
  load() { this.api.get<Pincode[]>('admin/pincodes').subscribe(r => this.rows.set(r)); }
  saveBulk() { this.api.post<{ saved: number }>('admin/pincodes/bulk', this.bulk).subscribe(r => { this.toast.success(`${r.saved} pincodes saved`); this.bulk.pincodes = ''; this.load(); }); }
  save(p: Pincode) { this.api.put(`admin/pincodes/${p.id}`, p).subscribe(() => this.toast.success(`${p.pincode} saved`)); }
  remove(p: Pincode) { if (confirm(`Remove ${p.pincode}?`)) this.api.delete(`admin/pincodes/${p.id}`).subscribe(() => this.load()); }
}
