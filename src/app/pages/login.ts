import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';

@Component({
  selector: 'wc-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div style="width: 100%; max-width: 400px">
        <div class="text-center mb-4">
          <img src="logo.svg" width="56" height="56" alt="" />
          <h3 class="mt-3 mb-1">Sign in</h3>
          <p class="text-muted">WoodsyCart admin console</p>
        </div>
        <form class="card card-body p-4" (ngSubmit)="submit()">
          <div class="mb-3">
            <label class="form-label" for="email">Email address</label>
            <input id="email" class="form-control" type="email" name="email" [(ngModel)]="email" autocomplete="username" required />
          </div>
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-baseline">
              <label class="form-label" for="password">Password</label>
              <a class="fs-7 fw-bold" routerLink="/forgot-password" [queryParams]="email.includes('@') ? { email: email.trim() } : {}">Forgot password?</a>
            </div>
            <input id="password" class="form-control" type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
          </div>
          @if (error()) { <div class="alert alert-danger py-2 fs-7">{{ error() }}</div> }
          <button class="btn btn-primary w-100" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        </form>
      </div>
    </div>
  `
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  constructor() {
    if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']);
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: e => { this.error.set(e.error?.message ?? 'Sign in failed'); this.busy.set(false); }
    });
  }
}
