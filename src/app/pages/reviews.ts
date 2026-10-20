import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';

interface ReviewRow { id: number; productId: number; product: string; customer: string; rating: number; title?: string; comment?: string; isApproved: boolean; isVerifiedPurchase: boolean; createdAt: string; }

@Component({
  selector: 'wc-reviews',
  imports: [RouterLink, DatePipe],
  template: `
    <h2 class="page-title">Reviews</h2>
    <p class="page-subtitle">Reviews appear on the store after you approve them.</p>
    <div class="filter-pills mb-3">
      <a [class.active]="filter === false" (click)="filter = false; load()">Pending</a>
      <a [class.active]="filter === true" (click)="filter = true; load()">Approved</a>
      <a [class.active]="filter === null" (click)="filter = null; load()">All</a>
    </div>
    <div class="card">
      <div class="table-responsive">
        <table class="table align-middle">
          <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Review</th><th>Date</th><th></th></tr></thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr>
                <td class="text-truncate" style="max-width: 220px"><a [routerLink]="['/products', r.productId]">{{ r.product }}</a></td>
                <td>{{ r.customer }}@if (r.isVerifiedPurchase) { <div class="fs-8 text-success"><i class="bi bi-patch-check-fill"></i> Verified buyer</div> }</td>
                <td class="text-warning text-nowrap">@for (s of [1, 2, 3, 4, 5]; track s) { <i class="bi" [class.bi-star-fill]="s <= r.rating" [class.bi-star]="s > r.rating"></i> }</td>
                <td class="fs-7"><b>{{ r.title }}</b> {{ r.comment }}</td>
                <td class="text-muted text-nowrap">{{ r.createdAt | date: 'dd MMM yyyy' }}</td>
                <td class="text-end text-nowrap">
                  @if (!r.isApproved) { <button class="btn btn-sm btn-success" (click)="approve(r, true)">Approve</button> }
                  @else { <button class="btn btn-sm btn-phoenix-secondary" (click)="approve(r, false)">Hide</button> }
                  <button class="btn btn-sm btn-phoenix-secondary btn-icon ms-1 text-danger" (click)="remove(r)"><i class="bi bi-trash"></i></button>
                </td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty-state"><i class="bi bi-star"></i>No reviews here.</div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ReviewsPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected rows = signal<ReviewRow[]>([]);
  filter: boolean | null = false;
  constructor() { this.load(); }
  load() { this.api.get<ReviewRow[]>('admin/reviews', { approved: this.filter }).subscribe(r => this.rows.set(r)); }
  approve(r: ReviewRow, approved: boolean) { this.api.post(`admin/reviews/${r.id}/approve`, {}, { approved }).subscribe(() => { this.toast.success(approved ? 'Review published' : 'Review hidden'); this.load(); }); }
  remove(r: ReviewRow) { if (confirm('Delete this review?')) this.api.delete(`admin/reviews/${r.id}`).subscribe(() => this.load()); }
}
