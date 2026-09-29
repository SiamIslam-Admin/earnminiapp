// ============================================================================
// IN-APP ADMIN PANEL TYPES & DATA MODELS
// ============================================================================

export interface AdminAuthResponse {
  token: string;
  expires_in?: number;
  message?: string;
}

export interface TrafficMetrics {
  live_rps?: number;
  liveRps?: number;
  live_rpm?: number;
  liveRpm?: number;
  hour_requests?: number;
  hourRequests?: number;
  today_requests?: number;
  todayRequests?: number;
  month_requests?: number;
  monthRequests?: number;
  daily_active_users?: number;
  dailyActiveUsers?: number;
  monthly_active_users?: number;
  monthlyActiveUsers?: number;
  peak_rps?: number;
  peakRps?: number;
}

// 1. Overview & Master Vault Status
export interface AdminOverviewMetrics {
  total_deposits_usd: number;
  total_withdrawals_usd: number;
  gross_volume_usd: number;
  active_users_dau: number;
  active_users_mau?: number;
  total_registered_users: number;
  pending_withdrawals_count: number;
  total_spins_today: number;
  conversion_rate_percent: number;
  traffic?: TrafficMetrics;
}

export interface MasterVaultStatus {
  is_initialized: boolean;
  master_address: string;
  network: string; // "BSC (BEP-20)"
  bnb_gas_balance: number;
  bnb_gas_status: 'healthy' | 'low' | 'critical';
  usdt_reserve_balance: number;
  last_swept_at?: string;
}

export interface VaultGeneratedSecrets {
  master_address: string;
  seed_phrase?: string;
  private_key: string;
  network?: string;
}

export interface VaultImportPayload {
  seed_phrase?: string;
  private_key?: string;
}

// 2. Contests & Tournaments
export interface ContestPrizeLadderEntry {
  rank_from: number;
  rank_to: number;
  prize_usd: number;
  badge?: string;
}

export interface AdminContest {
  id: number;
  title: string;
  category: 'spins' | 'referrals';
  prize_pool_usd: number;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'scheduled' | 'ended' | 'distributed';
  total_participants: number;
  prize_ladder: ContestPrizeLadderEntry[];
  top_winner_id?: number;
  top_winner_name?: string;
}

// 3. Raffles & Lotteries
export interface RafflePrizeTierConfig {
  rank: string;
  medal: string;
  reward_type: 'usd' | 'diamonds';
  amount: number;
  amount_str?: string;
  icon?: string;
  multiplier?: string;
  winners_count: number;
  highlight?: boolean;
}

export interface AdminRaffleWinner {
  tier_rank: string;
  user_id: number;
  telegram_id?: number;
  name: string;
  username?: string;
  prize: string;
  reward_type: string;
  amount: number;
  won_at?: string;
}

export interface AdminRaffle {
  id: number | string;
  title: string;
  cash_prize_usd: number;
  ticket_gem_price: number;
  ticket_price_usd?: number;
  ticket_price_stars?: number;
  max_tickets_per_user?: number;
  enable_usd_payment?: boolean;
  enable_stars_payment?: boolean;
  enable_gems_payment?: boolean;
  total_tickets_sold: number;
  total_participants: number;
  ends_at: string;
  status: 'active' | 'ongoing' | 'ended' | 'drawn' | 'cancelled';
  winner_telegram_id?: number;
  winner_username?: string;
  winner_tx_id?: string;
  prize_tiers?: RafflePrizeTierConfig[];
  prizeTiers?: RafflePrizeTierConfig[];
  winners?: AdminRaffleWinner[];
}

export interface CreateRafflePayload {
  title: string;
  cash_prize_usd: number;
  ticket_gem_price?: number;
  ticket_price_usd?: number;
  ticket_price_stars?: number;
  max_tickets_per_user?: number;
  enable_usd_payment?: boolean;
  enable_stars_payment?: boolean;
  enable_gems_payment?: boolean;
  ends_at: string;
  prize_tiers?: RafflePrizeTierConfig[];
}

// 4. Tasks & Connected Chats
export type AdminTaskType = 'external_link' | 'invite_count' | 'spin_count' | 'level_reach' | 'telegram_channel' | 'watch_ad' | 'ad_view';

