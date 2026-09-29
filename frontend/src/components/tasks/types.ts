import type { ReactNode } from 'react';
import type { TaskType } from '../../types/api';

export type { TaskType };

export interface TaskItem {
  id: string;
  taskType?: TaskType;
  task_type?: TaskType;
  title: string;
  category?: 'daily' | 'special' | 'socials';
  icon?: string | ReactNode;
  iconUrl?: string;
  icon_url?: string;
  isIconImage?: boolean;
  rewardGems?: number;
  reward_gems?: number;
  reward_diamonds?: number;
  rewardSpins?: number;
  reward_spins?: number;
  rewardUsd?: number;
  reward_usd?: number;
  secondaryRewardGems?: number;
  progress?: { current: number; total: number };
  targetCount?: number;
  target_count?: number;
  status?: 'pending' | 'verifying' | 'checking' | 'completed' | 'claimed' | 'ready';
  verificationSeconds?: number;
  verification_seconds?: number;
  actionUrl?: string;
  action_url?: string;
  channelId?: string;
  channel_id?: string;
  isPlaceholder?: boolean;
  onAction?: () => void;
  hideButton?: boolean;
  buttonText?: string;
}

export interface ReadyToClaimItem {
  id: string;
  title: string;
  icon: string;
  rewardGems: number;
  rewardSpins?: number;
  onClaim?: () => void;
}
