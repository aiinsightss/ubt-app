// Minimal hand-written mirror of the Supabase schema (migration 0001).
// Replace later with `supabase gen types typescript` output.

export type UserRole = "creator" | "advertiser" | "admin";
export type Platform = "tiktok" | "instagram" | "youtube";
export type VerticalityTier = "white" | "grey" | "black";
export type PayoutType = "cpm" | "cpa" | "hybrid";
export type PayoutMode = "flat" | "tiered";
export type OfferStatus = "draft" | "active" | "paused" | "ended";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "paid";
export type ConversionStatus = "pending" | "approved" | "rejected";
export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "earning"
  | "spending"
  | "refund";
export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type EventType =
  | "click"
  | "registration"
  | "first_deposit"
  | "deposit"
  | "conversion_approved"
  | "conversion_rejected";

export interface Profile {
  id: string;
  role: UserRole | null;
  nickname: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  xp: number;
  level: number;
  total_views: number;
  total_clicks: number;
  total_registrations: number;
  total_first_deposits: number;
  total_deposits_sum: string; // numeric comes back as string
  total_earned: string;
  total_spent: string;
  avg_cpm_earned: string;
  best_epc: string;
  company_name: string | null;
  telegram_username: string | null;
  telegram_user_id: number | null;
  telegram_verified: boolean;
  leaderboard_visible: boolean;
  onboarded_at: string | null;
  banned: boolean;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Columns visible through the `public_profiles` view.
export type PublicProfile = Pick<
  Profile,
  | "id"
  | "role"
  | "nickname"
  | "avatar_url"
  | "bio"
  | "xp"
  | "level"
  | "total_views"
  | "total_clicks"
  | "total_registrations"
  | "total_first_deposits"
  | "total_deposits_sum"
  | "total_earned"
  | "avg_cpm_earned"
  | "best_epc"
  | "leaderboard_visible"
  | "created_at"
>;

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: Platform;
  username: string;
  verified: boolean;
  verification_code: string | null;
  verification_expires_at: string | null;
  followers: number;
  total_views: number;
  total_likes: number;
  last_synced_at: string | null;
  created_at: string;
}

export interface OfferPayoutTier {
  id: string;
  offer_id: string;
  tier_level: number;
  min_views_threshold: number;
  cpm_rate: string;
  cpa_rate: string;
  created_at: string;
}

export interface Offer {
  id: string;
  advertiser_id: string;
  title: string;
  description: string | null;
  vertical: string;
  verticality_tier: VerticalityTier;
  payout_type: PayoutType;
  payout_mode: PayoutMode;
  cpm_rate: string;
  cpa_rate: string;
  budget_total: string;
  budget_spent: string;
  geo: string[];
  rules: string | null;
  mandatory_points: unknown;
  cpa_link_template: string | null;
  status: OfferStatus;
  deadline: string | null;
  total_views: number;
  total_submissions: number;
  total_clicks: number;
  total_registrations: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  creator_id: string;
  offer_id: string;
  social_account_id: string | null;
  video_url: string;
  platform: Platform;
  external_video_id: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  registrations: number;
  first_deposits: number;
  total_deposits_count: number;
  total_deposits_sum: string;
  earnings_cpm: string;
  earnings_cpa: string;
  current_tier_level: number | null;
  status: SubmissionStatus;
  rejection_reason: string | null;
  subaccount_token: string;
  last_synced_at: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface SubmissionEvent {
  id: string;
  submission_id: string;
  event_type: EventType;
  amount: string | null;
  external_user_id: string | null;
  raw_payload: unknown;
  created_at: string;
}

export interface Conversion {
  id: string;
  submission_id: string;
  external_transaction_id: string | null;
  amount: string;
  status: ConversionStatus;
  created_at: string;
  approved_at: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string;
  currency: string;
  crypto_tx_hash: string | null;
  status: TransactionStatus;
  related_submission_id: string | null;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface LevelConfig {
  role: UserRole;
  level: number;
  title: string;
  min_xp: number;
  perks: unknown;
  avatar_stage: string | null;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  condition: unknown;
  role: UserRole | null;
  created_at: string;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface LeaderboardCreatorRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  total_views: number;
  total_earned: string;
  avg_cpm_earned: string;
}

export interface LeaderboardAdvertiserRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
  company_name: string | null;
  level: number;
  total_spent: string;
}

export interface LeaderboardOfferRow {
  id: string;
  title: string;
  vertical: string;
  verticality_tier: VerticalityTier;
  cpm_rate: string;
  cpa_rate: string;
  total_views: number;
  total_submissions: number;
  advertiser_nickname: string;
  advertiser_avatar: string | null;
}
