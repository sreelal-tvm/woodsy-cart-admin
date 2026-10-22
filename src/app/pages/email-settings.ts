import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Paged } from '../core/models';
import { ToastService } from '../core/toast.service';
import { SHARED_PIPES } from '../shared/pipes';
import { PagerComponent } from '../shared/ui';
import { environment } from '../../environments/environment';

interface EventInfo { key: string; label: string; audience: 'Customer' | 'Admin'; description: string; }
interface Settings {
  enabled: boolean; provider?: string | null; host?: string | null; port: number; useStartTls: boolean; username?: string | null; hasPassword: boolean;
  fromEmail?: string | null; fromName?: string | null; replyTo?: string | null; adminEmails: string[]; events: Record<string, boolean>;
  configured: boolean; eventCatalog: EventInfo[];
}
interface LogRow { id: number; createdAt: string; event: string; to: string; subject: string; status: 'Sent' | 'Failed' | 'Skipped'; error?: string; orderId?: number; }

interface Preset { key: string; name: string; host: string; port: number; help: string; userHint: string; }
const PRESETS: Preset[] = [
  { key: 'gmail', name: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, userHint: 'Your full Gmail address',
    help: 'Turn on 2-Step Verification on the Google account, then create an App password (Google Account → Security → App passwords) and paste it as the password. Up to ~500 emails a day.' },
  { key: 'zoho', name: 'Zoho Mail', host: 'smtp.zoho.in', port: 587, userHint: 'Your Zoho email address',
    help: 'For zoho.in accounts. If 2-factor login is on, create an application-specific password in Zoho Accounts → Security.' },
  { key: 'office365', name: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, userHint: 'Your Microsoft 365 email address',
    help: 'SMTP sending must be allowed for the mailbox (Microsoft 365 admin → user → Mail → Authenticated SMTP). With MFA, use an app password.' },
  { key: 'brevo', name: 'Brevo (free 300/day)', host: 'smtp-relay.brevo.com', port: 587, userHint: 'Your Brevo SMTP login',
    help: 'Good for transactional emails. Brevo → SMTP & API → SMTP: copy the login and generate an SMTP key (use it as the password). Verify your From address/domain in Brevo.' },
  { key: 'ses', name: 'Amazon SES (Mumbai)', host: 'email-smtp.ap-south-1.amazonaws.com', port: 587, userHint: 'SES SMTP username',
    help: 'Create SMTP credentials in the SES console and verify your domain. New SES accounts can only send to verified addresses until you request production access.' },
  { key: 'hostinger', name: 'Hostinger email', host: 'smtp.hostinger.com', port: 587, userHint: 'Your mailbox address',
    help: 'Use the mailbox address and its password from Hostinger → Emails.' },
  { key: 'custom', name: 'Other (custom SMTP)', host: '', port: 587, userHint: 'Login for your mail server', help: 'Enter your provider\'s SMTP server. Use port 587 with STARTTLS (port 465 is not supported).' }
];

