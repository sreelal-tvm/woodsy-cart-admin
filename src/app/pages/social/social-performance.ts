import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { SocialPerformance, socialIcon, socialName, statNum } from './social-models';

/** Social media → Performance: views, likes, comments and shares of recent posts per platform, and the best posts. */
@Component({
  selector: 'wc-social-performance',
  imports: [FormsModule, RouterLink, DatePipe, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <span class="fs-7">Posts of the last</span>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="days" (ngModelChange)="load()">
        <option [ngValue]="7">7 days</option><option [ngValue]="30">30 days</option><option [ngValue]="90">90 days</option><option [ngValue]="365">year</option>
      </select>
      @if (p()?.lastRead; as t) { <span class="fs-8 text-muted ms-auto">Numbers last read {{ t | date: 'd MMM, h:mm a' }}</span> }
    </div>
    @if (p(); as d) {
      @for (i of d.issues; track i) { <div class="alert fs-7 py-2" [class.alert-danger]="i.startsWith('Disconnected')" [class.alert-warning]="!i.startsWith('Disconnected')"><i class="bi bi-exclamation-triangle me-1"></i>{{ i }}</div> }
      <div class="card mb-3">
        <div class="table-responsive">
          <table class="table align-middle mb-0 fs-7">
            <thead><tr><th>Platform</th><th class="text-end">Posts</th><th class="text-end">Views</th><th class="text-end">Reach</th><th class="text-end">Likes</th>
              <th class="text-end">Comments</th><th class="text-end">Shares</th><th class="text-end">Saves</th></tr></thead>
            <tbody>
              @for (r of d.platforms; track r.platform) {
                <tr>
                  <td class="text-nowrap"><i [class]="'bi me-1 ' + icon(r.platform)"></i>{{ name(r.platform) }}</td>
                  <td class="text-end">{{ r.posts }}</td><td class="text-end">{{ n(r.views) }}</td><td class="text-end">{{ n(r.reach) }}</td>
                  <td class="text-end">{{ n(r.likes) }}</td><td class="text-end">{{ n(r.comments) }}</td><td class="text-end">{{ n(r.shares) }}</td><td class="text-end">{{ n(r.saves) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="8"><div class="empty-state"><i class="bi bi-graph-up"></i>No posts in this period.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <h6>Best posts</h6>
      <div class="card">
        <div class="table-responsive">
          <table class="table align-middle mb-0 fs-7">
            <thead><tr><th>Product</th><th>Platform</th><th class="text-end">Views</th><th class="text-end">Likes</th><th class="text-end">Comments</th><th class="text-end">Shares</th><th></th></tr></thead>
            <tbody>
              @for (t of d.top; track t.id) {
                <tr>
                  <td>
                    <div class="d-flex gap-2 align-items-center">
                      <img class="thumb" [src]="t.image | media" alt="" loading="lazy" />
                      <div class="min-w-0">
                        <a class="fw-bold d-block text-truncate" style="max-width: 280px" [routerLink]="['/products', t.productId]">{{ t.productName }}</a>
                        <span class="fs-8 text-muted">{{ t.publishedAt | date: 'd MMM' }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="text-nowrap"><i [class]="'bi me-1 ' + icon(t.platform)"></i>{{ name(t.platform) }}</td>
                  <td class="text-end">{{ n(t.stats.views) }}</td><td class="text-end">{{ n(t.stats.likes) }}</td>
                  <td class="text-end">{{ n(t.stats.comments) }}</td><td class="text-end">{{ n(t.stats.shares) }}</td>
                  <td class="text-end">@if (t.permalink) { <a class="btn btn-sm btn-phoenix-secondary" [href]="t.permalink" target="_blank" rel="noopener">View</a> }</td>
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state"><i class="bi bi-trophy"></i>Numbers appear within an hour of posting.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="fs-8 text-muted mt-2">"—" = the platform doesn't give that number (Facebook gives no saves; Threads no reach). Numbers are read hourly on a post's first day, every 6 hours for a week, then daily, for 90 days.</div>
    }
  `
})
export class SocialPerformanceComponent {
  private api = inject(ApiService);
  protected p = signal<SocialPerformance | null>(null);
  protected days = 30;
  protected icon = socialIcon;
  protected name = socialName;
  protected n = statNum;

  constructor() { this.load(); }

  load() { this.api.get<SocialPerformance>('admin/social/performance', { days: this.days }).subscribe(p => this.p.set(p)); }
}
