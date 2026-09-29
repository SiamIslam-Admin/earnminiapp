import appConfig from '../config.json';
import mockData from '../data.json';
import api from '../api/client';
import { emitProfileUpdate, emitFullProfile } from '../utils/profileEvents';
import { syncUserBalance } from '../utils/syncUser';
import type { SpinSegment } from '../components/SpinWheel';
import type {
  UserProfile,
  AuthResponseData,
  SpinResultData,
  DailyRewardsStatusData,
  ClaimDailyRewardData,
  TeamStatsData,
  ContestLeaderboardData,
  TasksPageData,
  WalletInfoData,
  WithdrawResultData,
  TransactionRecordData,
  RaffleCardData,
  RaffleDetailsData,
  StarsInvoiceData
} from '../types/api';

export interface AppConfig {
  useMockData: boolean;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  simulatedDelayMs: number;
  enableTelegramVerification: boolean;
}

export const getConfig = (): AppConfig => {
  return appConfig as AppConfig;
};

// 0. Initial State Getters (Only returns mock if useMockData is enabled in config.json)
export const getInitialUserProfile = (): UserProfile => {
  if (appConfig.useMockData) {
    return mockData.userProfile as unknown as UserProfile;
  }
  return {
    id: 0,
    telegram_id: 0,
    username: '',
    first_name: 'Connecting...',
    photo_url: '',
    balance_usd: 0.0,
    spins: 0,
    diamonds: 0,
    energy: 0,
    max_energy: 100,
    level: 1,
    goal_usd: 1.0,
    goal_left: 1.0,
    ton_wallet: '',
    phone: '',
    is_admin: false
  };
};

export const getInitialWheelSegments = (): SpinSegment[] => {
  return mockData.wheelSegments as SpinSegment[];
};

export const getInitialDailyRewards = (): DailyRewardsStatusData | null => {
  if (appConfig.useMockData) {
    return mockData.dailyRewards as unknown as DailyRewardsStatusData;
  }
  return null;
};

export const getInitialTeamData = (): TeamStatsData | null => {
  if (appConfig.useMockData) {
    return mockData.teamData as unknown as TeamStatsData;
  }
  return null;
};

export const getInitialContestData = (): ContestLeaderboardData | null => {
  if (appConfig.useMockData) {
    return mockData.contests as unknown as ContestLeaderboardData;
  }
  return null;
};

export const getInitialTasksPageData = (): TasksPageData | null => {
  if (appConfig.useMockData) {
    return mockData.tasksPage as unknown as TasksPageData;
  }
  return null;
};

export const getInitialWalletData = (): WalletInfoData | null => {
  if (appConfig.useMockData) {
    return mockData.walletPage as unknown as WalletInfoData;
  }
  return null;
};

export const getInitialRafflesData = (): {
  ongoing: RaffleCardData[];
  ended: RaffleCardData[];
  prizeTiers: any[];
} | null => {
  if (appConfig.useMockData) {
    return mockData.rafflesPage as unknown as {
      ongoing: RaffleCardData[];
      ended: RaffleCardData[];
      prizeTiers: any[];
    };
  }
  return null;
};

export const getInitialMockTasksBanner = () => {
  return mockData.mockTasksBanner;
};

export const getInitialFeatureCards = () => {
  return mockData.featureCards;
};

// 1. Telegram Authentication (POST /auth/telegram)
export const authenticateTelegram = async (
  initData?: string,
  startParam?: string
): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> => {
  if (appConfig.useMockData) {
    return {
      success: true,
      user: mockData.userProfile as unknown as UserProfile,
      token: 'mock_jwt_token_12345'
    };
  }

  const res = await api.post<AuthResponseData>('/auth/telegram', {
    init_data: initData || '',
    start_param: startParam || ''
  });

  if (res.success && res.data) {
    if (res.data.token) {
      api.setToken(res.data.token);
    }
    const user = res.data.user;
    if (user) {
      user.is_admin = Boolean(user.is_admin ?? (user as any).isAdmin);
    }
    return {
      success: true,
      user,
      token: res.data.token
    };
  }

  return {
    success: false,
    error: res.error || res.message || 'Telegram authentication failed on server.'
  };
};