@Component({
  selector: 'wc-email-settings',
  imports: [FormsModule, DatePipe, RouterLink, PagerComponent, ...SHARED_PIPES],
  styles: [`
    .preset { border: 1px solid var(--bs-border-color); border-radius: .5rem; padding: .45rem .7rem; background: transparent; font-weight: 600; font-size: .85rem; }
    .preset.on { border-color: #9A5226; background: rgba(154, 82, 38,.08); color: #9A5226; }
    .chip { display: inline-flex; align-items: center; gap: .3rem; background: var(--phoenix-gray-100, #F3EEE7); border-radius: 2rem; padding: .2rem .4rem .2rem .7rem; font-size: .85rem; }
    .ev { border-bottom: 1px solid var(--bs-border-color); padding: .6rem 0; }
    .ev:last-child { border-bottom: 0; }
  `],
  template: `
    <h2 class="page-title">Email &amp; notifications</h2>
    <p class="page-subtitle">The mail server WoodsyCart sends from, who on your team gets admin emails, and which emails go out.</p>

    @if (s(); as s) {
      @if (s.configured) {
        <div class="alert alert-subtle-success py-2 fs-7"><i class="bi bi-check-circle me-1"></i>Email is <b>on</b> — sending from <b>{{ s.fromEmail }}</b> through {{ s.host }}.</div>
      } @else {
        <div class="alert alert-subtle-warning py-2 fs-7"><i class="bi bi-exclamation-triangle me-1"></i>Email is <b>off</b> — no emails are being sent to customers or your team. Set up the mail server below and switch it on.</div>
      }

      <ul class="nav nav-underline mb-3 gap-4">
        <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'server'" (click)="tab.set('server')">Mail server</a></li>
        <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'events'" (click)="tab.set('events')">Notifications</a></li>
        <li class="nav-item"><a class="nav-link cursor-pointer" [class.active]="tab() === 'log'" (click)="tab.set('log'); loadLog()">Sent emails</a></li>
      </ul>

      @switch (tab()) {
        @case ('server') {
          <div class="row g-3">
            <div class="col-xl-8">
              <div class="card"><div class="card-body">
                <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" id="en" [(ngModel)]="s.enabled" />
                  <label class="form-check-label fw-bold" for="en">Send emails</label></div>

                <label class="form-label">Email provider</label>
                <div class="d-flex flex-wrap gap-2 mb-2">
                  @for (p of presets; track p.key) { <button type="button" class="preset" [class.on]="s.provider === p.key" (click)="usePreset(p)">{{ p.name }}</button> }
                </div>
                @if (preset(); as p) { <div class="alert alert-subtle-info py-2 fs-7 mb-3"><i class="bi bi-info-circle me-1"></i>{{ p.help }}</div> }

                <div class="row g-2">
                  <div class="col-md-8"><label class="form-label">SMTP server</label><input class="form-control" [(ngModel)]="s.host" placeholder="smtp.example.com" /></div>
                  <div class="col-md-2"><label class="form-label">Port</label><input type="number" class="form-control" [(ngModel)]="s.port" /></div>
                  <div class="col-md-2 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="tls" [(ngModel)]="s.useStartTls" /><label class="form-check-label" for="tls">STARTTLS</label></div></div>
                  <div class="col-md-6"><label class="form-label">Username</label><input class="form-control" [(ngModel)]="s.username" [placeholder]="preset()?.userHint ?? ''" autocomplete="off" /></div>
                  <div class="col-md-6"><label class="form-label">Password / app password</label>
                    <input type="password" class="form-control" [(ngModel)]="password" [placeholder]="s.hasPassword ? 'Saved — leave empty to keep it' : ''" autocomplete="new-password" />
                    <div class="form-text">Stored encrypted; never shown again.</div></div>
                  <div class="col-md-6"><label class="form-label">From email</label><input class="form-control" [(ngModel)]="s.fromEmail" [placeholder]="exampleFrom" />
                    <div class="form-text">Usually the same as the username (Gmail and Microsoft require that).</div></div>
                  <div class="col-md-6"><label class="form-label">From name</label><input class="form-control" [(ngModel)]="s.fromName" placeholder="WoodsyCart" /></div>
                  <div class="col-md-6"><label class="form-label">Reply-to <span class="text-muted">(optional)</span></label><input class="form-control" [(ngModel)]="s.replyTo" placeholder="Where customer replies go" /></div>
                </div>
              </div></div>
            </div>

            <div class="col-xl-4">
              <div class="card mb-3"><div class="card-body">
                <h5>Admin notification emails</h5>
                <p class="text-muted fs-7">Everyone here gets the admin emails (new orders, payments, returns, enquiries…).</p>
                <div class="d-flex flex-wrap gap-1 mb-2">
                  @for (a of s.adminEmails; track a) { <span class="chip">{{ a }}<button class="btn btn-link btn-sm p-0 lh-1" (click)="removeAdmin(a)" title="Remove"><i class="bi bi-x"></i></button></span> }
                  @empty { <span class="text-danger fs-7">No one yet — add at least one address.</span> }
                </div>
                <div class="input-group input-group-sm">
                  <input class="form-control" [(ngModel)]="newAdmin" placeholder="name@example.com" (keyup.enter)="addAdmin()" />
                  <button class="btn btn-phoenix-secondary" (click)="addAdmin()">Add</button>
                </div>
              </div></div>

              <div class="card"><div class="card-body">
                <h5>Send a test email</h5>
                <p class="text-muted fs-7">Save first, then send a test to check everything works.</p>
                <div class="input-group input-group-sm">
                  <input class="form-control" [(ngModel)]="testTo" placeholder="you@example.com" />
                  <button class="btn btn-soft-primary" [disabled]="testing()" (click)="test()">{{ testing() ? 'Sending…' : 'Send test' }}</button>
                </div>
                @if (testResult(); as r) {
                  <div class="alert py-2 fs-7 mt-2 mb-0" [class.alert-subtle-success]="r.ok" [class.alert-subtle-danger]="!r.ok">{{ r.message }}</div>
                }
              </div></div>
            </div>
          </div>
          <div class="sticky-actions d-flex justify-content-end mt-3"><button class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save email settings' }}</button></div>
        }

        @case ('events') {
          <div class="row g-3">
            @for (group of ['Customer', 'Admin']; track group) {
              <div class="col-xl-6">
                <div class="card h-100"><div class="card-body">
                  <h5 class="mb-1">{{ group === 'Customer' ? 'Emails to customers' : 'Emails to your team' }}</h5>
                  <p class="text-muted fs-7">{{ group === 'Customer' ? 'Sent to the customer\\u2019s email on the order (customers without email get none).' : 'Sent to every admin notification email.' }}</p>
                  @for (e of eventsFor(group); track e.key) {
                    <div class="ev d-flex gap-3 align-items-start">
                      <div class="form-check form-switch mt-1"><input class="form-check-input" type="checkbox" [id]="'ev' + e.key" [(ngModel)]="s.events[e.key]" /></div>
                      <label class="flex-grow-1" [for]="'ev' + e.key"><b class="d-block">{{ e.label }}</b><span class="text-muted fs-7">{{ e.description }}</span></label>
                    </div>
                  }
                </div></div>
              </div>
            }
          </div>
          <div class="sticky-actions d-flex justify-content-end mt-3"><button class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save notifications' }}</button></div>
        }

        @case ('log') {
          <div class="filter-pills mb-3">
            @for (f of ['', 'Sent', 'Failed', 'Skipped']; track f) { <a [class.active]="logStatus === f" (click)="logStatus = f; logPage.set(1); loadLog()">{{ f || 'All' }}</a> }
          </div>
          <div class="card">
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr><th>When</th><th>Email</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
                <tbody>
                  @for (l of log().items; track l.id) {
                    <tr>
                      <td class="text-nowrap text-muted fs-7">{{ l.createdAt | date: 'dd MMM, h:mm a' }}</td>
                      <td class="fs-7">{{ eventLabel(l.event) }}@if (l.orderId) { <div><a class="fs-8" [routerLink]="['/orders', l.orderId]">Open order</a></div> }</td>
                      <td class="fs-7 text-break" style="max-width: 220px">{{ l.to }}</td>
                      <td class="fs-7">{{ l.subject }}</td>
                      <td><span class="badge-soft" [class.badge-soft-success]="l.status === 'Sent'" [class.badge-soft-danger]="l.status === 'Failed'" [class.badge-soft-secondary]="l.status === 'Skipped'">{{ l.status }}</span>
                        @if (l.error) { <div class="fs-8 text-muted mt-1" style="max-width: 280px">{{ l.error }}</div> }</td>
                    </tr>
                  } @empty { <tr><td colspan="5"><div class="empty-state"><i class="bi bi-envelope"></i>No emails yet.</div></td></tr> }
                </tbody>
              </table>
            </div>
          </div>
          <wc-pager [page]="logPage()" [pageSize]="30" [total]="log().total" (pageChange)="logPage.set($event); loadLog()" />
        }
      }
    } @else { <div class="skeleton" style="height: 420px"></div> }
  `
})
export class EmailSettingsPage {
  /** e.g. orders@woodsycart.com, from the storefront address in config.json */
  protected exampleFrom = 'orders@' + (environment.storefrontUrl.replace(/^https?:\/\/(www\.)?/, '').split(/[:/]/)[0] || 'yourdomain.com');
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected readonly presets = PRESETS;
  protected tab = signal<'server' | 'events' | 'log'>('server');
  protected s = signal<Settings | null>(null);
  protected saving = signal(false);
  protected testing = signal(false);
  protected testResult = signal<{ ok: boolean; message: string } | null>(null);
  protected log = signal<Paged<LogRow>>({ items: [], total: 0, page: 1, pageSize: 30 });
  protected logPage = signal(1);
  logStatus = '';
  password = '';
  newAdmin = '';
  testTo = '';
  protected preset = computed(() => PRESETS.find(p => p.key === this.s()?.provider) ?? null);

