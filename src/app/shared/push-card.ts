import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ToastService } from '../core/toast.service';
import { InstallService } from './install';

interface PushDevice { id: number; device?: string; createdAt: string; lastSentAt?: string; lastError?: string; thisDevice: boolean; }
interface PushStatus { publicKey: string; thisDevice: boolean; devices: PushDevice[]; }

/**
 * Admin → Email & notifications: new-order notifications on this phone or computer (Web Push through the app's service worker).
 * Each device is turned on here once; the list shows this person's other devices.
 */
@Component({
  selector: 'wc-push-card',
  imports: [DatePipe],
  template: `
    <div class="card mb-3"><div class="card-body">
      <h5><i class="bi bi-bell me-1"></i>Notifications on this device</h5>
      <p class="text-muted fs-7">A notification on this phone or computer for every new order — tap it to open the order.</p>
      @if (!sw.isEnabled) {
        <div class="alert alert-subtle-info py-2 fs-7 mb-0">Works in the live Admin (installed app or browser), not on this test server.</div>
      } @else if (needsInstall) {
        <div class="alert alert-subtle-warning py-2 fs-7 mb-2">On iPhone, notifications only work in the installed app.</div>
        <button class="btn btn-sm btn-phoenix-secondary" (click)="installer.install()"><i class="bi bi-phone me-1"></i>Install the app</button>
      } @else if (blocked()) {
        <div class="alert alert-subtle-danger py-2 fs-7 mb-0">Notifications are blocked for Admin on this device. Allow them in the browser's site settings
          (tap the icon left of the address, or the app's settings on the phone), then reload this page.</div>
      } @else if (status(); as s) {
        @if (s.thisDevice) {
          <div class="d-flex align-items-center gap-2 mb-2"><span class="badge badge-phoenix badge-phoenix-success"><i class="bi bi-check-circle me-1"></i>On for this device</span></div>
          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-soft-primary" [disabled]="busy()" (click)="test()">Send test</button>
            <button class="btn btn-sm btn-phoenix-secondary" [disabled]="busy()" (click)="turnOff()">Turn off</button>
          </div>
        } @else {
          <button class="btn btn-sm btn-primary" [disabled]="busy()" (click)="turnOn()"><i class="bi bi-bell me-1"></i>{{ busy() ? 'Turning on…' : 'Turn on for this device' }}</button>
        }
        @if (others(s).length) {
          <div class="fs-8 text-muted mt-3 mb-1">Your other devices</div>
          @for (d of others(s); track d.id) {
            <div class="d-flex align-items-center gap-2 fs-7 py-1 border-top">
              <i class="bi bi-phone text-muted"></i>
              <div class="flex-grow-1">{{ d.device ?? 'Device' }}
                <span class="text-muted fs-8 d-block">On since {{ d.createdAt | date: 'd MMM' }}{{ d.lastSentAt ? ' · last sent ' + (d.lastSentAt | date: 'd MMM, h:mm a') : '' }}</span>
                @if (d.lastError) { <span class="text-danger fs-8 d-block">{{ d.lastError }}</span> }
              </div>
              <button class="btn btn-link btn-sm text-danger p-0" (click)="remove(d)" title="Stop notifications on this device"><i class="bi bi-x-lg"></i></button>
            </div>
          }
        }
      } @else {
        <div class="text-muted fs-7"><span class="spinner-border spinner-border-sm me-2"></span>Checking this device…</div>
      }
    </div></div>
  `
})
export class PushCardComponent {
  protected sw = inject(SwPush);
  protected installer = inject(InstallService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected status = signal<PushStatus | null>(null);
  protected busy = signal(false);
  protected blocked = signal(typeof Notification !== 'undefined' && Notification.permission === 'denied');
  /** iPhone in the browser (not the installed app): Apple allows notifications only once installed. */
  protected needsInstall = this.installer.ios && this.installer.eligible();
  private endpoint: string | null = null;

  constructor() { if (this.sw.isEnabled) this.load(); }

  protected others(s: PushStatus) { return s.devices.filter(d => !d.thisDevice); }

  private async load() {
    this.endpoint = (await firstValueFrom(this.sw.subscription))?.endpoint ?? null;
    this.api.get<PushStatus>('admin/push/status', this.endpoint ? { endpoint: this.endpoint } : {}).subscribe(s => this.status.set(s));
  }

  async turnOn() {
    const s = this.status();
    if (!s) return;
    this.busy.set(true);
    try {
      const sub = await this.sw.requestSubscription({ serverPublicKey: s.publicKey });
      this.endpoint = sub.endpoint;
      this.api.post<PushStatus>('admin/push/subscribe', sub.toJSON()).subscribe({
        next: st => { this.status.set(st); this.toast.success('Notifications on for this device'); this.busy.set(false); },
        error: () => this.busy.set(false)
      });
    } catch {
      this.busy.set(false);
      if (Notification.permission === 'denied') this.blocked.set(true);
      else this.toast.error("Couldn't turn on notifications on this device.");
    }
  }

  async turnOff() {
    this.busy.set(true);
    const endpoint = this.endpoint;
    try { await this.sw.unsubscribe(); } catch { /* already off in the browser */ }
    this.api.post('admin/push/remove', { endpoint }).subscribe(() => { this.busy.set(false); this.toast.info('Notifications off for this device'); this.endpoint = null; this.load(); });
  }

  test() {
    this.busy.set(true);
    this.api.post<{ devices: number }>('admin/push/test').subscribe({
      next: r => { this.busy.set(false); this.toast.success(`Test sent to ${r.devices} device${r.devices === 1 ? '' : 's'} — it should arrive in a few seconds`); setTimeout(() => this.load(), 5000); },
      error: () => this.busy.set(false)
    });
  }

  remove(d: PushDevice) {
    if (!confirm(`Stop notifications on ${d.device ?? 'that device'}?`)) return;
    this.api.post('admin/push/remove', { id: d.id }).subscribe(() => this.load());
  }
}
