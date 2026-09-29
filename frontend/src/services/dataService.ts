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

// PLACEHOLDER_FULL_FILE_TOO_LARGE - use git restore
export default {};
