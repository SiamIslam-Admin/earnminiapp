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

// NOTE: Full file restore incomplete - see commit 78072995 for complete dataService.ts
// This partial push is being fixed immediately.
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

export default {
  getConfig,
  getInitialUserProfile,
  getInitialWheelSegments,
  authenticateTelegram
};