// 2. User Profile (GET /user/profile)
export const fetchUserProfile = async (): Promise<UserProfile | null> => {
  if (appConfig.useMockData) {
    const user = mockData.userProfile as unknown as UserProfile;
    emitFullProfile(user);
    return user;
  }

  const res = await api.get<UserProfile>('/user/profile');
  if (res.success && res.data) {
    const profile = res.data;
    profile.is_admin = Boolean(profile.is_admin ?? (profile as any).isAdmin);
    emitFullProfile(profile);
    return profile;
  }

  return null;
};

// 3. Server-Authoritative Spin Execution (POST /spin)
export const performServerSpin = async (method?: 'spins' | 'diamonds' | 'auto'): Promise<SpinResultData> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 200));
    const segments = mockData.wheelSegments;
    const randomIdx = Math.floor(Math.random() * segments.length);
    const chosen = segments[randomIdx];
    const mockBalance = {
      spins: 11,
      diamonds: 204,
      balance_usd: 0.76,
      energy: 50,
      goal_usd: 1.0,
      goal_left: 0.24
    };
    emitProfileUpdate({
      spins: mockBalance.spins,
      diamonds: mockBalance.diamonds,
      balance_usd: mockBalance.balance_usd,
      energy: mockBalance.energy
    });
    return {
      targetIndex: randomIdx,
      isDouble: false,
      reward: {
        id: `rew-${Date.now()}`,
        label: chosen.label,
        value: chosen.value,
        amount: chosen.value === 'jackpot' ? '$10.00' : chosen.value === 'coins' ? '$0.20' : '+80 💎',
        image: chosen.image
      },
      txId: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: Date.now(),
      userBalance: mockBalance
    };
  }

  const res = await api.post<SpinResultData>('/spin', {
    method: method || 'auto'
  });
  if (res.success && res.data) {
    if (res.data.userBalance) {
      const ub = res.data.userBalance;
      emitProfileUpdate({
        spins: ub.spins,
        diamonds: ub.diamonds,
        balance_usd: ub.balance_usd,
        energy: ub.energy
      });
    }
    return res.data;
  }

  throw new Error(res.error || res.message || 'Server spin request failed');
};

// 4. Daily Rewards (Session-Cached per app opening)
let cachedDailyRewards: DailyRewardsStatusData | null = null;

export const getCachedDailyRewards = (): DailyRewardsStatusData | null => {
  if (cachedDailyRewards) return cachedDailyRewards;
  if (typeof window !== 'undefined') {
    try {
      const saved = sessionStorage.getItem('cached_daily_rewards');
      if (saved) {
        cachedDailyRewards = JSON.parse(saved);
        return cachedDailyRewards;
      }
    } catch {}
  }
  return null;
};

export const setCachedDailyRewards = (data: DailyRewardsStatusData) => {
  cachedDailyRewards = data;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('cached_daily_rewards', JSON.stringify(data));
    } catch {}
  }
};

export const fetchDailyRewardsData = async (forceRefresh: boolean = false): Promise<DailyRewardsStatusData | null> => {
  if (appConfig.useMockData) {
    return mockData.dailyRewards as unknown as DailyRewardsStatusData;
  }

  if (!forceRefresh) {
    const cached = getCachedDailyRewards();
    if (cached) return cached;
  }

  const res = await api.get<any>('/daily-rewards');
  if (res.success && res.data) {
    const raw = res.data;
    const rawDays = raw.days || [];

    const normalized: DailyRewardsStatusData = {
      currentDay: raw.currentDay ?? raw.current_day ?? 1,
      canClaimToday: raw.canClaimToday ?? raw.can_claim_today ?? false,
      hasClaimedToday: raw.hasClaimedToday ?? raw.has_claimed_today ?? !(raw.canClaimToday ?? raw.can_claim_today ?? false),
      serverDate: raw.serverDate || raw.server_date || new Date().toISOString().slice(0, 10),
      streakActive: raw.streakActive ?? raw.streak_active ?? false,
      streakBonus: raw.streakBonus || raw.streak_bonus || 'Day Streak',
      days: rawDays.map((d: any, idx: number) => ({
        day: d.day || idx + 1,
        reward: d.reward || '+80',
        icon: d.icon || (idx === 2 || idx === 6 ? './assets/giftIconInDailySignIn.png' : './assets/diamond_animated.gif'),
        active: d.active ?? false,
        isMega: d.isMega ?? d.is_mega ?? (idx === 6)
      }))
    };

    setCachedDailyRewards(normalized);
    return normalized;
  }

  return null;
};

