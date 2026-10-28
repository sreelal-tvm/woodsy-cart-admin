import { Component, inject, input, output } from '@angular/core';
import { ToastService } from '../../core/toast.service';
import { ModalComponent } from '../../shared/ui';
import { SocialSettings } from './social-models';

/** Social media → Settings → "Setup guide": every step to connect Instagram, Facebook and Threads, in plain words. */
@Component({
  selector: 'wc-social-guide',
  imports: [ModalComponent],
  template: `
    <wc-modal title="Social media setup guide" size="lg" (closed)="closed.emit()">
      <p class="fs-7">
        This connects WoodsyCart to your <b>Instagram</b>, <b>Facebook Page</b> and <b>Threads</b> so products can be posted from here.
        You do Parts 1–3 <b>once</b>. After that you only come back here if WoodsyCart emails you that a connection stopped working.
        Take about 30 minutes, on a computer. Open each part below and follow the steps in order.
      </p>
      <div class="alert alert-warning fs-8">
        <b>Keep these private:</b> the <b>App secret</b>, the <b>Threads app secret</b> and the <b>access token</b> are like passwords.
        Paste them only into this Settings page — never into WhatsApp, email or chat. WoodsyCart does not store the secrets.
      </div>

      <h6 class="mt-3">What you need</h6>
      <ul class="fs-7">
        <li>The Facebook account that manages the <b>WoodsyCart Facebook Page</b> (you must be its admin).</li>
        <li>The <b>Instagram</b> login for @woodsycart (on your phone).</li>
        <li>The <b>Threads</b> app on your phone, logged in with the same Instagram account.</li>
      </ul>

      <!-- Part 1 -->
      <details class="border rounded p-2 mb-2" [open]="!s().instagramUsername">
        <summary class="fw-bold">Part 1 · Get Instagram ready (phone, 5 minutes) @if (s().instagramUsername) { <span class="badge-soft badge-soft-success ms-1">Done</span> }</summary>
        <ol class="fs-7 mt-2">
          <li>Open Instagram → your profile → <b>☰</b> (top right) → <b>Account type and tools</b> → <b>Switch to professional account</b>.
            Choose <b>Business</b> and the category <b>Furniture store</b>. (Skip if it already says Business or Creator.)</li>
          <li>Still in Instagram: <b>Edit profile</b> → <b>Page</b> → <b>Connect existing Page</b> → choose <b>WoodsyCart</b> → Done.</li>
          <li>Check: <b>Edit profile</b> now shows WoodsyCart under <b>Page</b>.</li>
          <li>Open the <b>Threads</b> app once and log in with this Instagram account — that creates the Threads profile.</li>
        </ol>
      </details>

      <!-- Part 2 -->
      <details class="border rounded p-2 mb-2" [open]="!s().metaAppId">
        <summary class="fw-bold">Part 2 · Create the Meta app (computer, 15 minutes, only once) @if (s().metaAppId) { <span class="badge-soft badge-soft-success ms-1">Done</span> }</summary>
        <p class="fs-8 text-muted mt-2 mb-1">A "Meta app" is a free key that lets WoodsyCart post for you. You make it once; it works for the live and QA sites.</p>
        <ol class="fs-7">
          <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> and log in with the Facebook account of the Page.
            First time only: <b>Get started</b>, verify your phone, choose <b>Developer</b>.</li>
          <li>Click <b>Create app</b>. Name: <b>WoodsyCart Social</b>. Email: <b>support&#64;woodsycart.com</b>. Click <b>Next</b>.</li>
          <li>On <b>Use cases</b>, tick <b>only</b> these two, then Next:
            <ul><li>Manage everything on your Page</li><li>Manage messaging &amp; content on Instagram</li></ul>
            <div class="alert alert-danger fs-8 py-1 px-2 mt-1 mb-0"><b>Do not tick anything else</b> (ads, WhatsApp, Messenger, Catalog…). Extra use cases can't be removed and block step 9 — you would have to delete the app and start again.</div></li>
          <li><b>Business</b>: choose <b>WoodsyCart</b> → Next → <b>Go to dashboard</b> (enter your Facebook password if asked).</li>
          <li>Left menu <b>Use cases</b> → <b>Add use case</b> → <b>Access the Threads API</b>.</li>
          <li>Left menu <b>Use cases</b>. On each use case click <b>Customize</b> → <b>Permissions</b> and click <b>Add</b> next to each of these:
            <ul>
              <li><b>Manage everything on your Page:</b> pages_show_list, pages_read_engagement, pages_manage_posts, business_management, read_insights, pages_read_user_content, pages_manage_engagement</li>
              <li><b>Manage messaging &amp; content on Instagram:</b> first choose <b>API setup with Facebook login</b>, then instagram_basic, instagram_content_publish, instagram_manage_contents, instagram_manage_insights, instagram_manage_comments</li>
              <li><b>Access the Threads API:</b> threads_basic, threads_content_publish, threads_delete, threads_manage_insights, threads_read_replies, threads_manage_replies</li>
            </ul></li>
          <li>Still in <b>Access the Threads API → Customize → Settings</b>, under <b>Redirect Callback URLs</b> add these two addresses (copy buttons), then <b>Save</b>.
            If it also asks for Uninstall and Delete callback URLs, use <code>https://woodsycart.com/policies/privacy</code>.
            <div class="d-flex flex-column gap-1 my-1">
              @for (u of callbackUrls(); track u) {
                <div class="d-flex gap-2 align-items-center"><code class="user-select-all">{{ u }}</code>
                  <button class="btn btn-sm btn-phoenix-secondary py-0" (click)="copy(u)"><i class="bi bi-clipboard"></i></button></div>
              }
            </div></li>
          <li>Left menu <b>App settings → Basic</b>, fill in and <b>Save changes</b>:
            <ul>
              <li>Privacy policy URL and User data deletion (choose "Data deletion instructions URL"): <code>https://woodsycart.com/policies/privacy</code></li>
              <li>Terms of Service URL: <code>https://woodsycart.com/policies/terms</code></li>
              <li>App icon: your logo (square, 1024 × 1024). Category: <b>Shopping</b>.</li>
            </ul></li>
          <li>Left menu <b>Publish</b> → click <b>Publish</b>. (If the button is grey, a use case from step 3 is wrong.) No business verification or App Review is needed — the app only posts to your own accounts.</li>
          <li>Left menu <b>App roles → Roles → Add People</b> → role <b>Threads Tester</b> → type <b>woodsycart</b> → Add.
            Then on your phone: Threads → profile → <b>☰ → Settings → Account → Website permissions → Invites</b> → <b>Accept</b>.</li>
        </ol>
        <p class="fs-8 text-muted mb-0">Where the keys are: <b>App settings → Basic</b>. The top pair (<b>App ID</b>, <b>App secret</b> — click Show) is for Instagram and Facebook. The lower pair (<b>Threads app ID</b>, <b>Threads app secret</b>) is for Threads.</p>
      </details>

      <!-- Part 3 -->
      <details class="border rounded p-2 mb-2" [open]="!s().connected">
        <summary class="fw-bold">Part 3 · Connect Instagram and Facebook (5 minutes) @if (s().connected) { <span class="badge-soft badge-soft-success ms-1">Connected</span> }</summary>
        <ol class="fs-7 mt-2">
          <li>Open <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener">Graph API Explorer</a> (developers.facebook.com → Tools → Graph API Explorer).</li>
          <li>On the right: <b>Meta App</b> = WoodsyCart Social. <b>User or Page</b> = User Token.</li>
          <li>Under <b>Permissions</b>, use <b>Add a permission</b> until all 12 of these are listed:
            <div class="d-flex gap-2 align-items-center my-1"><code class="user-select-all">{{ metaPermissions }}</code>
              <button class="btn btn-sm btn-phoenix-secondary py-0" (click)="copy(metaPermissions)"><i class="bi bi-clipboard"></i></button></div></li>
          <li>Click <b>Generate Access Token</b>. Facebook asks a few questions:
            <ul>
              <li>Pages: choose <b>Opt in to current Pages only</b> → tick <b>WoodsyCart</b>.</li>
              <li>Instagram accounts and businesses: the same — only <b>woodsycart</b> / <b>WoodsyCart</b>.</li>
              <li>Leave the permission switches on → <b>Save</b> → <b>Got it</b>.</li>
            </ul></li>
          <li>Copy the long <b>Access Token</b> at the top (copy icon). It works for about an hour, so do the next step straight away.</li>
          <li>Come back here → <b>Settings</b> tab → <b>Connection</b> card (<b>Change account</b> if already connected) → paste <b>App ID</b>, <b>App secret</b> and the token → <b>Connect</b>.
            If a <b>Facebook Page</b> list appears, choose WoodsyCart and click <b>Connect</b> again.</li>
          <li>Done when the card shows your Page and <b>&#64;woodsycart</b>. This connection does not expire.</li>
        </ol>
      </details>

      <!-- Part 4 -->
      <details class="border rounded p-2 mb-2" [open]="!s().threadsConnected">
        <summary class="fw-bold">Part 4 · Connect Threads (2 minutes) @if (s().threadsConnected) { <span class="badge-soft badge-soft-success ms-1">Connected</span> }</summary>
        <ol class="fs-7 mt-2">
          <li>Make sure Part 2, steps 5, 7 and 10 are done (Threads use case, the two addresses, Threads Tester accepted).</li>
          <li>Here → <b>Settings</b> tab → <b>Threads</b> card → paste the <b>Threads app ID</b> and <b>Threads app secret</b> (App settings → Basic, the lower pair).</li>
          <li>Click <b>Log in to Threads</b>. Threads opens: log in as woodsycart if asked and click <b>Allow</b>.</li>
          <li>You come back here with "Threads connected". Access renews itself every week; if it ever can't, WoodsyCart emails you.</li>
        </ol>
        <p class="fs-8 text-muted mb-0">If Threads shows an error instead: "redirect URI" → the address in Part 2 step 7 is missing or mistyped; "not accepted the invite" → Part 2 step 10.</p>
      </details>

      <!-- Part 5 -->
      <details class="border rounded p-2 mb-2">
        <summary class="fw-bold">Part 5 · Choose your settings (2 minutes)</summary>
        <ul class="fs-7 mt-2">
          <li><b>Post to Instagram / Facebook / Threads</b>: switch off a platform you don't want.</li>
          <li><b>Posting times</b>: one product goes out at each time (India time). 3 a day (11:00, 15:00, 20:30) is a good pace — many posts at once reach fewer people.</li>
          <li><b>Add new products automatically</b>: new products join the queue by themselves once published.</li>
          <li><b>Include the price</b> / <b>Show MRP and savings</b>, <b>WhatsApp number</b> (with 91, e.g. 917892200921), <b>City</b>, <b>Extra hashtags</b> (3–5 is best).</li>
          <li><b>Template</b>: the caption layout for Instagram and Facebook. Words in curly brackets like <code>{{ '{price}' }}</code> are filled in from the product; a line whose field is empty is left out. <b>Reset to default</b> undoes your changes.</li>
          <li><b>Threads text</b>: a shorter layout (Threads allows 500 characters) with a clickable product link, and one <b>Topic tag</b> (e.g. Furniture).</li>
          <li><b>Reels</b>: switch on <b>Also post a Reel</b> to post a short video of each product to Instagram and Facebook, at the <b>Reel times</b> (one a day, e.g. 18:00, is a good pace).</li>
          <li><b>Reel music</b>: upload a few free tracks (YouTube Studio → <b>Audio library</b> → filter "No attribution required", or <b>Pixabay Music</b>) with <b>Upload a track</b>. Each product always uses the same track. With no tracks, reels have no music.</li>
          <li>Click <b>Save settings</b>.</li>
        </ul>
      </details>

      <!-- Part 6 -->
      <details class="border rounded p-2 mb-2">
        <summary class="fw-bold">Part 6 · Posting products (every day)</summary>
        <ul class="fs-7 mt-2">
          <li><b>One product:</b> open the product → <b>Social media</b> card → <b>Post now</b> or <b>Add to queue</b>. <b>Preview caption</b> shows the text first.</li>
          <li><b>Many products:</b> Products page → filter <b>Social: Not posted</b> (or <b>Not on Threads</b>) → tick products → <b>Post to social media</b> → <b>Add to the queue</b>.</li>
          <li>Each product is posted <b>once</b> per platform; products already posted are skipped.</li>
          <li><b>Price changed after posting?</b> Facebook updates by itself. Instagram shows <b>Out of date</b>: click <b>Copy updated caption</b>, then in the Instagram app open the post → ⋯ → <b>Edit</b>, paste, save, and click <b>Mark as updated</b>. Threads can't be edited: <b>Keep as is</b> or <b>Replace post</b>.</li>
          <li><b>Delete post</b> removes it from that platform; the product can be posted again later.</li>
          <li><b>Reel with a trending song (by hand):</b> product → Social media card → <b>Reel video</b> → <b>Make reel</b> → <b>Download (add trending song)</b>. On the phone: Instagram → <b>+</b> → <b>Reel</b> → choose the video → <b>Music</b> → pick a trending song → paste the caption (<b>Preview caption</b> → copy) → Share. Trending songs can only be added this way, never automatically.</li>
          <li>The <b>Queue</b>, <b>Posted</b>, <b>Out of date</b> and <b>Failed</b> tabs on this page show everything in one place.</li>
          <li><b>Comments:</b> new comments on Instagram, Facebook and Threads appear on the <b>Comments</b> tab (red number in the menu) and are emailed to you. Type your answer under a comment and click <b>Reply</b>: it is posted as the WoodsyCart account.</li>
          <li><b>Performance:</b> views, likes, comments and shares of each post, totals per platform and your best posts. Numbers show on the <b>Posted</b> tab and the product's Social media card too.</li>
        </ul>
      </details>

      <!-- Part 7 -->
      <details class="border rounded p-2 mb-2">
        <summary class="fw-bold">Part 7 · Product feed for Meta (optional, 20 minutes, only once)</summary>
        <p class="fs-7 mt-2 mb-2">Sends all products, prices, stock and photos to a Meta <b>catalog</b> once a day, for Facebook catalog ads and Instagram Shopping. It keeps itself up to date after this.</p>
        <ol class="fs-7 mb-2">
          <li>On the <b>Settings</b> tab, card <b>Product feed (Meta catalog)</b> → turn on <b>Publish the product feed</b>.</li>
          <li>Wait until the card says all products are ready (about 2 hours the first time), then click <b>Copy</b> next to the feed address.</li>
          <li>Open <b>business.facebook.com/commerce</b> → <b>Add products</b>.</li>
          <li>Catalog type <b>E-commerce</b> → <b>Upload product info</b> → owner: the <b>WoodsyCart</b> business portfolio → name it (for example WoodsyCart_Catalog_Products) → <b>Create</b>.</li>
          <li>In the catalog: <b>Data sources</b> → <b>Add items</b> → <b>Data feed</b> → <b>Use a URL</b> → paste the feed address. Leave username and password empty.</li>
          <li>Schedule <b>Daily</b> (a quiet time such as 3:00 AM), currency <b>INR</b> → <b>Upload</b>.</li>
          <li>Commerce Manager → <b>Settings</b> → <b>General</b> → <b>Default language and country</b> → English, India.</li>
          <li>Check: the card here shows <b>Last read by Meta</b> with a time, and the catalog's <b>Products</b> page lists your products.</li>
        </ol>
        <p class="fs-8 text-muted mb-1"><b>Don't click:</b> Store locations → Connect, Associate sources, Assign partner, or the Pixel, ads and checkout prompts. None of them are needed.</p>
        <p class="fs-8 text-muted mb-0"><b>Instagram Shopping</b> (product tags) needs a <b>Business</b> Instagram account and is by invitation in India. WoodsyCart stays on a Creator account so hand-made reels keep the trending songs.</p>
      </details>

      <!-- Troubleshooting -->
      <details class="border rounded p-2 mb-0">
        <summary class="fw-bold">If something goes wrong</summary>
        <table class="table table-sm fs-8 mt-2 mb-0">
          <thead><tr><th>What you see</th><th>What to do</th></tr></thead>
          <tbody>
            <tr><td>Email "Instagram and Facebook are disconnected"</td><td>Do Part 3 again (new token → Connect). Happens after a Facebook password change.</td></tr>
            <tr><td>Email "Threads needs connecting again" or "Threads is disconnected"</td><td>Do Part 4 again.</td></tr>
            <tr><td>"Insufficient permissions" when deleting</td><td>A permission is missing: check Part 2 step 6, then redo Part 3 (Instagram) or Part 4 (Threads).</td></tr>
            <tr><td>Yellow note on <b>Comments</b> or <b>Performance</b>: "…need the … permission"</td><td>Add the permissions named in Part 2 step 6, then redo Part 3 (Instagram and Facebook) or Part 4 (Threads). The note goes away after connecting again.</td></tr>
            <tr><td>A post is in <b>Failed</b></td><td>Read the red message on it, fix that, then click <b>Try again</b>.</td></tr>
            <tr><td>Publish button grey in the Meta app</td><td>An extra use case was ticked in Part 2 step 3: create a new app with only the right ones and delete the old one.</td></tr>
            <tr><td>The status on a product looks old</td><td>Reload the product page; it checks again when it opens.</td></tr>
            <tr><td>"Reels need FFmpeg"</td><td>The video tool is missing on the server (C:\\WoodsyCart\\tools\\ffmpeg). See the handbook, section 15.</td></tr>
            <tr><td>Commerce Manager shows feed errors, or <b>Last read by Meta</b> is old</td><td>Check the feed switch is on, open the feed address in a browser (it should download a file), then in Commerce Manager → <b>Data sources</b> → the feed → <b>Fetch now</b>. Send the <b>Issues</b> list to your developer.</td></tr>
          </tbody>
        </table>
      </details>

      <ng-container footer><button class="btn btn-primary" (click)="closed.emit()">Close</button></ng-container>
    </wc-modal>
  `
})
export class SocialGuideComponent {
  private toast = inject(ToastService);
  readonly s = input.required<SocialSettings>();
  readonly closed = output<void>();
  protected readonly metaPermissions =
    'pages_show_list, pages_read_engagement, pages_manage_posts, business_management, read_insights, pages_read_user_content, pages_manage_engagement, ' +
    'instagram_basic, instagram_content_publish, instagram_manage_contents, instagram_manage_insights, instagram_manage_comments';

  /** Live and QA both use the one Meta app, so both addresses are registered. */
  callbackUrls() {
    const here = this.s().threadsCallbackUrl;
    const all = ['https://api.woodsycart.com/api/social/threads/callback', 'https://qaapi.woodsycart.com/api/social/threads/callback'];
    return here && !all.includes(here) ? [...all, here] : all;
  }

  copy(text: string) {
    navigator.clipboard.writeText(text).then(() => this.toast.success('Copied'), () => this.toast.info(text));
  }
}
