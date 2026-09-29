// Standard API Envelope
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// User Profile
export interface UserProfile {
  id: number;
  telegram_id: number;
  first_name: string;
  username: string;
  photo_url: string;
  level: number;
  energy: number;
  max_energy: number;
  spins: number;
  diamonds: number;
  balance_usd: number;
  ton_wallet: string; // Used for BEP-20 address (0x...)
  phone: string;
  goal_usd: number;   // Default $1.00
  goal_left: number;  // Remaining to cashout
  is_admin: boolean;  // True if user is authorized admin
  has_claimed_channel_reward?: boolean;
}

// Official Telegram Channel Status
export interface OfficialChannelStatus {
  success: boolean;
  channel_username: string;
  channel_link: string;
  reward_spins: number;
  reward_diamonds: number;
  has_claimed: boolean;
  message?: string;
}

// Auth Response
export interface AuthResponseData {
  token: string;
  user: UserProfile;
}

// Spin Wheel Result
export interface SpinReward {
  id: string;
  label: string;
  value: 'gem' | 'coins' | 'spin_ticket' | 'double_reward' | 'spin_ticket_2' | 'gem_large' | string;
  amount: string;
  image: string;
  is_double?: boolean;
  multiplier?: number;
  base_amount?: string;
  final_amount?: string;
}

export interface SpinResultData {
  targetIndex: number; // 0 to 5 matching clockwise wheel segments
  isDouble: boolean;
  reward: SpinReward;
  txId: string;
  timestamp: number;
  userBalance: {
    spins: number;
    diamonds: number;
    balance_usd: number;
    energy: number;
    goal_usd: number;
    goal_left: number;
  };
}

// Daily Rewards
export interface DailyStreakDay {
  day: number;
  reward: string;
  icon: string;
  active: boolean;
  isMega?: boolean;
}

export interface DailyRewardsStatusData {
  currentDay: number;
  canClaimToday: boolean;
  hasClaimedToday?: boolean;
  serverDate?: string;
  streakActive: boolean;
  streakBonus: string;
  days: DailyStreakDay[];
}

export interface ClaimDailyRewardData {
  claimedDay: number;
  rewardGems: number;
  txId: string;
  userBalance: {
    diamonds: number;
  };
}

// Referral Team
export interface TeamMember {
  id: string;
  name: string;
  joinedDate: string;
  joinedChannel: boolean;
}

export interface TeamStatsData {
  totalCount: number;
  activeCount: number;
  inviteUrl: string;
  shareText: string;
  currentTier: 'Bronze' | 'Silver' | 'Gold';
  tierRewards: string[];
  members: TeamMember[];
}

// Contest Leaderboard
export interface ContestLeaderboardUser {
  rank: number;
  name: string;
  avatar?: string;
  spins?: number;
  referrals?: number;
  score?: number;
  prize: string;
}

export interface ContestLeaderboardData {
  id?: string;
  title: string;
  category?: 'spins' | 'referrals';
  prizePool: string;
  endsIn: string;
  endsTimestamp?: number;
  topWinners: ContestLeaderboardUser[];
  otherRankings: ContestLeaderboardUser[];
  userStatus?: {
    rank: number;
    spins?: number;
    referrals?: number;
    score?: number;
    projectedPrize: string;
  };
}

export interface ActiveContestItem {
  id: string;
  title: string;
  prizePool: string;
  category: 'spins' | 'referrals';
  endsIn: string;
}

// Raffles
export interface RaffleCardData {
  id: string;
  cashReward: number;
  cash_prize_usd?: number;
  coinRewardStr: string;
  participants: number;
  tickets: number;
  status: 'ongoing' | 'ended';
  ticket_price_usd?: number;
  ticketPriceUsd?: number;
  ticket_price_stars?: number;
  ticketPriceStars?: number;
  ticket_gem_price?: number;
  ticketPriceGems?: number;
  max_tickets_per_user?: number;
  maxTicketsPerUser?: number;
  total_tickets_sold?: number;
  totalTicketsSold?: number;
}

export interface PrizeTier {
  medal: string;
  rank: string;
  amount: string;
  icon?: string;
  multiplier: string;
  highlight: boolean;
  reward_type?: string;
  amount_val?: number;
  winners_count?: number;
}

export interface RaffleWinnerData {
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

export interface RaffleDetailsData {
  raffle: RaffleCardData;
  userTickets: number;
  ticketPriceGems: number;
  ticketPriceUsd?: number;
  ticketPriceStars?: number;
  maxTicketsPerUser?: number;
  endsTimestamp: number;
  secondsLeft: number;
  prizeTiers: PrizeTier[];
  winners?: RaffleWinnerData[];
}

export interface BuyRaffleTicketPayload {
  ticket_count: number;
  payment_method: 'usdt' | 'stars' | 'gems';
}

export type TaskType = 'external_link' | 'invite_count' | 'spin_count' | 'level_reach' | 'telegram_channel' | 'watch_ad' | 'ad_view' | string;

export interface TaskItemData {
  id: string;
  taskType?: TaskType;
  task_type?: TaskType;
  category: 'special' | 'daily' | 'socials';
  title: string;
  icon: string;
  iconUrl?: string;
  icon_url?: string;
  isIconImage?: boolean;
  rewardGems: number;
  reward_gems?: number;
  reward_diamonds?: number;
  rewardSpins?: number;
  reward_spins?: number;
  rewardUsd?: number;
  reward_usd?: number;
  status: 'pending' | 'verifying' | 'completed' | 'claimed';
  verificationSeconds?: number;
  verification_seconds?: number;
  actionUrl?: string;
  action_url?: string;
  channelId?: string;
  channel_id?: string;
  targetCount?: number;
  target_count?: number;
  progress?: {
    current: number;
    total: number;
  };
}

export interface ReadyToClaimItemData {
  id: string;
  title: string;
  icon: string;
  rewardGems: number;
  rewardSpins?: number;
}

export interface TasksPageData {
  readyToClaim?: ReadyToClaimItemData;
  tasks: TaskItemData[];
}

// Wallet & Records
export interface TransactionRecordData {
  id: string;
  title: string;
  category: 'withdrawals' | 'spins' | 'daily' | 'team' | 'tasks' | 'gift' | 'deposit' | 'all';
  date: string;
  txId: string;
  icon: string;
  isImageIcon?: boolean;
  amount: string;
  isDiamond?: boolean;
  status: 'completed' | 'processing' | 'rejected' | 'failed';
  hash?: string;
}

export interface WalletInfoData {
  availableBalanceUsd: number;
  connected: boolean;
  tonWalletAddress: string; // BEP-20 address
  phone: string;
  presetAmounts: number[];
  gasFeePercent: number;
  recentTransactions: TransactionRecordData[];
}

export interface WithdrawResultData {
  withdrawalId: string;
  amountUsd: number;
  feeUsd: number;
  netPayoutUsd: number;
  tonAddress: string;
  status: string;
  txId: string;
  userBalance: UserProfile;
}

// Invoices & Stars
export interface CryptoInvoiceData {
  invoice_id: string;
  deposit_address: string;
  amount_usd: number;
  amount_usdt?: string;
  purpose?: string;
  status?: 'pending' | 'paid' | 'expired' | string;
  network?: string;
  expires_at?: number | string;
  qr_code_data?: string;
  raffle_id?: string;
  ticket_count?: number;
}

export interface CreateCryptoInvoicePayload {
  amount_usd: number;
  purpose: string;
  raffle_id?: string;
  ticket_count?: number;
}

export interface StarsInvoiceData {
  invoice_link: string;
  payload?: string;
  stars?: number;
}