export const claimDailyReward = async (isDouble?: boolean): Promise<{ success: boolean; message?: string; data?: ClaimDailyRewardData }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 300));
    const baseGems = 80;
    const gems = isDouble ? baseGems * 2 : baseGems;
    return {
      success: true,
      message: `Claimed daily reward +${gems} Diamonds!`,
      data: {
        claimedDay: 1,
        rewardGems: gems,
        txId: `TX-${Date.now()}`,
        userBalance: { diamonds: 204 + gems }
      }
    };
  }

  const res = await api.post<ClaimDailyRewardData>('/daily-rewards/claim', { is_double: !!isDouble, isDouble: !!isDouble });
  if (res.success) {
    syncUserBalance(res.data || res);
    const cached = getCachedDailyRewards();
    if (cached) {
      setCachedDailyRewards({
        ...cached,
        canClaimToday: false
      });
    }
  }

  return {
    success: res.success,
    message: res.message || (res.success ? 'Claimed daily reward!' : res.error),
    data: res.data
  };
};

// 5. Referral Team (GET /team)
export const fetchTeamData = async (): Promise<TeamStatsData | null> => {
  if (appConfig.useMockData) {
    return mockData.teamData as unknown as TeamStatsData;
  }

  const res = await api.get<any>('/team');
  if (res.success && res.data) {
    const raw = res.data;
    const members = (raw.members || []).map((m: any, idx: number) => ({
      id: String(m.id || m.user_id || idx + 1),
      name: m.name || m.first_name || m.username || 'Member',
      joinedDate: m.joinedDate || m.joined_date || m.created_at || 'Recently',
      joinedChannel: m.joinedChannel ?? m.joined_channel ?? true
    }));

    const userTgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '';
    const fallbackInviteUrl = userTgId ? `https://t.me/SpinCraft_bot/earnnow?startapp=ref_${userTgId}` : 'https://t.me/SpinCraft_bot/earnnow?startapp=ref_user';

    return {
      totalCount: raw.totalCount ?? raw.total_count ?? raw.totalFriends ?? members.length,
      activeCount: raw.activeCount ?? raw.active_count ?? members.filter((m: any) => m.joinedChannel).length,
      inviteUrl: raw.inviteUrl || raw.invite_url || fallbackInviteUrl,
      shareText: raw.shareText || raw.share_text || 'Join me on Spin Craft and spin the wheel for massive cash rewards! 🎰💰',
      currentTier: raw.currentTier || raw.current_tier || 'Bronze',
      tierRewards: raw.tierRewards || raw.tier_rewards || ['Bronze: 1 Spin/friend', 'Silver: 2 Spins + 5%', 'Gold: 3 Spins + 10%'],
      members
    };
  }

  return null;
};

// 6. Contests / Tournaments (GET /contests/spins & GET /contests/referrals)
export const fetchContestData = async (type: 'spins' | 'referrals' = 'spins'): Promise<ContestLeaderboardData | null> => {
  if (appConfig.useMockData) {
    if (type === 'referrals') {
      return {
        title: 'Referral Champions Tournament',
        category: 'referrals',
        prizePool: '$750.00 USDT',
        endsIn: '3d 08h 12m 30s',
        endsTimestamp: Date.now() + 86400000 * 3,
        topWinners: [
          { rank: 1, name: 'Elena_Vip', avatar: '👑', referrals: 48, prize: '$300 USDT' },
          { rank: 2, name: 'CryptoKing', avatar: '🥈', referrals: 35, prize: '$175 USDT' },
          { rank: 3, name: 'TonMiner', avatar: '🥉', referrals: 22, prize: '$100 USDT' }
        ],
        otherRankings: [
          { rank: 4, name: 'ReferralPro', avatar: '⚡', referrals: 19, prize: '$50 USDT' },
          { rank: 5, name: 'EarnMaster', avatar: '🌟', referrals: 14, prize: '$35 USDT' }
        ],
        userStatus: {
          rank: 12,
          referrals: 5,
          score: 5,
          projectedPrize: '$10.00'
        }
      } as unknown as ContestLeaderboardData;
    }
    return mockData.contests as unknown as ContestLeaderboardData;
  }

  // 1. Try standard /contests/:type
  let res = await api.get<ContestLeaderboardData>(`/contests/${type}`);
  if (!res.success) {
    // 2. Try singular /contest/:type
    res = await api.get<ContestLeaderboardData>(`/contest/${type}`);
  }
  if (!res.success) {
    // 3. Try query param /contests?type=:type
    res = await api.get<ContestLeaderboardData>(`/contests?type=${type}`);
  }

  if (res.success && res.data) {
    return res.data;
  }

  return null;
};

