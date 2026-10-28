import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

/** New social media comments: the count next to "Social media" in the menu and on the Comments tab. */
@Injectable({ providedIn: 'root' })
export class SocialBadge {
  private api = inject(ApiService);
  readonly unread = signal(0);

  refresh() {
    this.api.get<{ count: number }>('admin/social/comments/unread').subscribe({ next: r => this.unread.set(r.count), error: () => {} });
  }
}
