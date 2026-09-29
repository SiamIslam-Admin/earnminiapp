import { emitProfileUpdate, emitFullProfile } from './profileEvents';
import type { UserProfile } from '../types/api';

/**
 * Universal Zero-Latency Balance & Profile Synchronizer
 * Parses dual-envelope payloads (userBalance, user, snake_case, camelCase)
 * and dispatches instant 0ms global updates across all app headers and components.
 */
export const syncUserBalance = (payload: any) => {
  if (!payload) return;

  // 1. Direct User object detection
  const fullUser: UserProfile | undefined =
    payload.data?.user ||
    payload.user ||
    (payload.data?.telegram_id || payload.data?.telegramId ? payload.data : undefined);

  if (fullUser && (fullUser.diamonds !== undefined || fullUser.spins !== undefined || fullUser.balance_usd !== undefined)) {
    emitFullProfile({
      ...fullUser,
      balance_usd: Number(fullUser.balance_usd ?? (fullUser as any).balanceUsd ?? 0),
      diamonds: Number(fullUser.diamonds ?? (fullUser as any).gems ?? 0),
      spins: Number(fullUser.spins ?? 0),
      energy: Number(fullUser.energy ?? 0),
      level: Number(fullUser.level ?? 1),
      is_admin: Boolean(fullUser.is_admin ?? (fullUser as any).isAdmin)
    });
    return;
  }

  // 2. Extract standardized userBalance envelope
  const rawBalance =
    payload.data?.userBalance ||
    payload.data?.user_balance ||
    payload.userBalance ||
    payload.user_balance ||
    payload.data ||
    payload;

  if (!rawBalance) return;

  const diamonds =
    rawBalance.diamonds ??
    rawBalance.gems ??
    rawBalance.user_balance_diamonds ??
    rawBalance.userBalanceDiamonds;

  const spins =
    rawBalance.spins ??
    rawBalance.tickets ??
    rawBalance.user_balance_spins ??
    rawBalance.userBalanceSpins;

  const balanceUsd =
    rawBalance.balance_usd ??
    rawBalance.balanceUsd ??
    rawBalance.usd ??
    rawBalance.cash ??
    rawBalance.user_balance_usd ??
    rawBalance.userBalanceUsd;

  const energy = rawBalance.energy ?? rawBalance.user_energy ?? rawBalance.userEnergy;
  const level = rawBalance.level ?? rawBalance.user_level ?? rawBalance.userLevel;
  const goalUsd = rawBalance.goal_usd ?? rawBalance.goalUsd;

  // Incremental rewards fallback if balance is not absolute
  const rewardDiamonds =
    payload.data?.reward_diamonds ??
    payload.data?.rewardDiamonds ??
    payload.data?.rewardGems ??
    payload.reward_diamonds ??
    payload.rewardDiamonds;

  const rewardSpins =
    payload.data?.reward_spins ??
    payload.data?.rewardSpins ??
    payload.reward_spins ??
    payload.rewardSpins;

  const rewardUsd =
    payload.data?.reward_usd ??
    payload.data?.rewardUsd ??
    payload.reward_usd ??
    payload.rewardUsd;

  if (diamonds !== undefined || spins !== undefined || balanceUsd !== undefined || energy !== undefined) {
    emitProfileUpdate({
      diamonds: diamonds !== undefined ? Number(diamonds) : undefined,
      spins: spins !== undefined ? Number(spins) : undefined,
      balance_usd: balanceUsd !== undefined ? Number(balanceUsd) : undefined,
      energy: energy !== undefined ? Number(energy) : undefined,
      level: level !== undefined ? Number(level) : undefined,
      goal_usd: goalUsd !== undefined ? Number(goalUsd) : undefined
    });
  } else if (rewardDiamonds !== undefined || rewardSpins !== undefined || rewardUsd !== undefined) {
    emitProfileUpdate({
      reward_diamonds: rewardDiamonds !== undefined ? Number(rewardDiamonds) : undefined,
      reward_spins: rewardSpins !== undefined ? Number(rewardSpins) : undefined,
      reward_usd: rewardUsd !== undefined ? Number(rewardUsd) : undefined
    });
  }
};