// 7. Tasks (GET /tasks & POST /tasks/:id/claim)
export const fetchTasksPageData = async (): Promise<TasksPageData | null> => {
  if (appConfig.useMockData) {
    return mockData.tasksPage as unknown as TasksPageData;
  }

  const res = await api.get<TasksPageData>('/tasks');
  if (res.success && res.data) {
    return res.data;
  }

  return null;
};

export interface ClaimTaskResult {
  success: boolean;
  message?: string;
  user?: UserProfile;
  reward_diamonds?: number;
  reward_spins?: number;
  reward_usd?: number;
}

export const startTask = async (
  taskId: string
): Promise<{ success: boolean; message?: string; verification_seconds?: number }> => {
  if (appConfig.useMockData) {
    return { success: true, verification_seconds: 15 };
  }
  const res = await api.post<any>(`/tasks/${taskId}/start`);
  return {
    success: res.success,
    message: res.message || res.error,
    verification_seconds: res.data?.verification_seconds ?? 15
  };
};

export const verifyTask = async (
  taskId: string
): Promise<ClaimTaskResult> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 400));
    return {
      success: true,
      message: 'Channel membership verified! 🎉',
      reward_diamonds: 500,
      reward_spins: 2
    };
  }
  const res = await api.post<any>(`/tasks/${taskId}/verify`);
  if (res.success) {
    syncUserBalance(res.data || res);
  }
  const raw = res.data || {};
  return {
    success: res.success,
    message: res.message || (res.success ? 'Task verified!' : res.error),
    user: raw.user || (raw.id ? raw : undefined),
    reward_diamonds: raw.reward_diamonds ?? raw.diamonds ?? (raw.reward_type === 'diamonds' ? raw.reward_amount : undefined),
    reward_spins: raw.reward_spins ?? raw.spins ?? (raw.reward_type === 'spins' ? raw.reward_amount : undefined),
    reward_usd: raw.reward_usd ?? raw.usd ?? (raw.reward_type === 'usd' ? raw.reward_amount : undefined)
  };
};

export const claimTaskReward = async (
  taskId: string
): Promise<ClaimTaskResult> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 350));
    return {
      success: true,
      message: 'Task reward claimed successfully! 💎',
      reward_diamonds: 100
    };
  }

  const res = await api.post<any>(`/tasks/${taskId}/claim`);
  if (res.success) {
    syncUserBalance(res.data || res);
  }
  const raw = res.data || {};
  return {
    success: res.success,
    message: res.message || (res.success ? 'Task reward claimed!' : res.error),
    user: raw.user || (raw.id ? raw : undefined),
    reward_diamonds: raw.reward_diamonds ?? raw.diamonds ?? (raw.reward_type === 'diamonds' ? raw.reward_amount : undefined),
    reward_spins: raw.reward_spins ?? raw.spins ?? (raw.reward_type === 'spins' ? raw.reward_amount : undefined),
    reward_usd: raw.reward_usd ?? raw.usd ?? (raw.reward_type === 'usd' ? raw.reward_amount : undefined)
  };
};

// 8. Wallet & Withdrawals (GET /wallet, POST /wallet/bind, POST /wallet/withdraw)
export const fetchWalletData = async (): Promise<WalletInfoData | null> => {
  if (appConfig.useMockData) {
    return mockData.walletPage as unknown as WalletInfoData;
  }

  const res = await api.get<WalletInfoData>('/wallet');
  if (res.success && res.data) {
    return res.data;
  }

  return null;
};

export const bindWallet = async (
  address: string,
  phone?: string
): Promise<{ success: boolean; message?: string }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 300));
    return { success: true, message: 'Wallet bound successfully!' };
  }

  const res = await api.post('/wallet/bind', { address, phone: phone || '' });
  return {
    success: res.success,
    message: res.message || (res.success ? 'Wallet address saved!' : res.error)
  };
};

