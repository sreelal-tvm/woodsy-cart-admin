export type SocialPlatform = 'Instagram' | 'Facebook' | 'Threads' | 'InstagramReel' | 'FacebookReel' | 'ThreadsVideo';
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['Instagram', 'Facebook', 'Threads', 'InstagramReel', 'FacebookReel', 'ThreadsVideo'];
export type SocialStatus = 'Queued' | 'Publishing' | 'Published' | 'OutOfDate' | 'Failed' | 'Removed';

export interface SocialState {
  platform: SocialPlatform; enabled: boolean; postId?: number; status?: SocialStatus; scheduledAt?: string; publishedAt?: string;
  permalink?: string; lastError?: string; changes: string[]; postedCaption?: string; customCaption: boolean;
}
export interface SocialProduct { productId: number; caption: string; code: string; photos: string[]; connected: boolean; publishable: boolean; platforms: SocialState[]; threadsCaption: string; }
export interface SocialQueueResult { products: number; postingNow: number; scheduled: number; skipped: number; firstSlot?: string; note?: string; }
export interface SocialPostRow {
  id: number; productId: number; productName: string; image?: string; platform: SocialPlatform; status: SocialStatus;
  scheduledAt?: string; publishedAt?: string; permalink?: string; lastError?: string; changes: string[]; customCaption: boolean;
}
export interface SocialQuota { platform: SocialPlatform; used: number; limit: number; fromMeta: boolean; }
export interface SocialSummary {
  connected: boolean; instagram?: string; page?: string; threads?: string; enabled: SocialPlatform[]; quota: SocialQuota; threadsQuota?: SocialQuota; facebookLast24h: number;
  nextPostAt?: string; postedProducts: number; notPosted: number; counts: Partial<Record<SocialPlatform, Partial<Record<SocialStatus, number>>>>;
}
export interface SocialSettings {
  connected: boolean; metaAppId?: string; pageId?: string; pageName?: string; instagramUserId?: string; instagramUsername?: string; connectedAt?: string;
  instagramEnabled: boolean; facebookEnabled: boolean; template: string; customTemplate: boolean; defaultTemplate: string; tokens: string[];
  includePrice: boolean; showMrp: boolean; whatsApp?: string; city?: string; hashtags?: string; maxHashtags: number; postTimes: string;
  autoQueueNewProducts: boolean; publicPhotos: boolean;
  threadsConnected: boolean; threadsAppId?: string; threadsUsername?: string; threadsConnectedAt?: string; threadsTokenExpiresAt?: string;
  threadsEnabled: boolean; threadsTemplate: string; threadsCustomTemplate: boolean; threadsDefaultTemplate: string; threadsTopic?: string;
  threadsCallbackUrl?: string;
  reelsEnabled: boolean; reelTimes: string; reelMusic: boolean; reelsAvailable: boolean; musicTracks: MusicTrack[];
}
export interface MusicTrack { name: string; size: number; }
export interface ReelFile { video: string; cover: string; track?: string; }

export const socialIcon = (p: SocialPlatform) =>
  ({ Instagram: 'bi-instagram', Facebook: 'bi-facebook', Threads: 'bi-threads', InstagramReel: 'bi-camera-reels', FacebookReel: 'bi-camera-reels', ThreadsVideo: 'bi-camera-reels' })[p];

export const socialName = (p: SocialPlatform) =>
  ({ Instagram: 'Instagram', Facebook: 'Facebook', Threads: 'Threads', InstagramReel: 'Instagram Reel', FacebookReel: 'Facebook Reel', ThreadsVideo: 'Threads video' })[p];

export const socialStatusLabel = (s: SocialStatus) =>
  ({ Queued: 'In queue', Publishing: 'Posting', Published: 'Posted', OutOfDate: 'Out of date', Failed: 'Failed', Removed: 'Removed' })[s];

export const socialStatusCls = (s: SocialStatus) =>
  'badge-soft badge-soft-' + ({ Queued: 'info', Publishing: 'info', Published: 'success', OutOfDate: 'warning', Failed: 'danger', Removed: 'secondary' })[s];
