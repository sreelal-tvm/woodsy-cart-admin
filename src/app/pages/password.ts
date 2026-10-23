import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';

/** Step 1: staff enter their email and get a reset link that opens the admin app. */
@Component({
  selector: 'wc-forgot-password',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div style="width: 100%; max-width: 400px">
        <div class="text-center mb-4">
          <img src="logo.svg" width="56" height="56" alt="" />
          <h3 class="mt-3 mb-1">Forgot your password?</h3>
          <p class="text-muted">Enter your admin email and we'll send you a link to choose a new one.</p>
        </div>
        @if (sent()) {
          <div class="card card-body p-4 text-center">
            <i class="bi bi-envelope-check text-success" style="font-size: 2.4rem"></i>
            <h5 class="mt-2">Check your email</h5>
            <p class="text-muted fs-7 mb-2">{{ sent() }}</p>
            <p class="text-muted fs-8 mb-3">Not there? Check spam, or try again in 2 minutes.</p>
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn btn-phoenix-secondary btn-sm" (click)="sent.set('')">Use another email</button>
              <a class="btn btn-primary btn-sm" routerLink="/login">Back to sign in</a>
            </div>
          </div>
        } @else {
          <form class="card card-body p-4" (ngSubmit)="submit()">
            <div class="mb-3">
              <label class="form-label" for="email">Email address</label>
              <input id="email" class="form-control" type="email" name="email" [(ngModel)]="email" autocomplete="username" required autofocus />
            </div>
            @if (error()) { <div class="alert alert-danger py-2 fs-7">{{ error() }}</div> }
            <button class="btn btn-primary w-100" [disabled]="busy() || !email.includes('@')">{{ busy() ? 'Sending…' : 'Send reset link' }}</button>
            <p class="text-center fs-7 mt-3 mb-0">Remembered it? <a routerLink="/login">Sign in</a></p>
          </form>
        }
        <p class="text-center text-muted fs-8 mt-3">No access to that email? Ask the store owner to reset your password.</p>
      </div>
    </div>
  `
})
export class ForgotPasswordPage implements OnInit {
  private auth = inject(AuthService);
  readonly emailParam = input<string>(undefined, { alias: 'email' });
  email = '';
  protected busy = signal(false);
  protected error = signal('');
  protected sent = signal('');

  ngOnInit() { if (this.emailParam()) this.email = this.emailParam()!; }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: r => { this.sent.set(r.message); this.busy.set(false); },
      error: e => { this.error.set(e.error?.message ?? 'Something went wrong. Please try again.'); this.busy.set(false); }
    });
  }
}

/** Step 2: the emailed link. Choose the new password, then the staff member is signed in. */
@Component({
  selector: 'wc-reset-password',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div style="width: 100%; max-width: 400px">
        <div class="text-center mb-4">
          <img src="logo.svg" width="56" height="56" alt="" />
          <h3 class="mt-3 mb-1">Choose a new password</h3>
          @if (email) { <p class="text-muted">For <b>{{ email }}</b></p> }
        </div>
        @if (!email || !token) {
          <div class="card card-body p-4 text-center">
            <p class="mb-3">This reset link is incomplete. Open the link from your email again, or request a new one.</p>
            <a class="btn btn-primary" routerLink="/forgot-password">Request a new link</a>
          </div>
        } @else {
          <form class="card card-body p-4" (ngSubmit)="submit()">
            <input type="email" name="u" [value]="email" autocomplete="username" hidden />
            <div class="mb-3">
              <label class="form-label" for="pw">New password</label>
              <div class="input-group">
                <input id="pw" [type]="show() ? 'text' : 'password'" class="form-control" name="pw" [(ngModel)]="password" required minlength="8" autocomplete="new-password" autofocus />
                <button type="button" class="btn btn-phoenix-secondary" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
                  <i class="bi" [class.bi-eye]="!show()" [class.bi-eye-slash]="show()"></i></button>
              </div>
              <div class="form-text">At least 8 characters.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="pw2">Confirm new password</label>
              <input id="pw2" [type]="show() ? 'text' : 'password'" class="form-control" name="pw2" [(ngModel)]="confirm" required autocomplete="new-password" />
              @if (confirm && confirm !== password) { <div class="form-text text-danger">The passwords don't match.</div> }
            </div>
            @if (error()) {
              <div class="alert alert-danger py-2 fs-7">{{ error() }}
                @if (expired()) { <a routerLink="/forgot-password" [queryParams]="{ email: email }">Request a new link</a> }</div>
            }
            <button class="btn btn-primary w-100" [disabled]="busy() || password.length < 8 || password !== confirm">{{ busy() ? 'Saving…' : 'Save and sign in' }}</button>
          </form>
        }
      </div>
    </div>
  `
})
export class ResetPasswordPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private location = inject(Location);
  readonly emailParam = input<string>(undefined, { alias: 'email' });
  readonly tokenParam = input<string>(undefined, { alias: 'token' });
  email = ''; token = ''; password = ''; confirm = '';
  protected show = signal(false);
  protected busy = signal(false);
  protected error = signal('');
  protected expired = signal(false);

  ngOnInit() {
    this.email = this.emailParam() ?? '';
    this.token = this.tokenParam() ?? '';
    // Keep the one-time token out of the address bar and browser history
    if (this.token) this.location.replaceState('/reset-password');
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.resetPassword(this.email, this.token, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: e => {
        const msg: string = e.error?.message ?? 'Something went wrong. Please try again.';
        this.error.set(msg);
        this.expired.set(/expired|invalid/i.test(msg));
        this.busy.set(false);
      }
    });
  }
}