export const submitWithdrawal = async (
  amountUsd: number
): Promise<{ success: boolean; message?: string; data?: WithdrawResultData }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 450));
    const fee = amountUsd * 0.02;
    return {
      success: true,
      message: `Withdrawal of $${amountUsd.toFixed(2)} submitted successfully!`,
      data: {
        withdrawalId: `WTH-${Date.now()}`,
        amountUsd,
        feeUsd: fee,
        netPayoutUsd: amountUsd - fee,
        tonAddress: mockData.walletPage.tonWalletAddress,
        status: 'processing',
        txId: `TX-${Date.now()}`,
        userBalance: mockData.userProfile as unknown as UserProfile
      }
    };
  }

  const res = await api.post<WithdrawResultData>('/wallet/withdraw', {
    amount_usd: amountUsd
  });
  if (res.success) {
    syncUserBalance(res.data || res);
  }
  return {
    success: res.success,
    message: res.message || (res.success ? 'Withdrawal submitted!' : res.error),
    data: res.data
  };
};

// 9. Wallet Records (GET /wallet/records)
export const fetchWalletRecords = async (
  type: string = 'all',
  page: number = 1,
  limit: number = 20
): Promise<TransactionRecordData[] | null> => {
  if (appConfig.useMockData) {
    return mockData.walletPage.recentTransactions as unknown as TransactionRecordData[];
  }

  const res = await api.get<TransactionRecordData[]>('/wallet/records', { type, page, limit });
  if (res.success && res.data) {
    return res.data;
  }

  return null;
};

// 10. Gift Code Redemption (POST /gift-codes/claim or /gift-codes/redeem)
export interface GiftCodeRedeemResult {
  success: boolean;
  message?: string;
  diamonds?: number;
  spins?: number;
  balance_usd?: number;
  rewardGems?: number;
  user?: UserProfile;
}

export const redeemGiftCode = async (
  code: string
): Promise<GiftCodeRedeemResult> => {
  const trimmed = code.trim();
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 400));
    if (trimmed.toUpperCase() === 'WELCOME2026' || trimmed.length > 3) {
      const mockRes = {
        success: true,
        message: 'Gift code redeemed successfully! 🎉',
        diamonds: 500,
        spins: 10,
        balance_usd: 0.50,
        rewardGems: 500
      };
      emitProfileUpdate({
        reward_diamonds: 500,
        reward_spins: 10,
        reward_usd: 0.50
      });
      return mockRes;
    }
    return { success: false, message: 'Invalid or expired gift code.' };
  }

  // Try /gift-codes/claim first, fallback to /gift-codes/redeem
  let res = await api.post<any>('/gift-codes/claim', { code: trimmed });
  if (!res.success && (res.error?.includes('404') || (res as any)?.status === 404)) {
    res = await api.post<any>('/gift-codes/redeem', { code: trimmed });
  }

  const raw = res.data || {};
  const diamonds = raw.reward_diamonds ?? raw.diamonds ?? raw.rewardGems ?? raw.gems ?? (raw.reward_type === 'diamonds' ? raw.reward_amount : 0) ?? 0;
  const spins = raw.reward_spins ?? raw.spins ?? raw.tickets ?? (raw.reward_type === 'spins' ? raw.reward_amount : 0) ?? 0;
  const balance_usd = raw.reward_usd ?? raw.balance_usd ?? raw.usd ?? raw.cash ?? (raw.reward_type === 'usd' ? raw.reward_amount : 0) ?? 0;

  const result: GiftCodeRedeemResult = {
    success: res.success,
    message: res.message || (res.success ? 'Gift code redeemed successfully! 🎉' : res.error),
    diamonds,
    spins,
    balance_usd,
    rewardGems: diamonds,
    user: raw.user
  };

  if (res.success) {
    if (raw.user) {
      emitFullProfile(raw.user);
    } else if (raw.user_balance_diamonds !== undefined || raw.user_balance_usd !== undefined || raw.user_balance_spins !== undefined) {
      emitProfileUpdate({
        diamonds: raw.user_balance_diamonds,
        spins: raw.user_balance_spins,
        balance_usd: raw.user_balance_usd
      });
    } else {
      emitProfileUpdate({
        reward_diamonds: diamonds,
        reward_spins: spins,
        reward_usd: balance_usd
      });
    }

    // Trigger immediate background sync of full profile from database
    setTimeout(() => {
      fetchUserProfile().catch(() => {});
    }, 400);
  }

  return result;
};

