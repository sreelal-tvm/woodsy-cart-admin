import { Pipe, PipeTransform, inject } from '@angular/core';
import { ApiService } from '../core/api.service';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹ in Indian grouping: 1,25,000 */
/** "Sreelal M" → "SM", "Sreelal" → "S": first letters of the first and last names (avatars). */
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name?: string | null) {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  }
}

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(v: number | null | undefined, decimals = false): string {
    if (v === null || v === undefined) return '—';
    return (decimals ? inr2 : inr).format(v);
  }
}

@Pipe({ name: 'media' })
export class MediaPipe implements PipeTransform {
  private api = inject(ApiService);
  transform(v?: string | null): string { return this.api.media(v); }
}

/** "PlacedWithVendor" → "Placed With Vendor" */
@Pipe({ name: 'humanize' })
export class HumanizePipe implements PipeTransform {
  transform(v?: string | null): string {
    return (v ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace('Cash On Delivery', 'Cash on Delivery');
  }
}

const statusColors: Record<string, string> = {
  Pending: 'warning', Confirmed: 'info', PlacedWithVendor: 'primary', Dispatched: 'primary', OutForDelivery: 'info',
  Delivered: 'success', Cancelled: 'secondary', Returned: 'danger',
  Paid: 'success', PartiallyPaid: 'warning', Failed: 'danger', Refunded: 'secondary', PartiallyRefunded: 'warning', Unpaid: 'danger',
  Requested: 'warning', Approved: 'info', Rejected: 'secondary', Processed: 'success',
  New: 'warning', InProgress: 'info', Closed: 'success', Completed: 'success', Running: 'info',
  Draft: 'secondary', Sent: 'info', Accepted: 'primary'
};

@Pipe({ name: 'statusColor' })
export class StatusColorPipe implements PipeTransform {
  transform(v?: string | null): string { return 'badge-soft badge-soft-' + (statusColors[v ?? ''] ?? 'secondary'); }
}

/** Percentage change between two numbers. */
@Pipe({ name: 'delta' })
export class DeltaPipe implements PipeTransform {
  transform(cur: number, prev: number): number | null {
    if (!prev) return cur ? 100 : 0;
    return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  }
}

export const SHARED_PIPES = [InitialsPipe, InrPipe, MediaPipe, HumanizePipe, StatusColorPipe, DeltaPipe];

export function isoDate(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
