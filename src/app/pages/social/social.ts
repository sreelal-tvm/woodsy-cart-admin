import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Paged } from '../../core/models';
import { SocialBadge } from '../../core/social-badge';
import { ToastService } from '../../core/toast.service';
import { SHARED_PIPES } from '../../shared/pipes';
import { PagerComponent } from '../../shared/ui';
import { SocialCommentsComponent } from './social-comments';
import { SocialGuideComponent } from './social-guide';
import { SocialPerformanceComponent } from './social-performance';
import { FeedStatus, MusicTrack, SOCIAL_PLATFORMS, SocialPostRow, SocialSettings, SocialStatus, SocialSummary, socialIcon, socialName, socialStatusCls, socialStatusLabel, statLine, AutoReplySettings, AutoReplyMode, CommentSuggestion } from './social-models';

type Tab = 'queue' | 'posted' | 'outdated' | 'failed' | 'comments' | 'performance' | 'settings';
interface PageChoice { id: string; name: string; instagram?: string; }

/** Admin → Marketing → Social media: Instagram, Facebook and Threads posting of products. */
@Component({
  selector: 'wc-social',
  imports: [FormsModule, RouterLink, DatePipe, PagerComponent, SocialGuideComponent, SocialCommentsComponent, SocialPerformanceComponent, ...SHARED_PIPES],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
      <h2 class="page-title mb-0">Social media</h2>
      @if (sum(); as s) {
        <span [class]="s.connected ? 'badge-soft badge-soft-success' : 'badge-soft badge-soft-secondary'">
          {{ s.connected ? 'Connected' + (s.instagram ? ' · Instagram @' + s.instagram : '') + (s.page ? ' · Facebook ' + s.page : '') + (s.threads ? ' · Threads @' + s.threads : '') + (s.youtube ? ' · YouTube ' + s.youtube : '') : 'Not connected' }}
        </span>
      }
    </div>
    <p class="page-subtitle">Posts your products to Instagram, your Facebook Page, Threads and YouTube Shorts — one post per product, at a steady pace. Choose products on the <a routerLink="/products">Products</a> page (tick them, then <b>Post to social media</b>) or on each product's page.</p>

    @if (sum(); as s) {
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Instagram, last 24 hours</div>
          <div class="kpi-value" [class.text-danger]="s.quota.used >= s.quota.limit">{{ s.quota.used }} / {{ s.quota.limit }}</div>
          <div class="fs-8 text-muted">{{ s.quota.fromMeta ? 'From Instagram' : 'Counted by WoodsyCart' }}</div>
          @if (s.threadsQuota; as t) { <div class="fs-8 text-muted">Threads: {{ t.used }} / {{ t.limit }}</div> }
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Next post</div>
          <div class="kpi-value fs-5">{{ s.nextPostAt ? (s.nextPostAt | date: 'EEE, h:mm a') : '—' }}</div>
          <div class="fs-8 text-muted">{{ queued(s) }} in queue</div>
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Products posted</div>
          <div class="kpi-value text-success">{{ s.postedProducts }}</div>
          <a class="fs-8" routerLink="/products" [queryParams]="{ social: 'not-posted' }">{{ s.notPosted }} published products not posted yet</a>
        </div></div>
        <div class="col-6 col-lg-3"><div class="card card-body h-100">
          <div class="kpi-label">Need attention</div>
          <div class="kpi-value" [class.text-warning]="count(s, 'OutOfDate') + count(s, 'Failed') > 0">{{ count(s, 'OutOfDate') + count(s, 'Failed') }}</div>
          <div class="fs-8 text-muted">{{ count(s, 'OutOfDate') }} out of date · {{ count(s, 'Failed') }} failed</div>
        </div></div>
      </div>
    }

    <div class="filter-pills mb-3">
      @for (t of tabs; track t.key) {
        <a [class.active]="current() === t.key" (click)="setTab(t.key)">{{ t.label }}
          @if (t.key === 'comments' && sum()?.unreadComments) { <span class="badge rounded-pill bg-danger ms-1">{{ sum()!.unreadComments }}</span> }</a>
      }
    </div>

    @if (current() === 'comments') {
      <wc-social-comments (changed)="loadSummary()" />
    } @else if (current() === 'performance') {
      <wc-social-performance />
    } @else if (current() !== 'settings') {
      <div class="card">
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead><tr><th>Product</th><th>Platform</th><th>Status</th><th>{{ current() === 'queue' ? 'Posts at' : 'Posted' }}</th><th></th></tr></thead>
            <tbody>
              @for (r of rows().items; track r.id) {
                <tr>
                  <td>
                    <div class="d-flex gap-2 align-items-center">
                      <img class="thumb" [src]="r.image | media" alt="" loading="lazy" />
                      <div class="min-w-0">
                        <a class="fw-bold d-block text-truncate" style="max-width: 320px" [routerLink]="['/products', r.productId]">{{ r.productName }}</a>
                        @if (r.changes.length) { <span class="fs-8 text-warning">Changed: {{ r.changes.join(', ') }}</span> }
                        @if (r.lastError && r.status !== 'Published') { <span class="fs-8 d-block" [class]="r.status === 'Queued' ? 'text-muted' : 'text-danger'">{{ r.lastError }}</span> }
                        @if (r.customCaption) { <span class="fs-8 text-muted d-block">Custom caption</span> }
                      </div>
                    </div>
                  </td>
                  <td class="text-nowrap"><i [class]="'bi me-1 ' + icon(r.platform)"></i>{{ name(r.platform) }}</td>
                  <td><span [class]="cls(r.status)">{{ label(r.status) }}</span></td>
                  <td class="fs-7 text-nowrap">{{ (current() === 'queue' ? r.scheduledAt : r.publishedAt) | date: 'EEE d MMM, h:mm a' }}
                    @if (r.stats) { <div class="fs-8 text-muted">{{ stats(r.stats) }}</div> }</td>
                  <td class="text-end text-nowrap">
                    @if (r.permalink) { <a class="btn btn-sm btn-phoenix-secondary" [href]="r.permalink" target="_blank" rel="noopener">View</a> }
                    @if (r.status === 'Queued') { <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'remove')">Remove</button> }
                    @if (r.status === 'Failed') {
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'retry')">Try again</button>
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'remove')">Remove</button>
                    }
                    @if (r.status === 'OutOfDate') {
                      @if (r.platform === 'Instagram' || r.platform === 'InstagramReel') {
                        <button class="btn btn-sm btn-primary ms-1" (click)="copy(r)"><i class="bi bi-clipboard me-1"></i>Copy caption</button>
                        <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'mark-updated')">Mark as updated</button>
                      }
                      @if (r.platform === 'Threads' || r.platform === 'ThreadsVideo' || r.platform === 'YouTubeShort') {
                        <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="act(r, 'mark-updated')" title="Leave the post as it is">Keep as is</button>
                      }
                      <button class="btn btn-sm btn-phoenix-secondary ms-1" (click)="replace(r)">Replace post</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state"><i class="bi bi-instagram"></i>{{ emptyText() }}</div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <wc-pager [page]="page()" [pageSize]="25" [total]="rows().total" (pageChange)="page.set($event); load()" />
      @if (current() === 'outdated') {
        <div class="fs-8 text-muted mt-2">Instagram doesn't let apps change a caption after posting. <b>Copy caption</b>, then in the Instagram app open the post → ⋯ → <b>Edit</b>, paste and save, and click <b>Mark as updated</b> here. Likes and comments stay. Facebook posts are updated automatically. Threads posts can't be edited after 15 minutes: <b>Keep as is</b>, or <b>Replace post</b> when the price changed. YouTube Shorts get the new title and description automatically; the video itself still shows the old name, price or details, so <b>Replace post</b> (views start again) or <b>Keep as is</b>.</div>
      }
    } @else if (cfg(); as c) {
      <div class="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2 fs-7">
        <span><i class="bi bi-info-circle me-1"></i>Setting up for the first time, or a connection stopped working? The guide walks you through every click.</span>
        <button class="btn btn-sm btn-primary" (click)="guide.set(true)"><i class="bi bi-book me-1"></i>Setup guide</button>
      </div>
      @if (guide()) { <wc-social-guide [s]="c" (closed)="guide.set(false)" /> }
      <div class="row g-3">
        <div class="col-xl-6">
          <div class="card mb-3"><div class="card-body">
            <h5>Connection</h5>
            @if (c.connected) {
              <div class="fs-7 mb-2">
                <div><i class="bi bi-instagram me-1"></i>Instagram: <b>{{ c.instagramUsername ? '@' + c.instagramUsername : 'not linked to the Page' }}</b></div>
                <div><i class="bi bi-facebook me-1"></i>Facebook Page: <b>{{ c.pageName }}</b></div>
                <div class="text-muted fs-8">Connected {{ c.connectedAt | date: 'd MMM y, h:mm a' }} · Meta app {{ c.metaAppId }}</div>
              </div>
              <div class="d-flex gap-2 mb-3">
                <button class="btn btn-sm btn-phoenix-secondary" (click)="showConnect.set(!showConnect())">Change account</button>
                <button class="btn btn-sm btn-outline-danger" (click)="disconnect()">Disconnect</button>
              </div>
            } @else {
              <p class="fs-7 text-muted">Connect through your Meta app (one-time). Instagram must be a professional account (Business or Creator) linked to your Facebook Page.</p>
            }
            @if (!c.connected || showConnect()) {
              <ol class="fs-8 text-muted ps-3">
                <li>developers.facebook.com → <b>My Apps</b> → your app → <b>App settings → Basic</b>: copy the <b>App ID</b> and <b>App secret</b>.</li>
                <li><b>Tools → Graph API Explorer</b>: pick your app, <b>Get User Access Token</b> with: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>instagram_basic</code>, <code>instagram_content_publish</code>, <code>instagram_manage_contents</code>, <code>business_management</code>. Allow your Page and Instagram account, then copy the token.</li>
                <li>Paste all three below. Only an encrypted Page token is kept; the secret and this token are not stored.</li>
              </ol>
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">App ID</label><input class="form-control" [(ngModel)]="conn.appId" autocomplete="off" /></div>
                <div class="col-md-6"><label class="form-label">App secret</label><input type="password" class="form-control" [(ngModel)]="conn.appSecret" autocomplete="new-password" /></div>
                <div class="col-12"><label class="form-label">User access token</label><input type="password" class="form-control" [(ngModel)]="conn.userToken" autocomplete="off" /></div>
                @if (pages().length) {
                  <div class="col-12"><label class="form-label">Facebook Page</label>
                    <select class="form-select" [(ngModel)]="conn.pageId">
                      @for (p of pages(); track p.id) { <option [ngValue]="p.id">{{ p.name }}{{ p.instagram ? ' (Instagram @' + p.instagram + ')' : ' (no Instagram linked)' }}</option> }
                    </select></div>
                }
                <div class="col-12"><button class="btn btn-primary btn-sm" (click)="connect()" [disabled]="connecting()">{{ connecting() ? 'Connecting…' : 'Connect' }}</button></div>
              </div>
            }
            @if (!c.publicPhotos) { <div class="alert alert-warning fs-8 mt-3 mb-0">Photos must be reachable on the internet. Posting works on the live and QA servers (Smtp:ApiUrl set to an https address), not on localhost.</div> }
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-threads me-1"></i>Threads</h5>
            @if (c.threadsConnected) {
              <div class="fs-7 mb-2">
                <div>Threads: <b>@{{ c.threadsUsername }}</b></div>
                <div class="text-muted fs-8">Connected {{ c.threadsConnectedAt | date: 'd MMM y, h:mm a' }} · access renews itself weekly (valid until {{ c.threadsTokenExpiresAt | date: 'd MMM y' }})</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-phoenix-secondary" (click)="showThreads.set(!showThreads())">Connect again</button>
                <button class="btn btn-sm btn-outline-danger" (click)="disconnectThreads()">Disconnect</button>
              </div>
            } @else {
              <p class="fs-7 text-muted mb-2">Threads has its own login, through the same Meta app.</p>
            }
            @if (!c.threadsConnected || showThreads()) {
              <ol class="fs-8 text-muted ps-3 mt-2">
                <li>Meta app → <b>Use cases → Access the Threads API → Customize</b>: permissions <code>threads_basic</code>, <code>threads_content_publish</code>, <code>threads_delete</code>; under <b>Settings</b> add this redirect callback URL:
                  <code class="d-block my-1 user-select-all">{{ c.threadsCallbackUrl ?? 'needs Smtp:ApiUrl (https)' }}</code></li>
                <li><b>App roles → Roles → Add People → Threads Tester</b>: your Threads profile; accept it in Threads → Settings → Account → Website permissions → Invites.</li>
                <li><b>App settings → Basic</b>: copy the <b>Threads app ID</b> and <b>Threads app secret</b> below, then log in to Threads and allow access.</li>
              </ol>
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">Threads app ID</label><input class="form-control" [(ngModel)]="threadsConn.appId" autocomplete="off" /></div>
                <div class="col-md-6"><label class="form-label">Threads app secret</label><input type="password" class="form-control" [(ngModel)]="threadsConn.appSecret" autocomplete="new-password" /></div>
                <div class="col-12"><button class="btn btn-primary btn-sm" (click)="connectThreads()" [disabled]="!c.threadsCallbackUrl"><i class="bi bi-threads me-1"></i>Log in to Threads</button></div>
              </div>
            }
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-youtube me-1"></i>YouTube Shorts</h5>
            @if (c.youTubeConnected) {
              <div class="fs-7 mb-2">
                <div>Channel: <b>{{ c.youTubeChannel }}</b>{{ c.youTubeHandle ? ' (' + c.youTubeHandle + ')' : '' }}</div>
                <div class="text-muted fs-8">Connected {{ c.youTubeConnectedAt | date: 'd MMM y, h:mm a' }} · access renews itself</div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-phoenix-secondary" (click)="showYouTube.set(!showYouTube())">Connect again</button>
                <button class="btn btn-sm btn-outline-danger" (click)="disconnectYouTube()">Disconnect</button>
              </div>
            } @else {
              <p class="fs-7 text-muted mb-2">Each product's reel is uploaded to your YouTube channel as a Short. Connect once through a Google Cloud app (free).</p>
            }
            @if (!c.youTubeConnected || showYouTube()) {
              <ol class="fs-8 text-muted ps-3 mt-2">
                <li><a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> (signed in as the channel's Google account) → new project <b>WoodsyCart</b> → <b>APIs &amp; Services → Library</b> → <b>YouTube Data API v3</b> → <b>Enable</b>.</li>
                <li><b>OAuth consent screen</b> (Google Auth Platform): app name WoodsyCart, <b>External</b>, your email → Create. Then <b>Audience → Publish app</b> (In production): in Testing, Google ends the access after 7 days.</li>
                <li><b>Clients → Create client → Web application</b>, name WoodsyCart; under <b>Authorised redirect URIs</b> add:
                  <code class="d-block my-1 user-select-all">{{ c.youTubeCallbackUrl ?? 'needs Smtp:ApiUrl' }}</code></li>
                <li>Copy the <b>Client ID</b> and <b>Client secret</b> below and log in with the Google account that owns the channel. Google says the app isn't verified: <b>Advanced → Go to WoodsyCart</b>, then allow.</li>
              </ol>
              <div class="row g-2">
                <div class="col-md-6"><label class="form-label">Client ID</label><input class="form-control" [(ngModel)]="ytConn.clientId" autocomplete="off" placeholder="….apps.googleusercontent.com" /></div>
                <div class="col-md-6"><label class="form-label">Client secret</label><input type="password" class="form-control" [(ngModel)]="ytConn.clientSecret" autocomplete="new-password"
                  [placeholder]="c.youTubeClientId ? 'Saved — leave empty to keep it' : ''" /></div>
                <div class="col-12"><button class="btn btn-primary btn-sm" (click)="connectYouTube()" [disabled]="!c.youTubeCallbackUrl"><i class="bi bi-google me-1"></i>Log in with Google</button></div>
              </div>
            }
            <div class="border-top mt-3 pt-3">
              <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="yt" [(ngModel)]="c.youTubeEnabled" /><label class="form-check-label" for="yt">Post Shorts to YouTube (with bulk and automatic posting too)</label></div>
              <label class="form-label">Shorts times (India time, at most {{ c.youTubeDailyLimit }})</label>
              <input class="form-control" [(ngModel)]="c.youTubeTimes" placeholder="17:00" [disabled]="!c.youTubeEnabled" />
              <div class="form-text">The product's reel (see Reels) with the title "name – price | WoodsyCart", the description and #Shorts. At most {{ c.youTubeDailyLimit }} a day so YouTube doesn't see spam; the rest wait for the next time. Links in Shorts descriptions can't be clicked, so viewers use your channel's link or search the product code.</div>
            </div>
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5>Posting</h5>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="ig" [(ngModel)]="c.instagramEnabled" /><label class="form-check-label" for="ig">Post to Instagram</label></div>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="fb" [(ngModel)]="c.facebookEnabled" /><label class="form-check-label" for="fb">Post to the Facebook Page</label></div>
            <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="th" [(ngModel)]="c.threadsEnabled" /><label class="form-check-label" for="th">Post to Threads</label></div>
            <label class="form-label">Posting times (India time, one product each)</label>
            <input class="form-control" [(ngModel)]="c.postTimes" placeholder="11:00, 15:00, 20:30" />
            <div class="form-text mb-3">2–3 posts a day spread out reach more people than many at once. <b>Post now</b> still posts immediately, up to Instagram's daily limit.</div>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="aq" [(ngModel)]="c.autoQueueNewProducts" /><label class="form-check-label" for="aq">Add new products to the queue automatically once published (vendor sync and new products)</label></div>
          </div></div>
        </div>

        <div class="col-xl-6">
          @if (feed(); as f) {
            <div class="card mb-3"><div class="card-body">
              <h5><i class="bi bi-shop me-1"></i>Product feed (Meta catalog)</h5>
              <p class="fs-8 text-muted">A list of all published products (price, offer price, stock, photos, link) that Meta reads every day into a catalog in <b>Commerce Manager</b>. Needed for an Instagram/Facebook Shop and catalog ads.</p>
              <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="feed" [ngModel]="f.enabled" (ngModelChange)="setFeed($event)" /><label class="form-check-label" for="feed">Publish the product feed</label></div>
              @if (f.enabled) {
                @if (f.url) {
                  <div class="d-flex gap-2 align-items-center mb-2"><code class="user-select-all fs-8">{{ f.url }}</code>
                    <button class="btn btn-sm btn-phoenix-secondary py-0" (click)="copyText(f.url)"><i class="bi bi-clipboard"></i></button></div>
                } @else { <div class="alert alert-warning fs-8 py-1">The feed needs the API's public https address (Smtp:ApiUrl); it works on the live and QA servers.</div> }
                <div class="fs-8 mb-2">
                  <b>{{ f.ready }}</b> of {{ f.products }} products in the feed
                  @if (f.ready < f.products) { <span class="text-muted">· photos for the rest are being prepared (about 40 every 10 minutes)</span> }
                  <br />Last read {{ f.fetchedAt ? (f.fetchedAt | date: 'd MMM, h:mm a') + (isMeta(f.fetchedBy) ? ' by Meta' : '') : 'never' }}
                </div>
                <ol class="fs-8 text-muted ps-3 mb-0">
                  <li><a href="https://business.facebook.com/commerce" target="_blank" rel="noopener">Commerce Manager</a> → <b>Add catalog</b> → <b>E-commerce</b> → <b>Upload product info</b> → owner: WoodsyCart business → Create.</li>
                  <li>Catalog → <b>Data sources</b> → <b>Add items</b> → <b>Data feed</b> → <b>Use a URL</b> → paste the address above → schedule <b>Daily</b> → currency <b>INR</b> → Upload.</li>
                  <li>Then <b>Settings → Business assets</b>: connect the catalog to the WoodsyCart Page and Instagram account, and apply for Instagram Shopping (Commerce Manager shows whether WoodsyCart is eligible).</li>
                </ol>
              }
            </div></div>
          }
          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-camera-reels me-1"></i>Reels</h5>
            @if (!c.reelsAvailable) { <div class="alert alert-warning fs-8">Reels need FFmpeg on the server (C:\\WoodsyCart\\tools\\ffmpeg). See the handbook, section 15.</div> }
            <p class="fs-8 text-muted">A 10–15 second video made from the product's photos, with the name, price and details on screen. Reels reach far more people who don't follow you yet.</p>
            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="reels" [(ngModel)]="c.reelsEnabled" /><label class="form-check-label" for="reels">Add the reel to bulk and automatic posting (Instagram Reel, Facebook Reel, Threads video)</label></div>
            <label class="form-label">Reel times (India time, one reel each)</label>
            <input class="form-control" [(ngModel)]="c.reelTimes" placeholder="18:00" [disabled]="!c.reelsEnabled" />
            <div class="form-text mb-3">Separate from photo posts. One reel a day (evening) is a good pace; Facebook allows 30 reels a day.</div>
            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="rmusic" [(ngModel)]="c.reelMusic" /><label class="form-check-label" for="rmusic">Add music from the tracks below</label></div>
            <label class="form-label">Reel music</label>
            <div class="form-text mt-0 mb-2">Only music you may use: free tracks from <b>YouTube Audio Library</b> (studio.youtube.com → Audio library, "No attribution required") or <b>Pixabay Music</b>. Each product always gets the same track; no tracks = no music. Trending film songs can't be added here — download a reel without music on the product page and add the song in the Instagram app.</div>
            @for (t of c.musicTracks; track t.name) {
              <div class="d-flex justify-content-between align-items-center border rounded px-2 py-1 mb-1 fs-7">
                <span class="text-truncate"><i class="bi bi-music-note-beamed me-1"></i>{{ t.name }} <span class="text-muted fs-8">· {{ (t.size / 1048576).toFixed(1) }} MB</span></span>
                <button class="btn btn-sm btn-link text-danger p-0" (click)="deleteTrack(t)" title="Delete"><i class="bi bi-trash"></i></button>
              </div>
            } @empty { <div class="fs-8 text-muted mb-1">No tracks uploaded — reels are made without music.</div> }
            <label class="btn btn-sm btn-phoenix-secondary mt-1 mb-0"><i class="bi bi-upload me-1"></i>Upload a track (MP3, up to 20 MB)
              <input type="file" accept=".mp3,.m4a,.aac,.wav,audio/*" hidden (change)="uploadTrack($event)" /></label>
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-phone me-1"></i>Stories</h5>
            <p class="fs-8 text-muted">A full-screen picture of a product on your Instagram and Facebook stories, with the price and where to order. Stories disappear after 24 hours. Any product can get a story by hand from its page (Social media card → Instagram Story / Facebook Story).</p>
            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="stories" [(ngModel)]="c.storiesEnabled" /><label class="form-check-label" for="stories">Post stories automatically</label></div>
            <label class="form-label">Story times (India time, one story each)</label>
            <input class="form-control" [(ngModel)]="c.storyTimes" placeholder="19:00" [disabled]="!c.storiesEnabled" />
            <div class="form-text">Each time, a product without a story in the last week is chosen: festival offers first, then products posted in the last 3 days, then the one longest without a story. Switching this off takes the automatic stories out of the queue.</div>
          </div></div>

          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-chat-dots me-1"></i>Comments and numbers</h5>
            <p class="fs-8 text-muted">Reading comments and post numbers (views, likes …) asks Instagram, Facebook and Threads every few minutes. Switched off, none of those calls are made; posting and replying by hand still work. Switch them on one at a time once the accounts are stable.</p>
            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="readComments" [(ngModel)]="c.readComments" /><label class="form-check-label" for="readComments">Read comments (Comments tab, emails and answers to comments)</label></div>
            <div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" id="readStats" [(ngModel)]="c.readStats" /><label class="form-check-label" for="readStats">Read post numbers (Performance tab)</label></div>
          </div></div>

          @if (ar(); as a) {
          <div class="card mb-3"><div class="card-body">
            <h5><i class="bi bi-magic me-1"></i>Answers to comments</h5>
            <p class="fs-8 text-muted">Questions like "price?", "size?", "colours?", "kitne ka hai" are answered from the product's own details (price, offer, size, colours, material, warranty, delivery). Complaints and anything unclear are always left for you.</p>
            <div class="d-flex flex-wrap gap-3 mb-2">
              @for (m of modes; track m.key) {
                <div class="form-check mb-0"><input class="form-check-input" type="radio" name="armode" [id]="'ar-' + m.key" [value]="m.key" [(ngModel)]="a.mode" />
                  <label class="form-check-label" [for]="'ar-' + m.key">{{ m.label }}</label></div>
              }
            </div>
            <div class="form-text mb-3">{{ modeHelp(a.mode) }}</div>
            @if (a.mode === 'Auto') {
              <label class="form-label">Automatic replies per hour (at most)</label>
              <input type="number" class="form-control mb-3" min="1" max="60" [(ngModel)]="a.perHour" style="max-width: 140px" />
            }
            <div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="ar-ai" [(ngModel)]="a.ai" />
              <label class="form-check-label" for="ar-ai">Use Claude for comments the rules don't recognise</label></div>
            <div class="row g-2 mb-2">
              <div class="col-md-7"><label class="form-label">Claude API key</label>
                <input type="password" class="form-control" autocomplete="off" [(ngModel)]="aiKey" [disabled]="!a.ai" [placeholder]="a.hasAiKey ? 'Saved — paste a new key to replace it' : 'sk-ant-…'" /></div>
              <div class="col-md-5"><label class="form-label">Model</label>
                <select class="form-select" [(ngModel)]="a.aiModel" [disabled]="!a.ai">
                  @for (m of a.models; track m.id) { <option [value]="m.id">{{ m.name }}{{ modelNote(m.id) }}</option> }
                </select></div>
            </div>
            <div class="form-text mb-3">From platform.claude.com → API keys. Stored encrypted. Once a key is saved, the list shows every model that key can use. Each unclear comment costs about ₹1 with Opus 5.5, much less with Haiku 5.5.
              @if (a.hasAiKey) { <a href="" class="ms-1" (click)="$event.preventDefault(); clearKey = true; saveAutoReply()">Remove the saved key</a> }</div>
            <button class="btn btn-sm btn-primary mb-3" (click)="saveAutoReply()">Save answers settings</button>

            <div class="border-top pt-2">
              <div class="fw-bold fs-7 mb-1">Try it (nothing is posted)</div>
              <div class="row g-2">
                <div class="col-4"><input class="form-control form-control-sm" [(ngModel)]="tryProduct" placeholder="Product, e.g. WC498" /></div>
                <div class="col-4"><select class="form-select form-select-sm" [(ngModel)]="tryPlatform">
                  <option value="Instagram">Instagram</option><option value="Facebook">Facebook</option><option value="Threads">Threads</option></select></div>
                <div class="col-12"><input class="form-control form-control-sm" [(ngModel)]="tryText" placeholder='A comment, e.g. "price and size?"' (keyup.enter)="tryReply()" /></div>
              </div>
              <button class="btn btn-sm btn-phoenix-secondary mt-2" (click)="tryReply()">Try</button>
              @if (tried(); as t) {
                <div class="border rounded p-2 mt-2 fs-7 bg-body-tertiary">
                  @if (t.reply) { <div class="fs-8 text-muted mb-1">{{ t.topic }} · {{ t.source === 'AI' ? 'Claude' : 'Rules' }}{{ t.complete ? '' : ' · some details missing (stays a draft)' }}</div>
                    <div style="white-space: pre-line">{{ t.reply }}</div> }
                  @else { <div class="text-muted">No answer: {{ t.why }}</div> }
                </div>
              }
            </div>
          </div></div>
          }

          <div class="card mb-3"><div class="card-body">
            <h5>Caption</h5>
            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="pr" [(ngModel)]="c.includePrice" /><label class="form-check-label" for="pr">Include the price</label></div>
            <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="mrp" [(ngModel)]="c.showMrp" [disabled]="!c.includePrice" /><label class="form-check-label" for="mrp">Show MRP and savings</label></div>
            <div class="row g-2 mb-3">
              <div class="col-md-6"><label class="form-label">WhatsApp number</label><input class="form-control" [(ngModel)]="c.whatsApp" placeholder="917892200921" /></div>
              <div class="col-md-6"><label class="form-label">City in captions</label><input class="form-control" [(ngModel)]="c.city" placeholder="Bengaluru" /></div>
              <div class="col-md-8"><label class="form-label">Extra hashtags</label><input class="form-control" [(ngModel)]="c.hashtags" placeholder="#FurnitureBangalore #HomeDecor" /></div>
              <div class="col-md-4"><label class="form-label">Hashtags per post</label><input type="number" class="form-control" [(ngModel)]="c.maxHashtags" min="1" max="30" /></div>
            </div>
            <div class="form-text mb-2">#WoodsyCart, the category and the category + city come first, then your extra hashtags and the product's tags. 3–5 focused hashtags reach better than 30.</div>
            <label class="form-label d-flex justify-content-between"><span>Template</span><a class="fs-8" href="javascript:void(0)" (click)="c.template = c.defaultTemplate">Reset to default</a></label>
            <textarea class="form-control fs-8" rows="18" [(ngModel)]="c.template" style="font-family: var(--bs-font-monospace)"></textarea>
            <div class="form-text">Fields: @for (t of c.tokens; track t) { <code class="me-1">{{ '{' + t + '}' }}</code> } — a line whose field is empty is left out.</div>
          </div></div>
          <div class="card mb-3"><div class="card-body">
            <h5>Threads text</h5>
            <div class="row g-2 mb-2">
              <div class="col-md-6"><label class="form-label">Topic tag</label><input class="form-control" [(ngModel)]="c.threadsTopic" placeholder="Furniture" maxlength="50" /></div>
            </div>
            <div class="form-text mb-2">Threads shows one topic per post (instead of hashtags); a broad one like Furniture or Home Decor reaches people browsing that topic. Leave empty for none.</div>
            <label class="form-label d-flex justify-content-between"><span>Template</span><a class="fs-8" href="javascript:void(0)" (click)="c.threadsTemplate = c.threadsDefaultTemplate">Reset to default</a></label>
            <textarea class="form-control fs-8" rows="10" [(ngModel)]="c.threadsTemplate" style="font-family: var(--bs-font-monospace)"></textarea>
            <div class="form-text">Threads allows 500 characters (an emoji or ₹ counts as 3–4); longer text drops lines from the bottom, keeping the product link. <code>{{ '{url}' }}</code> is the product's page: links work on Threads.</div>
          </div></div>
          <div class="text-end"><button class="btn btn-primary" (click)="save()">Save settings</button></div>
        </div>
      </div>
    }
  `
})
export class SocialPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly tab = input<string>();
  readonly threads = input<string>();
  readonly reason = input<string>();
  readonly youtube = input<string>();

  protected tabs: { key: Tab; label: string }[] = [
    { key: 'queue', label: 'Queue' }, { key: 'posted', label: 'Posted' }, { key: 'outdated', label: 'Out of date' },
    { key: 'failed', label: 'Failed' }, { key: 'comments', label: 'Comments' }, { key: 'performance', label: 'Performance' },
    { key: 'settings', label: 'Settings' }
  ];
  protected current = signal<Tab>('queue');
  protected sum = signal<SocialSummary | null>(null);
  protected rows = signal<Paged<SocialPostRow>>({ items: [], total: 0, page: 1, pageSize: 25 });
  protected page = signal(1);
  protected cfg = signal<SocialSettings | null>(null);
  protected showConnect = signal(false);
  protected connecting = signal(false);
  protected pages = signal<PageChoice[]>([]);
  protected conn: { appId: string; appSecret: string; userToken: string; pageId: string | null } = { appId: '', appSecret: '', userToken: '', pageId: null };
  protected showThreads = signal(false);
  protected guide = signal(false);
  protected feed = signal<FeedStatus | null>(null);
  protected threadsConn = { appId: '', appSecret: '' };
  protected showYouTube = signal(false);
  protected ytConn = { clientId: '', clientSecret: '' };
  protected icon = socialIcon;
  protected name = socialName;
  protected label = socialStatusLabel;
  protected cls = socialStatusCls;
  protected stats = statLine;
  protected ar = signal<AutoReplySettings | null>(null);
  protected aiKey = '';
  protected clearKey = false;
  protected tryProduct = '';
  protected tryPlatform = 'Instagram';
  protected tryText = '';
  protected tried = signal<CommentSuggestion | null>(null);
  protected modes: { key: AutoReplyMode; label: string }[] = [
    { key: 'Off', label: 'Off' }, { key: 'Suggest', label: 'Suggest (I send)' }, { key: 'Auto', label: 'Automatic' }
  ];

  constructor() {
    effect(() => {
      const t = this.tab() as Tab | undefined;
      untracked(() => this.setTab(t && this.tabs.some(x => x.key === t) ? t : 'queue'));
    });
    // Back from the Threads login
    effect(() => {
      const r = this.threads(), why = this.reason();
      untracked(() => {
        if (r === 'connected') this.toast.success('Threads connected');
        else if (r === 'failed') this.toast.error('Threads refused the connection' + (why ? ': ' + why : '.'));
        else if (r === 'expired') this.toast.error('The Threads login took too long or was opened twice. Try again.');
        else if (r === 'cancelled') this.toast.info('Threads login cancelled');
      });
    });
    // Back from the Google (YouTube) login
    effect(() => {
      const r = this.youtube(), why = this.reason();
      untracked(() => {
        if (r === 'connected') this.toast.success('YouTube connected');
        else if (r === 'failed') this.toast.error('YouTube refused the connection' + (why ? ': ' + why : '.'));
        else if (r === 'expired') this.toast.error('The Google login took too long or was opened twice. Try again.');
        else if (r === 'cancelled') this.toast.info('Google login cancelled');
      });
    });
    this.loadSummary();
  }

  setTab(t: Tab) {
    this.current.set(t);
    this.page.set(1);
    if (t === 'settings') this.loadSettings(); else if (t !== 'comments' && t !== 'performance') this.load();
  }

  private badge = inject(SocialBadge);

  loadSummary() { this.api.get<SocialSummary>('admin/social/summary').subscribe(s => { this.sum.set(s); this.badge.unread.set(s.unreadComments); }); }

  loadSettings() {
    this.api.get<SocialSettings>('admin/social/settings').subscribe(c => {
      this.cfg.set(c); this.conn.appId = c.metaAppId ?? ''; this.threadsConn.appId = c.threadsAppId ?? ''; this.ytConn.clientId = c.youTubeClientId ?? '';
      if (!c.connected && !c.threadsConnected && !c.metaAppId) this.guide.set(true);
    });
    this.api.get<FeedStatus>('admin/social/feed').subscribe(f => this.feed.set(f));
    this.api.get<AutoReplySettings>('admin/social/auto-reply').subscribe(a => this.ar.set(a));
  }

  modeHelp(m: AutoReplyMode) {
    return ({
      Off: 'No answers are drafted.',
      Suggest: 'An answer is drafted under each new question on the Comments tab; you check it and click Send.',
      Auto: 'Answers with every detail found are sent automatically (a few at a time, at most the number per hour below, once per person per post). Answers with missing details, payment questions and complaints wait for you.'
    })[m];
  }

  modelNote(id: string) { return ({ 'claude-opus-5-5': ' (recommended)', 'claude-haiku-5-5': ' (cheapest)' } as Record<string, string>)[id] ?? ''; }

  saveAutoReply() {
    const a = this.ar()!;
    this.api.put<AutoReplySettings>('admin/social/auto-reply', { mode: a.mode, ai: a.ai, aiKey: this.aiKey || null, clearAiKey: this.clearKey, aiModel: a.aiModel, perHour: a.perHour })
      .subscribe({
        next: s => { this.ar.set(s); this.aiKey = ''; this.clearKey = false; this.toast.success('Answers settings saved'); },
        error: () => { this.clearKey = false; }
      });
  }

  tryReply() {
    const id = Number(this.tryProduct.replace(/\D/g, ''));
    if (!id || !this.tryText.trim()) { this.toast.info('Enter a product code and a comment.'); return; }
    this.api.post<CommentSuggestion>('admin/social/auto-reply/test', { productId: id, text: this.tryText, platform: this.tryPlatform, author: 'customer' })
      .subscribe(t => this.tried.set(t));
  }

  setFeed(enabled: boolean) {
    this.api.post<FeedStatus>('admin/social/feed', { enabled }).subscribe(f => {
      this.feed.set(f);
      this.toast.success(enabled ? 'Product feed published' : 'Product feed switched off');
    });
  }

  isMeta(agent?: string) { return !!agent && /facebook|meta/i.test(agent); }

  copyText(text: string) { navigator.clipboard.writeText(text).then(() => this.toast.success('Copied')); }

  load() {
    const status: Record<string, SocialStatus> = { queue: 'Queued', posted: 'Published', outdated: 'OutOfDate', failed: 'Failed' };
    this.api.get<Paged<SocialPostRow>>('admin/social/posts', { status: status[this.current()], page: this.page(), pageSize: 25 })
      .subscribe(r => this.rows.set(r));
  }

  count(s: SocialSummary, st: SocialStatus) { return SOCIAL_PLATFORMS.reduce((n, p) => n + (s.counts[p]?.[st] ?? 0), 0); }
  queued(s: SocialSummary) { return this.count(s, 'Queued'); }

  emptyText() {
    return ({ queue: 'Nothing in the queue. Tick products on the Products page and choose "Post to social media".', posted: 'Nothing posted yet.',
      outdated: 'All live posts match their products.', failed: 'No failed posts.', comments: '', performance: '', settings: '' })[this.current()];
  }

  act(r: SocialPostRow, action: 'remove' | 'retry' | 'mark-updated') {
    this.api.post(`admin/social/posts/${r.id}/${action}`).subscribe(() => { this.toast.success('Done'); this.load(); this.loadSummary(); });
  }

  replace(r: SocialPostRow) {
    if (!confirm(`Delete the ${socialName(r.platform)} post of "${r.productName}" and post it again? Likes and comments on the old post are lost.`)) return;
    this.api.post(`admin/social/posts/${r.id}/replace`).subscribe(() => { this.toast.success('Posting again within a minute'); this.load(); this.loadSummary(); });
  }

  copy(r: SocialPostRow) {
    this.api.get<{ caption: string }>(`admin/social/posts/${r.id}/caption`).subscribe(c =>
      navigator.clipboard.writeText(c.caption).then(() => this.toast.success('Caption copied. Paste it into the post in Instagram (⋯ → Edit), then click "Mark as updated".')));
  }

  connect() {
    this.connecting.set(true);
    this.api.post<{ connected: boolean; pages?: PageChoice[]; message?: string }>('admin/social/connect', this.conn).subscribe({
      next: r => {
        this.connecting.set(false);
        if (r.pages?.length) { this.pages.set(r.pages); this.conn.pageId ??= r.pages[0].id; }
        if (r.connected) {
          this.toast.success(r.message ?? 'Connected');
          this.conn.appSecret = ''; this.conn.userToken = ''; this.pages.set([]); this.showConnect.set(false);
          this.loadSettings(); this.loadSummary();
        } else if (r.message) this.toast.info(r.message);
      },
      error: () => this.connecting.set(false)
    });
  }

  disconnect() {
    if (!confirm('Disconnect Instagram and Facebook? Queued posts wait until you connect again.')) return;
    this.api.post('admin/social/disconnect').subscribe(() => { this.toast.success('Disconnected'); this.loadSettings(); this.loadSummary(); });
  }

  uploadTrack(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.api.upload<MusicTrack[]>('admin/social/music', file).subscribe(t => { this.cfg.update(c => c && { ...c, musicTracks: t }); this.toast.success('Track added'); });
  }

  deleteTrack(t: MusicTrack) {
    if (!confirm(`Delete the track "${t.name}"? Reels already posted keep their music.`)) return;
    this.api.delete<MusicTrack[]>(`admin/social/music/${encodeURIComponent(t.name)}`).subscribe(list => this.cfg.update(c => c && { ...c, musicTracks: list }));
  }

  connectThreads() {
    this.api.post<{ url: string }>('admin/social/threads/connect', this.threadsConn).subscribe(r => window.location.href = r.url);
  }

  connectYouTube() {
    this.api.post<{ url: string }>('admin/social/youtube/connect', this.ytConn).subscribe(r => window.location.href = r.url);
  }

  disconnectYouTube() {
    if (!confirm('Disconnect YouTube? Queued Shorts wait until you connect again.')) return;
    this.api.post('admin/social/youtube/disconnect').subscribe(() => { this.toast.success('YouTube disconnected'); this.loadSettings(); this.loadSummary(); });
  }

  disconnectThreads() {
    if (!confirm('Disconnect Threads? Queued Threads posts wait until you connect again.')) return;
    this.api.post('admin/social/threads/disconnect').subscribe(() => { this.toast.success('Threads disconnected'); this.loadSettings(); this.loadSummary(); });
  }

  save() {
    const c = this.cfg()!;
    this.api.put<SocialSettings>('admin/social/settings', c).subscribe(s => { this.cfg.set(s); this.toast.success('Social media settings saved'); });
  }
}