// 11. Support & Feedback (POST /support/feedback)
export const submitFeedback = async (
  formData: FormData | { email: string; category: string; description: string }
): Promise<{ success: boolean; message?: string }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 400));
    return { success: true, message: 'Feedback submitted successfully! Our team will review it.' };
  }

  const res = await api.post('/support/feedback', formData);
  return {
    success: res.success,
    message: res.message || (res.success ? 'Support ticket submitted!' : res.error)
  };
};

// 12. Raffles & Lotteries (GET /raffles, GET /raffles/:id, POST /raffles/:id/claim, POST /telegram/stars/invoice)
export const fetchRafflesData = async (): Promise<{
  ongoing: RaffleCardData[];
  ended: RaffleCardData[];
  prizeTiers: any[];
} | null> => {
  if (appConfig.useMockData) {
    return mockData.rafflesPage as unknown as {
      ongoing: RaffleCardData[];
      ended: RaffleCardData[];
      prizeTiers: any[];
    };
  }

  const res = await api.get<RaffleCardData[]>('/raffles');
  if (res.success && res.data) {
    const ongoing = res.data.filter((r: RaffleCardData) => r.status === 'ongoing');
    const ended = res.data.filter((r: RaffleCardData) => r.status === 'ended');
    return {
      ongoing,
      ended,
      prizeTiers: []
    };
  }

  return null;
};

export const fetchRaffleDetails = async (raffleId: string): Promise<RaffleDetailsData | null> => {
  if (appConfig.useMockData) {
    return {
      raffle: (mockData.rafflesPage.ongoing[0] as unknown as RaffleCardData) || null,
      userTickets: 2,
      ticketPriceGems: 100,
      endsTimestamp: Date.now() + 86400000 * 2,
      secondsLeft: 45,
      prizeTiers: mockData.rafflesPage.prizeTiers
    };
  }

  const encodedId = encodeURIComponent(raffleId);
  let res = await api.get<any>(`/raffles/${encodedId}`);
  if (!res.success) {
    res = await api.get<any>(`/raffle/${encodedId}`);
  }

  if (res.success && res.data) {
    const raw = res.data;
    const rawRaffle = raw.raffle || (raw.id ? raw : null);
    const userTickets = raw.user_tickets ?? raw.userTickets ?? rawRaffle?.tickets ?? 0;
    const prizeTiers = raw.prize_tiers ?? raw.prizeTiers ?? [];
    const secondsLeft = raw.seconds_left ?? raw.secondsLeft ?? 45;
    const winners = raw.winners || raw.winners_json || [];

    return {
      raffle: rawRaffle,
      userTickets,
      ticketPriceGems: raw.ticket_price_gems ?? raw.ticketPriceGems ?? rawRaffle?.ticket_gem_price ?? 0,
      endsTimestamp: raw.ends_timestamp ?? raw.endsTimestamp ?? (Date.now() + 86400000),
      secondsLeft,
      prizeTiers,
      winners
    };
  }

  return null;
};

export const claimRaffleTicket = async (
  raffleId: string,
  method: 'gems' | 'vip' = 'gems'
): Promise<{ success: boolean; message?: string }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 300));
    return { success: true, message: 'Ticket claimed successfully! 🎟️' };
  }

  const encodedId = encodeURIComponent(raffleId);
  const res = await api.post(`/raffles/${encodedId}/claim`, { method });
  if (res.success) {
    syncUserBalance(res.data || res);
  }
  return {
    success: res.success,
    message: res.message || (res.success ? 'Ticket claimed!' : res.error)
  };
};

export const buyRaffleTickets = async (
  raffleId: string,
  ticketCount: number,
  paymentMethod: 'usdt' | 'stars' | 'gems'
): Promise<{ success: boolean; message?: string; data?: any; userBalance?: any }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 350));
    return {
      success: true,
      message: `Purchased ${ticketCount} ticket(s) via ${paymentMethod.toUpperCase()}! 🎟️`
    };
  }

  const encodedId = encodeURIComponent(raffleId);
  let res = await api.post<any>(`/raffles/${encodedId}/buy`, {
    ticket_count: ticketCount,
    payment_method: paymentMethod
  });

  if (!res.success && (res.error?.includes('404') || (res as any)?.status === 404)) {
    res = await api.post<any>(`/raffles/${encodedId}/claim`, {
      method: paymentMethod,
      ticket_count: ticketCount
    });
  }

  if (res.success) {
    syncUserBalance(res.data || res);
  }

  return {
    success: res.success,
    message: res.message || (res.success ? `Purchased ${ticketCount} ticket(s)! 🎟️` : res.error),
    data: res.data,
    userBalance: res.data?.userBalance || res.data?.user
  };
};