export interface AdminTask {
  id: number;
  title: string;
  task_type?: AdminTaskType;
  category: 'daily' | 'social' | 'partner' | 'special';
  icon: string;
  icon_url?: string;
  reward_type?: 'diamonds' | 'spins' | 'usd';
  reward_amount?: number;
  reward_diamonds?: number;
  reward_spins?: number;
  reward_usd?: number;
  target_count?: number;
  action_url: string;
  telegram_chat_id?: string;
  channel_id?: string;
  is_active: boolean;
  order_index?: number;
  completion_count?: number;
}

export interface CreateAdminTaskPayload {
  title: string;
  task_type: AdminTaskType;
  category: 'daily' | 'social' | 'partner' | 'special';
  icon?: string;
  icon_url?: string;
  reward_diamonds: number;
  reward_spins: number;
  reward_usd?: number;
  target_count?: number;
  action_url?: string;
  telegram_chat_id?: string;
  channel_id?: string;
  is_active?: boolean;
}

export interface ConnectedTelegramChat {
  id: number;
  chat_id: string;
  title: string;
  username: string;
  is_bot_admin: boolean;
  linked_tasks_count: number;
}

// 5. User Management
export interface AdminUserListItem {
  id: number;
  telegram_id: number;
  username: string;
  first_name: string;
  balance_usd: number;
  diamonds: number;
  spins: number;
  energy: number;
  level: number;
  is_banned: boolean;
  is_admin: boolean;
  created_at: string;
  last_active_at: string;
  ton_wallet?: string;
}

export interface BalanceAdjustPayload {
  user_id: number;
  adjustment_type: 'diamonds' | 'spins' | 'balance_usd';
  amount: number; // positive to credit, negative to debit
  audit_reason: string;
}

// 6. Withdrawals Cashout Queue & Payout Settings
export interface PayoutSettings {
  payout_mode: 'manual' | 'instant';
  min_withdrawal_usd?: number;
  fee_percent?: number;
}

export interface AdminWithdrawalItem {
  id: number;
  user_id: number;
  telegram_id: number;
  username: string;
  first_name?: string;
  phone?: string;
  amount_usd: number;
  fee_usd: number;
  net_amount_usd: number;
  destination_address: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  tx_hash?: string;
  reject_reason?: string;
  notes?: string;
}