  constructor() { this.load(); }

  load() {
    this.api.get<Settings>('admin/email/settings').subscribe(s => {
      this.s.set(s);
      this.testTo ||= s.adminEmails[0] ?? '';
    });
  }

  usePreset(p: Preset) {
    this.s.update(s => s ? { ...s, provider: p.key, host: p.host || s.host, port: p.port, useStartTls: true } : s);
  }

  addAdmin() {
    const e = this.newAdmin.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { this.toast.error('Enter a valid email address.'); return; }
    this.s.update(s => s && !s.adminEmails.includes(e) ? { ...s, adminEmails: [...s.adminEmails, e] } : s);
    this.newAdmin = '';
  }

  removeAdmin(e: string) { this.s.update(s => s ? { ...s, adminEmails: s.adminEmails.filter(x => x !== e) } : s); }

  eventsFor(group: string) { return this.s()?.eventCatalog.filter(e => e.audience === group) ?? []; }
  eventLabel(key: string) {
    const e = this.s()?.eventCatalog.find(x => x.key === key);
    return key === 'Test' ? 'Test email' : e ? `${e.label} (${e.audience === 'Admin' ? 'team' : 'customer'})` : key;
  }

  save() {
    const s = this.s()!;
    if (this.newAdmin.trim()) this.addAdmin();
    this.saving.set(true);
    this.api.put<Settings>('admin/email/settings', {
      enabled: s.enabled, provider: s.provider, host: s.host, port: s.port, useStartTls: s.useStartTls, username: s.username,
      password: this.password || null, fromEmail: s.fromEmail, fromName: s.fromName, replyTo: s.replyTo,
      adminEmails: this.s()!.adminEmails, events: s.events
    }).subscribe({
      next: r => { this.s.set(r); this.password = ''; this.saving.set(false); this.toast.success('Email settings saved'); },
      error: () => this.saving.set(false)
    });
  }

  test() {
    this.testing.set(true);
    this.testResult.set(null);
    this.api.post<{ ok: boolean; message: string }>('admin/email/test', { to: this.testTo }).subscribe({
      next: r => { this.testing.set(false); this.testResult.set(r); },
      error: () => this.testing.set(false)
    });
  }

  loadLog() {
    this.api.get<Paged<LogRow>>('admin/email/log', { status: this.logStatus || null, page: this.logPage() }).subscribe(l => this.log.set(l));
  }
}