export const createRaffleStarsInvoice = async (
  raffleId: string,
  ticketCount: number
): Promise<{ success: boolean; invoiceLink?: string; message?: string; totalStars?: number }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 300));
    return {
      success: true,
      invoiceLink: 'https://t.me/$invoice_mock_link',
      totalStars: ticketCount * 25
    };
  }

  const encodedId = encodeURIComponent(raffleId);
  let res = await api.post<any>(`/raffles/${encodedId}/stars-invoice`, {
    ticket_count: ticketCount
  });

  if (!res.success && (res.error?.includes('404') || (res as any)?.status === 404)) {
    res = await api.post<any>('/telegram/stars/invoice', {
      stars_count: ticketCount * 25,
      purpose: 'raffle_tickets',
      raffle_id: raffleId
    });
  }

  const raw = res.data || {};
  const link = raw.invoice_link || raw.invoiceLink || raw.url;

  return {
    success: res.success,
    invoiceLink: link,
    totalStars: raw.total_stars ?? raw.totalStars ?? (ticketCount * 25),
    message: res.message || res.error
  };
};

export const createCryptoInvoice = async (
  amountUsd: number,
  purpose: string = 'raffle_tickets',
  raffleId?: string,
  ticketCount?: number
): Promise<{ success: boolean; data?: any; message?: string }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 350));
    const mockInvoice = {
      invoice_id: `INV-MOCK-${Date.now()}`,
      deposit_address: '0x58c679f291079d3E01a6132712217c4618e7E1d2',
      amount_usd: amountUsd,
      network: 'BNB Smart Chain (BEP-20)',
      expires_at: Date.now() + 15 * 60 * 1000
    };
    try {
      localStorage.setItem('active_crypto_invoice', JSON.stringify({
        invoiceId: mockInvoice.invoice_id,
        invoice_id: mockInvoice.invoice_id,
        deposit_address: mockInvoice.deposit_address,
        amount_usd: amountUsd,
        purpose,
        raffle_id: raffleId,
        ticket_count: ticketCount,
        expiresAt: mockInvoice.expires_at
      }));
    } catch {}
    return {
      success: true,
      data: mockInvoice
    };
  }

  const res = await api.post<any>('/invoices/crypto', {
    amount_usd: amountUsd,
    purpose,
    raffle_id: raffleId,
    ticket_count: ticketCount
  });

  const invoiceData = res.data?.data || res.data;
  if (res.success && invoiceData) {
    try {
      localStorage.setItem('active_crypto_invoice', JSON.stringify({
        invoiceId: invoiceData.invoice_id || invoiceData.id,
        invoice_id: invoiceData.invoice_id || invoiceData.id,
        deposit_address: invoiceData.deposit_address || invoiceData.address,
        amount_usd: amountUsd,
        purpose,
        raffle_id: raffleId,
        ticket_count: ticketCount,
        expiresAt: typeof invoiceData.expires_at === 'number'
          ? invoiceData.expires_at
          : Date.now() + 15 * 60 * 1000
      }));
    } catch {}
  }

  return {
    success: res.success,
    data: invoiceData,
    message: res.message || res.error
  };
};

export const createCryptoDepositInvoice = createCryptoInvoice;

export const getInvoiceStatus = async (invoiceId: string): Promise<any> => {
  if (appConfig.useMockData) {
    return { success: true, status: 'pending' };
  }

  const encodedId = encodeURIComponent(invoiceId);
  let res = await api.get<any>(`/invoices/${encodedId}/status`);
  if (!res.success) {
    res = await api.get<any>(`/invoices/crypto/${encodedId}`);
  }
  if (!res.success) {
    res = await api.get<any>(`/invoices/${encodedId}`);
  }

  const raw = res.data?.data || res.data || {};
  const status = raw.status || (res.success ? 'pending' : 'failed');

  if (status === 'paid' || status === 'completed') {
    try {
      localStorage.removeItem('active_crypto_invoice');
    } catch {}
    if (raw.userBalance || raw.user) {
      syncUserBalance(raw);
    }
  }

  return {
    success: res.success,
    status,
    ...raw
  };
};

