import { Component, inject, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Paged } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';
import { SocialComment, SocialReply, socialIcon, socialName } from './social-models';

/** Social media → Comments: comments on our posts, newest activity first, with replies sent from here. */
@Component({
  selector: 'wc-social-comments',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, ...SHARED_PIPES],
  template: `
    @for (i of issues(); track i) { <div class="alert fs-7 py-2" [class.alert-danger]="i.startsWith('Disconnected')" [class.alert-warning]="!i.startsWith('Disconnected')"><i class="bi bi-exclamation-triangle me-1"></i>{{ i }}</div> }
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <select class="form-select form-select-sm w-auto" [(ngModel)]="show" (ngModelChange)="page.set(1); load()">
        <option value="unread">New</option><option value="drafts">Drafted answers</option><option value="all">All comments</option>
      </select>
      <select class="form-select form-select-sm w-auto" [(ngModel)]="account" (ngModelChange)="page.set(1); load()">
        <option value="">All accounts</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="threads">Threads</option>
      </select>
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="own-comments" [(ngModel)]="own" (ngModelChange)="saveOwn(); page.set(1); load()" />
        <label class="form-check-label fs-7" for="own-comments">Show our own comments</label>
      </div>
      <button class="btn btn-sm btn-phoenix-secondary ms-auto" (click)="readAll()"><i class="bi bi-check2-all me-1"></i>Mark all as read</button>
    </div>

    @for (c of rows().items; track c.id) {
      <div class="card mb-2" [class.border-primary]="c.unread"><div class="card-body p-3">
        <div class="d-flex gap-2 align-items-center mb-2">
          <img class="thumb" [src]="c.image | media" alt="" loading="lazy" />
          <div class="min-w-0 flex-grow-1">
            <a class="fw-bold d-block text-truncate" [routerLink]="['/products', c.productId]">{{ c.productName }}</a>
            <span class="fs-8 text-muted"><i [class]="'bi me-1 ' + icon(c.platform)"></i>{{ name(c.platform) }}</span>
            @if (c.permalink) { <a class="fs-8 ms-2" [href]="c.permalink" target="_blank" rel="noopener">View post</a> }
          </div>
          @if (c.unread) { <span class="badge-soft badge-soft-primary">New</span> }
        </div>
        <div class="fs-7"><b>{{ c.author }}</b> @if (c.fromUs) { <span class="badge-soft badge-soft-success ms-1">You</span> } <span class="text-muted fs-8">{{ c.postedAt | date: 'd MMM, h:mm a' }}</span></div>
        <div class="fs-7 mb-1" style="white-space: pre-line">{{ c.text }}</div>
        @for (r of c.replies; track r.id) {
          <div class="ms-4 ps-2 border-start fs-7 mt-1">
            <b>{{ r.author }}</b> @if (r.fromUs) { <span class="badge-soft badge-soft-success ms-1">{{ r.auto ? 'Auto' : 'You' }}</span> }
            <span class="text-muted fs-8 ms-1">{{ r.postedAt | date: 'd MMM, h:mm a' }}</span>
            <div style="white-space: pre-line">{{ r.text }}</div>
          </div>
        }
        @if (c.suggestedReply) {
          <div class="border rounded p-2 mt-2 bg-body-tertiary">
            <div class="fs-8 text-muted mb-1"><i class="bi bi-magic me-1"></i>Suggested reply · {{ c.suggestedTopic }} · {{ c.suggestedSource === 'AI' ? 'Claude' : 'Rules' }}
              @if (!c.suggestedComplete) { <span class="text-warning ms-1">· some details are missing: check before sending</span> }</div>
            <div class="fs-7 mb-2" style="white-space: pre-line">{{ c.suggestedReply }}</div>
            <div class="d-flex flex-wrap gap-1">
              <button class="btn btn-sm btn-primary" [disabled]="sending() === c.id" (click)="send(c, c.suggestedReply!)">Send</button>
              <button class="btn btn-sm btn-phoenix-secondary" (click)="drafts[c.id] = c.suggestedReply!">Edit</button>
              <button class="btn btn-sm btn-phoenix-secondary" (click)="dismiss(c)">Dismiss</button>
            </div>
          </div>
        } @else if (c.replyState === 'NeedsYou') {
          <div class="fs-8 text-warning mt-2"><i class="bi bi-person-exclamation me-1"></i>Needs you: {{ c.suggestedTopic === 'Unhappy?' ? 'this sounds unhappy, so it was not answered automatically.' : 'not answered automatically.' }}</div>
        } @else if (!c.fromUs) {
          <button class="btn btn-link btn-sm px-0 mt-1" (click)="redraft(c)"><i class="bi bi-magic me-1"></i>Draft an answer</button>
        }
        <div class="d-flex gap-2 mt-2">
          <textarea class="form-control form-control-sm" rows="1" [placeholder]="'Reply as ' + name(c.platform) + ' account…'"
            [(ngModel)]="drafts[c.id]"></textarea>
          <button class="btn btn-sm btn-primary text-nowrap" [disabled]="!drafts[c.id]?.trim() || sending() === c.id" (click)="reply(c)">
            {{ sending() === c.id ? 'Sending…' : 'Reply' }}</button>
          @if (!c.fromUs) { <button class="btn btn-sm btn-phoenix-secondary text-nowrap" (click)="mark(c, c.unread)">{{ c.unread ? 'Mark read' : 'Mark unread' }}</button> }
        </div>
      </div></div>
    } @empty {
      <div class="card"><div class="empty-state"><i class="bi bi-chat-heart"></i>{{ show === 'unread' ? 'No new comments.' : show === 'drafts' ? 'No drafted answers waiting.' : 'No comments yet.' }}</div></div>
    }
    <wc-pager [page]="page()" [pageSize]="20" [total]="rows().total" (pageChange)="page.set($event); load()" />
    <div class="fs-8 text-muted mt-2">Comments are checked every 10 minutes for posts of the last 2 days, then hourly, and every 6 hours after 2 weeks (up to 90 days). New comments are emailed to the admins (Email &amp; notifications → "New social media comments").</div>
  `
})
export class SocialCommentsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly changed = output<void>();
  protected rows = signal<Paged<SocialComment>>({ items: [], total: 0, page: 1, pageSize: 20 });
  protected issues = signal<string[]>([]);
  protected page = signal(1);
  protected sending = signal<number | null>(null);
  protected show: 'unread' | 'drafts' | 'all' = 'unread';
  protected account = '';
  /** Comments the WoodsyCart accounts wrote themselves (remembered in this browser). */
  protected own = (() => { try { return localStorage.getItem('wc_social_own_comments') === '1'; } catch { return false; } })();
  protected drafts: Record<number, string> = {};
  protected icon = socialIcon;
  protected name = socialName;

  constructor() {
    this.api.get<string[]>('admin/social/comments/issues').subscribe(i => this.issues.set(i));
    this.load(true);
  }

  /** First open: show all comments when there are no new ones. */
  load(first = false) {
    this.api.get<Paged<SocialComment>>('admin/social/comments', { unread: this.show === 'unread', drafts: this.show === 'drafts', account: this.account || undefined, own: this.own, page: this.page(), pageSize: 20 })
      .subscribe(r => {
        if (first && r.total === 0 && this.show === 'unread') { this.show = 'all'; this.load(); return; }
        this.rows.set(r);
      });
  }

  saveOwn() { try { localStorage.setItem('wc_social_own_comments', this.own ? '1' : '0'); } catch { /* private window */ } }

  reply(c: SocialComment) { this.send(c, this.drafts[c.id] ?? ''); }

  dismiss(c: SocialComment) {
    this.api.post(`admin/social/comments/${c.id}/dismiss`).subscribe(() =>
      this.rows.update(p => ({ ...p, items: p.items.map(x => x.id === c.id ? { ...x, suggestedReply: undefined, replyState: 'Dismissed' as const } : x) })));
  }

  redraft(c: SocialComment) {
    this.api.post(`admin/social/comments/${c.id}/redraft`).subscribe(() => { this.load(); });
  }

  send(c: SocialComment, body: string) {
    const text = body.trim();
    if (!text) return;
    this.sending.set(c.id);
    this.api.post<SocialReply>(`admin/social/comments/${c.id}/reply`, { text }).subscribe({
      next: r => {
        this.sending.set(null);
        delete this.drafts[c.id];
        this.rows.update(p => ({ ...p, items: p.items.map(x => x.id === c.id ? { ...x, unread: false, suggestedReply: undefined, replyState: 'Sent' as const, replies: [...x.replies, r] } : x) }));
        this.toast.success('Reply posted');
        this.changed.emit();
      },
      error: () => this.sending.set(null)
    });
  }

  mark(c: SocialComment, read: boolean) {
    this.api.post(`admin/social/comments/${c.id}/read`, {}, { read }).subscribe(() => {
      this.rows.update(p => ({ ...p, items: p.items.map(x => x.id === c.id ? { ...x, unread: !read } : x) }));
      this.changed.emit();
    });
  }

  readAll() {
    this.api.post<{ count: number }>('admin/social/comments/read-all').subscribe(r => {
      this.toast.success(r.count ? `${r.count} marked as read` : 'Nothing new');
      this.load(); this.changed.emit();
    });
  }
}