// 7. Promo Gift Codes & Vouchers
export interface AdminGiftCode {
  id: number;
  code: string;
  batch_id?: string;
  batch_name?: string;
  reward_diamonds: number;
  reward_spins: number;
  reward_usd: number;
  max_claims: number;
  claims_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminGiftCodeClaimer {
  id: number;
  user_id: number;
  telegram_id: number;
  username: string;
  first_name?: string;
  claimed_at: string;
  diamonds_received: number;
  spins_received: number;
  usd_received: number;
}

export interface AdminGiftCodeBatch {
  batch_id: string;
  batch_name: string;
  prefix: string;
  total_codes: number;
  claimed_codes: number;
  unclaimed_codes: number;
  reward_diamonds: number;
  reward_spins: number;
  reward_usd: number;
  expires_at?: string;
  created_at: string;
}

export interface CreateCustomGiftCodePayload {
  code: string;
  reward_diamonds: number;
  reward_spins: number;
  reward_usd: number;
  max_claims: number;
  expires_in_days?: number;
}

export interface BulkGenerateVouchersPayload {
  batch_name: string;
  quantity: number;
  prefix: string;
  reward_diamonds: number;
  reward_spins: number;
  reward_usd: number;
  expires_in_days?: number;
}

// 8. Invoices & Sweep Auditor
export interface AdminFailedTransaction {
  id: number;
  user_id: number;
  telegram_id: number;
  username: string;
  deposit_address: string;
  usdt_detected: number;
  bnb_gas_needed: number;
  status: 'unfunded_gas' | 'sweep_failed' | 'stuck_pending';
  last_attempt_at: string;
  error_message?: string;
}

// 9. Support Feedback Inbox
export interface AdminSupportFeedback {
  id: number;
  user_id: number;
  telegram_id: number;
  username: string;
  email?: string;
  category: 'bug' | 'deposit' | 'withdrawal' | 'spin' | 'general';
  message: string;
  screenshot_url?: string;
  created_at: string;
  is_resolved: boolean;
  resolved_at?: string;
  admin_notes?: string;
}

// 10. Master Wallet Status
export interface AdminWalletStatus {
  isInitialized?: boolean;
  is_initialized?: boolean;
  masterAddress?: string;
  master_address?: string;
  bnbBalance?: number;
  bnb_balance?: number;
  usdtBalance?: number;
  usdt_balance?: number;
  network?: string;
  lowBnbGasWarning?: boolean;
  low_bnb_gas_warning?: boolean;
  isPayoutReady?: boolean;
  is_payout_ready?: boolean;
}

// 11. Wheel of Fortune Probability Control
export interface AdminWheelItem {
  index: number;
  value: string;
  label: string;
  weight: number;
  percent?: number;
  rewardAmount?: string;
  reward_amount?: string;
}

export interface AdminWheelSettingsData {
  items: AdminWheelItem[];
  totalWeight?: number;
  total_weight?: number;
  diamondReward?: number;
  diamond_reward?: number;
  megaDiamondReward?: number;
  mega_diamond_reward?: number;
  minCashReward?: number;
  min_cash_reward?: number;
  maxCashReward?: number;
  max_cash_reward?: number;
}

export interface UpdateWheelSettingsPayload {
  weight_diamonds: number;
  weight_cash: number;
  weight_spin_ticket: number;
  weight_double_reward: number;
  weight_spin_ticket_2: number;
  weight_gem_large: number;
  diamond_reward: number;
  mega_diamond_reward: number;
  min_cash_reward: number;
  max_cash_reward: number;
}

// 12. Daily Streak Rewards
export interface AdminDailyStreakDay {
  day: number;
  reward_gems: number;
  reward_spins: number;
  reward_usd: number;
  label?: string;
  icon?: string;
  is_mega?: boolean;
}

export interface AdminDailyStreakSettingsPayload {
  days: AdminDailyStreakDay[];
}

// 13. Referral Multi-Asset Rewards
export interface AdminReferralRewardSettings {
  initial_organic_spins?: number;
  initialOrganicSpins?: number;
  referrer_spins: number;
  referrer_diamonds: number;
  referrer_usd: number;
  welcome_spins: number;
  welcome_diamonds: number;
  welcome_usd: number;
}

// 14. Deep User Lookup
export interface UserLookupTransaction {
  id: string | number;
  type: string;
  category?: string;
  amount_usd?: number;
  amount_diamonds?: number;
  amount_spins?: number;
  amount?: string | number;
  status: 'completed' | 'processing' | 'rejected' | 'failed';
  tx_hash?: string;
  txHash?: string;
  created_at: string;
  createdAt?: string;
  description?: string;
}

export interface AdminUserLookupData {
  user: AdminUserListItem;
  stats: {
    total_deposits_count: number;
    total_deposits_usd: number;
    total_cashouts_count: number;
    total_cashouts_usd: number;
    total_referrals_count: number;
    net_profit_usd: number;
  };
  recent_transactions: UserLookupTransaction[];
}

// 15. Sub-Admin RBAC
export interface AdminSubAdmin {
  id: number;
  telegram_id: number;
  username?: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubAdminPayload {
  telegram_id: number;
  username?: string;
  role: string;
  permissions: string[];
}

export interface UpdateSubAdminPayload {
  role?: string;
  permissions?: string[];
  is_active?: boolean;
}

// 16. Broadcast Campaigns
export interface AdminBroadcastButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface AdminBroadcastJob {
  id: number;
  target_audience: string;
  message_text: string;
  media_url?: string;
  media_type?: string;
  buttons?: AdminBroadcastButton[][];
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  total_users: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string;
}

export interface CreateBroadcastJobPayload {
  target_audience: string;
  message_text: string;
  media_url?: string;
  media_type?: string;
  buttons?: AdminBroadcastButton[][];
}

export interface PreviewBroadcastPayload {
  target_audience?: string;
  message_text: string;
  media_url?: string;
  media_type?: string;
  buttons?: AdminBroadcastButton[][];
}

// 17. Master HD Vault On-Chain Fund Transfer
export interface AdminVaultTransferPayload {
  asset: 'usdt' | 'bnb';
  recipient_address: string;
  amount: number;
  notes?: string;
}

export interface AdminVaultTransferResponse {
  tx_hash: string;
  asset: string;
  amount: number;
  recipient_address: string;
  explorer_url: string;
  transferred_at: string;
}

// 18. Official Telegram Channel Gatekeeper & System Settings
export interface OfficialChannelGatekeeperSettings {
  official_channel_username: string;
  official_channel_link: string;
  official_channel_reward_spins: number;
  official_channel_reward_diamonds: number;
}


