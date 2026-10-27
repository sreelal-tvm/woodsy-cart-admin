import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { ModalComponent } from '../../shared/ui';
import { SocialPlatform, SocialProduct, SocialQueueResult, SocialState, socialIcon, socialStatusCls, socialStatusLabel } from './social-models';

/** Product page → "Social media": the product's Instagram, Facebook and Threads post, with its caption. */
@Component({
  selector: 'wc-social-card',
  imports: [FormsModule, RouterLink, DatePipe, ModalComponent, ...SHARED_PIPES],
  template: `
    <div class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="mb-0">Social media</h5>
          <a class="fs-8" routerLink="/social">All posts</a>
        </div>
        @if (s(); as d) {
          @if (!d.connected) {
            <div class="fs-7 text-muted">Connect Instagram and Facebook in <a routerLink="/social" [queryParams]="{ tab: 'settings' }">Social media → Settings</a> to post this product.</div>
          } @else {
            @for (pl of d.platforms; track pl.platform) {
              <div class="d-flex justify-content-between align-items-start gap-2 py-2 border-bottom">
                <div class="min-w-0">
                  <div class="fw-bold fs-7"><i [class]="'bi me-1 ' + icon(pl.platform)"></i>{{ pl.platform }}</div>
                  @if (!pl.enabled) { <div class="fs-8 text-muted">Not connected, or switched off in Settings</div> }
                  @else if (pl.status === 'Queued') { <div class="fs-8 text-muted">Posts {{ pl.scheduledAt | date: 'EEE d MMM, h:mm a' }}</div> }
                  @else if (pl.publishedAt) { <div class="fs-8 text-muted">Posted {{ pl.publishedAt | date: 'd MMM y' }}@if (pl.permalink) { · <a [href]="pl.permalink" target="_blank" rel="noopener">View</a> }</div> }
                  @if (pl.status === 'OutOfDate' && pl.changes.length) { <div class="fs-8 text-warning">Changed: {{ pl.changes.join(', ') }}</div> }
                  @if (pl.status === 'OutOfDate' && pl.platform === 'Threads') { <div class="fs-8 text-muted">Threads posts can't be edited after 15 minutes. Keep it as it is, or replace it when the price changed.</div> }
                  @if (pl.status === 'OutOfDate' && pl.platform === 'Instagram') { <div class="fs-8 text-muted">Instagram doesn't let apps edit a caption. Copy the new one, paste it in the Instagram app (post → ⋯ → Edit), then click "Mark as updated".</div> }
                  @if (pl.lastError && pl.status !== 'Published') { <div class="fs-8 text-danger">{{ pl.lastError }}</div> }
                </div>
                @if (pl.status) { <span [class]="cls(pl.status)">{{ label(pl.status) }}</span> } @else if (pl.enabled) { <span class="badge-soft badge-soft-secondary">Not posted</span> }
              </div>
              @if (pl.enabled) {
                <div class="d-flex flex-wrap gap-1 py-2">
                  @switch (pl.status) {
                    @case ('Queued') {
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="post(pl.platform, true)">Post now</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="act(pl, 'remove')">Remove from queue</button>
                    }
                    @case ('Failed') {
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="act(pl, 'retry')">Try again</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="act(pl, 'remove')">Remove</button>
                    }
                    @case ('OutOfDate') {
                      @if (pl.platform === 'Instagram') {
                        <button class="btn btn-sm btn-primary" (click)="copyCaption(pl)"><i class="bi bi-clipboard me-1"></i>Copy updated caption</button>
                        <button class="btn btn-sm btn-phoenix-secondary" (click)="act(pl, 'mark-updated')" title="After pasting the caption into the Instagram app">Mark as updated</button>
                      }
                      @if (pl.platform === 'Threads') {
                        <button class="btn btn-sm btn-phoenix-secondary" (click)="act(pl, 'mark-updated')" title="Leave the Threads post as it is">Keep as is</button>
                      }
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="replace(pl)">Replace post</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="remove(pl)">Delete post</button>
                    }
                    @case ('Published') {
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="replace(pl)" title="Delete and post again">Replace post</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="remove(pl)">Delete post</button>
                    }
                    @case ('Publishing') { <span class="fs-8 text-muted"><span class="spinner-border spinner-border-sm me-1"></span>Posting…</span> }
                    @default {
                      <button class="btn btn-sm btn-primary" (click)="post(pl.platform, true)" [disabled]="!d.publishable">Post now</button>
                      <button class="btn btn-sm btn-phoenix-secondary" (click)="post(pl.platform, false)" [disabled]="!d.publishable">Add to queue</button>
                    }
                  }
                  @if (pl.postId && pl.status !== 'Publishing') {
                    <button class="btn btn-sm btn-phoenix-secondary" (click)="editCaption(pl)" title="Write this post's caption yourself">{{ pl.customCaption ? 'Edit custom caption' : 'Custom caption' }}</button>
                  }
                </div>
              }
            }
            @if (!d.publishable) { <div class="fs-8 text-muted mt-1">Publish the product and add a photo before posting.</div> }
            <button class="btn btn-link btn-sm px-0 mt-1" (click)="showPreview.set(!showPreview())">{{ showPreview() ? 'Hide' : 'Preview' }} caption ({{ d.photos.length }} photo{{ d.photos.length === 1 ? '' : 's' }})</button>
            @if (showPreview()) {
              <div class="d-flex gap-1 overflow-auto mb-2">
                @for (ph of d.photos; track ph) { <img [src]="ph | media" class="rounded border" style="width: 64px; height: 80px; object-fit: contain; background: #fff" alt="" /> }
              </div>
              <pre class="fs-8 bg-body-tertiary rounded p-2 mb-0" style="white-space: pre-wrap; font-family: inherit">{{ d.caption }}</pre>
              @if (hasThreads(d)) {
                <div class="fs-8 fw-bold mt-2 mb-1"><i class="bi bi-threads me-1"></i>Threads text</div>
                <pre class="fs-8 bg-body-tertiary rounded p-2 mb-0" style="white-space: pre-wrap; font-family: inherit">{{ d.threadsCaption }}</pre>
              }
            }
          }
        }
      </div>
    </div>

    @if (editing(); as e) {
      <wc-modal [title]="e.platform + ' caption'" (closed)="editing.set(null)">
        <textarea class="form-control fs-7" rows="16" [(ngModel)]="captionText" maxlength="2200"></textarea>
        <div class="form-text">{{ captionText.length }} / 2200. Leave empty to use the template again. A custom caption no longer follows price or detail changes.</div>
        <ng-container footer>
          <button class="btn btn-phoenix-secondary" (click)="editing.set(null)">Close</button>
          <button class="btn btn-primary" (click)="saveCaption(e)">Save caption</button>
        </ng-container>
      </wc-modal>
    }
  `
})
export class SocialCardComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly productId = input.required<number>();
  protected s = signal<SocialProduct | null>(null);
  protected showPreview = signal(false);
  protected editing = signal<SocialState | null>(null);
  protected captionText = '';
  protected label = socialStatusLabel;
  protected cls = socialStatusCls;
  protected icon = socialIcon;

  hasThreads(d: SocialProduct) { return d.platforms.some(p => p.platform === 'Threads'); }

  constructor() {
    effect(() => { const id = this.productId(); if (id) this.load(); });
  }

  load() { this.api.get<SocialProduct>(`admin/social/products/${this.productId()}`).subscribe(s => this.s.set(s)); }

  post(platform: SocialPlatform, now: boolean) {
    this.api.post<SocialQueueResult>('admin/social/queue', { productIds: [this.productId()], now, platforms: [platform] }).subscribe(r => {
      if (r.note) this.toast.info(r.note);
      else this.toast.success(r.postingNow ? `Posting to ${platform} within a minute` : `Added to the ${platform} queue`);
      this.load();
    });
  }

  act(pl: SocialState, action: 'remove' | 'retry' | 'mark-updated') {
    this.api.post(`admin/social/posts/${pl.postId}/${action}`).subscribe(() => {
      this.toast.success(action === 'remove' ? 'Removed' : action === 'retry' ? 'Trying again' : 'Marked as up to date');
      this.load();
    });
  }

  replace(pl: SocialState) {
    if (!confirm(`Delete the ${pl.platform} post and post this product again? Likes and comments on the old post are lost.`)) return;
    this.api.post(`admin/social/posts/${pl.postId}/replace`).subscribe(() => { this.toast.success('Old post deleted; posting again within a minute'); this.load(); });
  }

  remove(pl: SocialState) {
    if (!confirm(`Delete this product's ${pl.platform} post? Likes and comments on it are lost. You can post the product again later.`)) return;
    this.api.post(`admin/social/posts/${pl.postId}/delete`).subscribe(() => { this.toast.success(`${pl.platform} post deleted`); this.load(); });
  }

  copyCaption(pl: SocialState) {
    this.api.get<{ caption: string }>(`admin/social/posts/${pl.postId}/caption`).subscribe(r => {
      navigator.clipboard.writeText(r.caption).then(
        () => this.toast.success('Caption copied. In Instagram open the post → ⋯ → Edit, paste it, then click "Mark as updated".'),
        () => { this.captionText = r.caption; this.editing.set(pl); });
    });
  }

  editCaption(pl: SocialState) {
    this.api.get<{ caption: string }>(`admin/social/posts/${pl.postId}/caption`).subscribe(r => { this.captionText = r.caption; this.editing.set(pl); });
  }

  saveCaption(pl: SocialState) {
    const template = this.s()?.caption ?? '';
    const caption = this.captionText.trim() === template.trim() ? null : this.captionText;
    this.api.put(`admin/social/posts/${pl.postId}/caption`, { caption }).subscribe(() => { this.toast.success('Caption saved'); this.editing.set(null); this.load(); });
  }
}
