import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, User } from './models';
import { ToastService } from './toast.service';

const KEY = 'wc_admin_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private state = signal<AuthResponse | null>(this.restore());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly isLoggedIn = computed(() => {
    const s = this.state();
    return !!s && new Date(s.expiresAt) > new Date();
  });

  private restore(): AuthResponse | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as AuthResponse) : null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('auth/admin/login', { email, password }).pipe(
      tap(res => {
        this.state.set(res);
        localStorage.setItem(KEY, JSON.stringify(res));
      })
    );
  }

  forgotPassword(email: string) {
    return this.api.post<{ message: string }>('auth/admin/forgot-password', { email });
  }

  /** Sets the new password from the emailed link, then signs the staff member in. */
  resetPassword(email: string, token: string, newPassword: string) {
    return this.api.post<AuthResponse>('auth/admin/reset-password', { email, token, newPassword }).pipe(
      tap(res => {
        this.state.set(res);
        localStorage.setItem(KEY, JSON.stringify(res));
      })
    );
  }

  logout(redirect = true) {
    this.state.set(null);
    localStorage.removeItem(KEY);
    if (redirect) this.router.navigate(['/login']);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/auth/')) {
        auth.logout();
        toast.error('Your session has expired. Please sign in again.');
      } else if (err.status === 0) {
        toast.error('Cannot reach the WoodsyCart API. Is it running?');
      } else if (err.error?.message) {
        toast.error(err.error.message);
      } else if (err.status >= 400) {
        toast.error(`Request failed (${err.status}).`);
      }
      return throwError(() => err);
    })
  );
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};
