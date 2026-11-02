import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';

interface StockAlert { id: number; createdAt: string; productId: number; product: string; variant?: string; availableNow: boolean;
  name: string; email: string; phone?: string; userId?: number; hasDevice: boolean; notifiedAt?: string; }
interface Enquiry { id: number; name: string; email?: string; phone: string; subject?: string; message: string; status: string; adminNotes?: string; createdAt: string; product?: string; }

@Component({
  selector: 'wc-enquiries',
  imports: [FormsModule, DatePipe, RouterLink, ...SHARED_PIPES],
  template: `
    <h2 class="page-title">Enquiries</h2>
    <p class="page-subtitle">Messages from the contact form and "Ask about this product" — custom sizes and bulk orders often come in here.</p>
    <ul class="nav nav-underline mb-3 gap-4">
      <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="view() === 'messages'" (click)="view.set('messages')">Messages</a></li>
      <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="view() === 'alerts'" (click)="view.set('alerts'); loadAlerts()">Notify me (back in stock)</a></li>
    </ul>
    @if (view() === 'alerts') {
      <p class="text-muted fs-7">Customers who tapped <b>Notify me</b> on a sold-out product. When it's available again they get one email, and an app
        notification on their phone if they have the app with notifications on (checked every 10 minutes, 9 am–9 pm).</p>
      <div class="filter-pills mb-3">
        <a [class.active]="!notified" (click)="notified = false; loadAlerts()">Waiting</a><a [class.active]="notified" (click)="notified = true; loadAlerts()">Notified</a>
      </div>
      <div class="card"><div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead><tr><th>Asked</th><th>Product</th><th>Customer</th><th>{{ notified ? 'Notified' : 'Now' }}</th><th></th></tr></thead>
          <tbody>
            @for (a of alerts(); track a.id) {
              <tr>
                <td class="text-nowrap text-muted fs-7">{{ a.createdAt | date: 'dd MMM, h:mm a' }}</td>
                <td class="fs-7"><a [routerLink]="['/products', a.productId]">{{ a.product }}</a>@if (a.variant) { <div class="text-muted fs-8">{{ a.variant }}</div> }</td>
                <td class="fs-7"><b>{{ a.name }}</b>@if (a.userId) { <span class="badge-soft badge-soft-info ms-1">Account</span> }
                  <div class="fs-8"><a [href]="'mailto:' + a.email">{{ a.email }}</a>@if (a.phone) { · <a [href]="'tel:' + a.phone">{{ a.phone }}</a> }
                    @if (a.hasDevice) { · <i class="bi bi-phone" title="Has the app with notifications on"></i> }</div></td>
                <td class="fs-7 text-nowrap">
                  @if (a.notifiedAt) { {{ a.notifiedAt | date: 'dd MMM, h:mm a' }} }
                  @else if (a.availableNow) { <span class="text-success">In stock: sending soon</span> } @else { <span class="text-muted">Sold out</span> }
                </td>
                <td class="text-end text-nowrap">
                  @if (a.phone) { <a class="btn btn-sm btn-success" [href]="'https://wa.me/91' + a.phone.slice(-10)" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i></a> }
                  <button class="btn btn-sm text-danger" title="Delete" (click)="removeAlert(a)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="5"><div class="empty-state"><i class="bi bi-bell"></i>{{ notified ? 'Nobody notified yet.' : 'No one is waiting.' }}</div></td></tr> }
          </tbody>
        </table>
      </div></div>
    } @else {
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
    }
  `
})
export class EnquiriesPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<Enquiry[]>([]);
  protected view = signal<'messages' | 'alerts'>('messages');
  protected alerts = signal<StockAlert[]>([]);
  status = '';
  notified = false;
  constructor() { this.load(); }
  load() { this.api.get<Enquiry[]>('admin/enquiries', { status: this.status }).subscribe(r => this.rows.set(r)); }
  loadAlerts() { this.api.get<StockAlert[]>('admin/stockalerts', { notified: this.notified }).subscribe(r => this.alerts.set(r)); }
  removeAlert(a: StockAlert) {
    if (!confirm(`Delete ${a.name}'s request for ${a.product}? They won't be notified.`)) return;
    this.api.delete(`admin/stockalerts/${a.id}`).subscribe(() => { this.alerts.update(l => l.filter(x => x.id !== a.id)); this.toast.success('Deleted'); });
  }
  save(e: Enquiry) { this.api.put(`admin/enquiries/${e.id}`, { status: e.status, adminNotes: e.adminNotes }).subscribe(() => this.toast.success('Saved')); }
}
