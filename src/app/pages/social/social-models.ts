export type SocialPlatform = 'Instagram' | 'Facebook' | 'Threads' | 'InstagramReel' | 'FacebookReel' | 'ThreadsVideo' | 'InstagramStory' | 'FacebookStory' | 'YouTubeShort';
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['Instagram', 'Facebook', 'Threads', 'InstagramReel', 'FacebookReel', 'ThreadsVideo', 'InstagramStory', 'FacebookStory', 'YouTubeShort'];
export const isStory = (p: SocialPlatform) => p === 'InstagramStory' || p === 'FacebookStory';
/** Stories are up for 24 hours. */
export const storyExpired = (publishedAt?: string) => !!publishedAt && Date.now() - new Date(publishedAt).getTime() > 24 * 3600 * 1000;
export type SocialStatus = 'Queued' | 'Publishing' | 'Published' | 'OutOfDate' | 'Failed' | 'Removed';

export interface SocialState {
  platform: SocialPlatform; enabled: boolean; postId?: number; status?: SocialStatus; scheduledAt?: string; publishedAt?: string;
  permalink?: string; lastError?: string; changes: string[]; postedCaption?: string; customCaption: boolean; stats?: SocialStats;
}
/** A live post's numbers; null = that platform doesn't give it. */
export interface SocialStats { views?: number; reach?: number; likes?: number; comments?: number; shares?: number; saves?: number; at?: string; }
export interface SocialProduct {
  productId: number; caption: string; code: string; photos: string[]; connected: boolean; publishable: boolean; platforms: SocialState[]; threadsCaption: string;
  youTubeTitle?: string; youTubeCaption?: string;
}
export interface SocialQueueResult { products: number; postingNow: number; scheduled: number; skipped: number; firstSlot?: string; note?: string; }
export interface SocialPostRow {
  id: number; productId: number; productName: string; image?: string; platform: SocialPlatform; status: SocialStatus;
  scheduledAt?: string; publishedAt?: string; permalink?: string; lastError?: string; changes: string[]; customCaption: boolean; stats?: SocialStats;
}
export interface SocialQuota { platform: SocialPlatform; used: number; limit: number; fromMeta: boolean; }
export interface SocialSummary {
  connected: boolean; instagram?: string; page?: string; threads?: string; youtube?: string; enabled: SocialPlatform[]; quota: SocialQuota; threadsQuota?: SocialQuota; facebookLast24h: number;
  nextPostAt?: string; postedProducts: number; notPosted: number; unreadComments: number; counts: Partial<Record<SocialPlatform, Partial<Record<SocialStatus, number>>>>;
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
  storiesEnabled: boolean; storyTimes: string;
  readComments: boolean; readStats: boolean;
  youTubeConnected: boolean; youTubeClientId?: string; youTubeChannel?: string; youTubeHandle?: string; youTubeConnectedAt?: string;
  youTubeEnabled: boolean; youTubeTimes: string; youTubeCallbackUrl?: string; youTubeDailyLimit: number;
}
export interface MusicTrack { name: string; size: number; }
export interface FeedStatus { enabled: boolean; url?: string; products: number; ready: number; fetchedAt?: string; fetchedBy?: string; }
export interface ReelFile { video: string; cover: string; track?: string; }

export const socialIcon = (p: SocialPlatform) =>
  ({ Instagram: 'bi-instagram', Facebook: 'bi-facebook', Threads: 'bi-threads', InstagramReel: 'bi-camera-reels', FacebookReel: 'bi-camera-reels', ThreadsVideo: 'bi-camera-reels',
    InstagramStory: 'bi-phone', FacebookStory: 'bi-phone', YouTubeShort: 'bi-youtube' })[p];

export const socialName = (p: SocialPlatform) =>
  ({ Instagram: 'Instagram', Facebook: 'Facebook', Threads: 'Threads', InstagramReel: 'Instagram Reel', FacebookReel: 'Facebook Reel', ThreadsVideo: 'Threads video',
    InstagramStory: 'Instagram Story', FacebookStory: 'Facebook Story', YouTubeShort: 'YouTube Short' })[p];

export const socialStatusLabel = (s: SocialStatus) =>
  ({ Queued: 'In queue', Publishing: 'Posting', Published: 'Posted', OutOfDate: 'Out of date', Failed: 'Failed', Removed: 'Removed' })[s];

export const socialStatusCls = (s: SocialStatus) =>
  'badge-soft badge-soft-' + ({ Queued: 'info', Publishing: 'info', Published: 'success', OutOfDate: 'warning', Failed: 'danger', Removed: 'secondary' })[s];

export interface SocialReply { id: number; author: string; text: string; postedAt: string; fromUs: boolean; auto: boolean; }
export type AutoReplyState = 'None' | 'Drafted' | 'Sent' | 'Dismissed' | 'NeedsYou';
export type AutoReplyMode = 'Off' | 'Suggest' | 'Auto';
export interface AutoReplySettings { mode: AutoReplyMode; ai: boolean; hasAiKey: boolean; aiModel: string; perHour: number; models: { id: string; name: string }[]; }
export interface CommentSuggestion { reply?: string; topic: string; source: string; complete: boolean; why?: string; }
export interface SocialComment {
  id: number; postId: number; productId: number; productName: string; image?: string; platform: SocialPlatform; permalink?: string;
  author: string; text: string; postedAt: string; unread: boolean; replies: SocialReply[]; fromUs: boolean;
  replyState: AutoReplyState; suggestedReply?: string; suggestedTopic?: string; suggestedSource?: string; suggestedComplete: boolean;
}
export interface SocialPlatformTotals { platform: SocialPlatform; posts: number; views?: number; reach?: number; likes: number; comments: number; shares?: number; saves?: number; }
export interface SocialTopPost { id: number; productId: number; productName: string; image?: string; platform: SocialPlatform; permalink?: string; publishedAt?: string; stats: SocialStats; }
export interface SocialPerformance { days: number; platforms: SocialPlatformTotals[]; top: SocialTopPost[]; issues: string[]; lastRead?: string; }

/** "1,234" / "12.3K" / "—" for numbers a platform doesn't give. */
export const statNum = (n?: number | null) =>
  n == null ? '—' : n >= 100000 ? (n / 1000).toFixed(0) + 'K' : n >= 10000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString('en-IN');

/** One line: "1.2K views · 34 likes · 5 comments · 2 shares". */
export const statLine = (s?: SocialStats | null) => !s ? '' : [
  count(s.views, 'view'), count(s.likes, 'like'), count(s.comments, 'comment'), count(s.shares, 'share'), s.saves ? count(s.saves, 'save') : null
].filter(Boolean).join(' · ');
const count = (n: number | null | undefined, word: string) => n == null ? null : `${statNum(n)} ${word}${n === 1 ? '' : 's'}`;
