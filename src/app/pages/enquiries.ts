import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';

interface Enquiry { id: number; name: string; email?: string; phone: string; subject?: string; message: string; status: string; adminNotes?: string; createdAt: string; product?: string; }

@Component({
  selector: 'wc-enquiries',
  imports: [FormsModule, DatePipe, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Enquiries</h2>
    <p class="page-subtitle">Messages from the contact form and "Ask about this product" — custom sizes and bulk orders often come in here.</p>
    <div class="filter-pills mb-3">
      @for (s of ['', 'New', 'InProgress', 'Closed']; track s) { <a [class.active]="status === s" (click)="status = s; load()">{{ s ? (s | humanize) : 'All' }}</a> }
    </div>
    <div class="row g-3">
      @for (e of rows(); track e.id) {
        <div class="col-xl-6">
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <h5 class="mb-0">{{ e.name }}</h5>
                  <div class="fs-7"><a [href]="'tel:' + e.phone">{{ e.phone }}</a>@if (e.email) { · <a [href]="'mailto:' + e.email">{{ e.email }}</a> }</div>
                </div>
                <span [class]="e.status | statusColor">{{ e.status | humanize }}</span>
              </div>
              @if (e.subject || e.product) { <div class="fw-bold fs-7 mb-1">{{ e.subject }}@if (e.product) { · {{ e.product }} }</div> }
              <p class="fs-7 mb-2" style="white-space: pre-wrap">{{ e.message }}</p>
              <div class="text-muted fs-8 mb-2">{{ e.createdAt | date: 'dd MMM yyyy, h:mm a' }}</div>
              <div class="d-flex gap-2">
                <input class="form-control form-control-sm" [(ngModel)]="e.adminNotes" placeholder="Notes" />
                <select class="form-select form-select-sm w-auto" [(ngModel)]="e.status"><option value="New">New</option><option value="InProgress">In progress</option><option value="Closed">Closed</option></select>
                <button class="btn btn-sm btn-phoenix-secondary" (click)="save(e)">Save</button>
                <a class="btn btn-sm btn-success" [href]="'https://wa.me/91' + e.phone.slice(-10)" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i></a>
              </div>
            </div>
          </div>
        </div>
      } @empty { <div class="col-12"><div class="empty-state"><i class="bi bi-chat-left-text"></i>No enquiries.</div></div> }
    </div>
  `
})
export class EnquiriesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Enquiry[]>([]);
  status = '';
  constructor() { this.load(); }
  load() { this.api.get<Enquiry[]>('admin/enquiries', { status: this.status }).subscribe(r => this.rows.set(r)); }
  save(e: Enquiry) { this.api.put(`admin/enquiries/${e.id}`, { status: e.status, adminNotes: e.adminNotes }).subscribe(() => this.toast.success('Saved')); }
}
