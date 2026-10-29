import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * A list's tab, filters and page, kept for this browser tab, so Back from a product / order returns to the same list
 * (the scroll position is restored by scroll-restore.ts). Call in the constructor (while the navigation is running).
 */
export function listMemory<T extends object>(key: string) {
  const back = inject(Router).currentNavigation()?.trigger === 'popstate';
  const storageKey = 'wc_list_' + key;
  let restored = false;
  return {
    /** What the list showed last time, only when arriving with Back / Forward (once). */
    restore(): Partial<T> | null {
      if (!back || restored) return null;
      restored = true;
      try { return JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { return null; }
    },
    save(state: T) {
      try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* private mode: just not remembered */ }
    }
  };
}