export const checkCryptoInvoiceStatus = getInvoiceStatus;

export const createTelegramStarsInvoice = async (
  starsCount: number,
  raffleId?: string
): Promise<{ success: boolean; invoiceLink?: string; message?: string }> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 300));
    return {
      success: true,
      invoiceLink: 'https://t.me/$invoice_mock_link'
    };
  }

  const res = await api.post<StarsInvoiceData>('/telegram/stars/invoice', {
    stars_count: starsCount,
    purpose: 'raffle_tickets',
    raffle_id: raffleId || ''
  });

  return {
    success: res.success,
    invoiceLink: res.data?.invoice_link,
    message: res.message || res.error
  };
};

// 13. Official Telegram Channel Gatekeeper (GET /user/official-channel/status & POST /user/official-channel/verify)
export interface OfficialChannelStatusResult {
  success: boolean;
  channel_username: string;
  channel_link: string;
  reward_spins: number;
  reward_diamonds: number;
  has_claimed: boolean;
  message?: string;
}

export const getOfficialChannelStatus = async (): Promise<OfficialChannelStatusResult> => {
  if (appConfig.useMockData) {
    return {
      success: true,
      channel_username: '@SpinCraftNews',
      channel_link: 'https://t.me/SpinCraftNews',
      reward_spins: 3,
      reward_diamonds: 500,
      has_claimed: false
    };
  }

  try {
    const res = await api.get<any>('/user/official-channel/status');
    if (res.success && res.data) {
      return {
        success: true,
        channel_username: res.data.channel_username || res.data.channelUsername || '@SpinCraftNews',
        channel_link: res.data.channel_link || res.data.channelLink || 'https://t.me/SpinCraftNews',
        reward_spins: Number(res.data.reward_spins ?? res.data.rewardSpins ?? 3),
        reward_diamonds: Number(res.data.reward_diamonds ?? res.data.rewardDiamonds ?? 500),
        has_claimed: Boolean(res.data.has_claimed ?? res.data.hasClaimed ?? false)
      };
    }
  } catch (err) {
    console.warn('Failed to fetch official channel status from backend:', err);
  }

  return {
    success: true,
    channel_username: '@SpinCraftNews',
    channel_link: 'https://t.me/SpinCraftNews',
    reward_spins: 3,
    reward_diamonds: 500,
    has_claimed: false
  };
};

export const verifyOfficialChannelJoin = async (): Promise<{
  success: boolean;
  message?: string;
  reward_spins?: number;
  reward_diamonds?: number;
  user?: UserProfile;
}> => {
  if (appConfig.useMockData) {
    await new Promise((res) => setTimeout(res, 450));
    return {
      success: true,
      message: 'Official Channel membership verified! 🎉',
      reward_spins: 3,
      reward_diamonds: 500
    };
  }

  const res = await api.post<any>('/user/official-channel/verify');
  if (res.success) {
    syncUserBalance(res.data || res);
  }
  const raw = res.data || {};
  return {
    success: res.success,
    message: res.message || (res.success ? 'Official Channel membership verified! 🎉' : (res.error || 'Verification failed')),
    reward_spins: Number(raw.reward_spins ?? raw.rewardSpins ?? raw.spins ?? 3),
    reward_diamonds: Number(raw.reward_diamonds ?? raw.rewardDiamonds ?? raw.diamonds ?? 500),
    user: raw.user || (raw.id ? raw : undefined)
  };
};


export default {
  getConfig,
  getInitialUserProfile,
  getInitialWheelSegments,
  getInitialDailyRewards,
  getInitialTeamData,
  getInitialContestData,
  getInitialTasksPageData,
  getInitialWalletData,
  getInitialRafflesData,
  getInitialMockTasksBanner,
  getInitialFeatureCards,
  authenticateTelegram,
  fetchUserProfile,
  performServerSpin,
  fetchDailyRewardsData,
  claimDailyReward,
  fetchTeamData,
  fetchContestData,
  fetchTasksPageData,
  claimTaskReward,
  fetchWalletData,
  bindWallet,
  submitWithdrawal,
  fetchWalletRecords,
  redeemGiftCode,
  submitFeedback,
  fetchRafflesData,
  fetchRaffleDetails,
  claimRaffleTicket,
  createTelegramStarsInvoice,
  getOfficialChannelStatus,
  verifyOfficialChannelJoin
};

