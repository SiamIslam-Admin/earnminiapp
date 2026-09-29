import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { TaskItem } from './types';
import { haptics } from '../../utils/haptics';
import { notifyToast } from '../../utils/debugToast';
import { startTask } from '../../services/dataService';

export interface TaskCardProps {
  task: TaskItem;
  isVerifying?: boolean;
  onClaim?: () => void;
  onOpenTelegramModal?: (task: TaskItem) => void;
  onVerifyTelegram?: (task: TaskItem) => void;
  onWatchAd?: (task: TaskItem) => void;
}

export const TaskCard: FC<TaskCardProps> = ({
  task,
  isVerifying = false,
  onClaim,
  onOpenTelegramModal,
  onVerifyTelegram,
  onWatchAd
}) => {
  const [isBtnPressed, setIsBtnPressed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const effectiveType = task.taskType || task.task_type || (task.channelId || task.channel_id ? 'telegram_channel' : task.category === 'socials' ? 'external_link' : 'external_link');
  const isWatchAd = effectiveType === 'watch_ad' || effectiveType === 'ad_view';
  const isMilestone = effectiveType === 'invite_count' || effectiveType === 'spin_count' || effectiveType === 'level_reach';
  const isTelegramChannel = effectiveType === 'telegram_channel';
  const isExternalLink = !isWatchAd && !isMilestone && !isTelegramChannel;

  const currentProgress = task.progress?.current ?? 0;
  const totalProgress = task.progress?.total ?? task.targetCount ?? task.target_count ?? 1;
  const isMilestoneCompleted = currentProgress >= totalProgress;
  const isCompleted = task.status === 'completed' || task.status === 'claimed';
  const isVerifyingStatus = task.status === 'verifying';

  // 15-second countdown timer for External Link tasks
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setIsUnlocked(true);
      haptics.notification('success');
      notifyToast('🎉 Timer complete! Claim your reward now.', 'success', 3000);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleAction = async () => {
    if (isVerifying || isCompleted) return;

    haptics.impact('medium');
    haptics.playClickSound();

    if (task.onAction) {
      task.onAction();
      return;
    }

    // Type 4: Watch Rewarded Ad
    if (isWatchAd) {
      if (onWatchAd) {
        onWatchAd(task);
      } else if (onClaim) {
        onClaim();
      }
      return;
    }

    // Type 3: 2-Step Telegram Channel
    if (isTelegramChannel) {
      if (isVerifyingStatus) {
        // Step 2: User returns and taps Check/Verify
        if (onVerifyTelegram) {
          onVerifyTelegram(task);
        } else if (onClaim) {
          onClaim();
        }
      } else {
        // Step 1: Open interactive Join Modal
        if (onOpenTelegramModal) {
          onOpenTelegramModal(task);
        }
      }
      return;
    }

    // Type 2: In-App Milestone
    if (isMilestone) {
      if (isMilestoneCompleted) {
        if (onClaim) onClaim();
      } else {
        notifyToast(`In Progress: ${currentProgress}/${totalProgress}. Keep going!`, 'info', 2500);
      }
      return;
    }

    // Type 1: External Link (15s Countdown)
    if (isExternalLink) {
      if (isUnlocked) {
        // Claim after countdown
        if (onClaim) onClaim();
      } else if (countdown === null) {
        // First click: start task, open link, begin 15s countdown
        try {
          startTask(task.id);
        } catch {}

        const targetUrl = task.actionUrl || task.action_url;
        if (targetUrl) {
          const tg = (window as any)?.Telegram?.WebApp;
          if (targetUrl.startsWith('https://t.me/') && tg && typeof tg.openTelegramLink === 'function') {
            tg.openTelegramLink(targetUrl);
          } else if (tg && typeof tg.openLink === 'function') {
            tg.openLink(targetUrl);
          } else {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          }
        }

        const waitSeconds = task.verificationSeconds || task.verification_seconds || 15;
        setCountdown(waitSeconds);
        notifyToast(`Link opened! Wait ${waitSeconds}s to unlock claim.`, 'info', 3500);
      }
    }
  };

  const getButtonContent = () => {
    if (isVerifying) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Verifying...
        </span>
      );
    }
    if (isCompleted) return 'Done ✓';

    if (isWatchAd) {
      return '🎬 Watch Ad & Claim';
    }

    if (isTelegramChannel) {
      if (isVerifyingStatus) {
        return 'Check / Verify 🔍';
      }
      return 'Join Channel 📢';
    }

    if (isMilestone) {
      if (isMilestoneCompleted) {
        return 'Claim Reward 🎁';
      }
      return `🔒 ${currentProgress}/${totalProgress}`;
    }

    if (isExternalLink) {
      if (isUnlocked) {
        return 'Claim Reward 🎁';
      }
      if (countdown !== null) {
        return `Verifying (${countdown}s)...`;
      }
      return task.buttonText || 'Open Link ↗';
    }

    return 'Start';
  };

  const isBtnGlowing = (!isCompleted && !isVerifying) && (
    isWatchAd ||
    (isMilestone && isMilestoneCompleted) ||
    (isExternalLink && isUnlocked) ||
    (isTelegramChannel && isVerifyingStatus)
  );

  const isBtnDisabled = isVerifying || isCompleted || (isMilestone && !isMilestoneCompleted) || (isExternalLink && countdown !== null);

  const rewardDiamonds = task.rewardGems ?? task.reward_gems ?? task.reward_diamonds ?? 100;
  const rewardSpins = task.rewardSpins ?? task.reward_spins ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 0.85rem',
        background: isCompleted
          ? 'linear-gradient(135deg, rgba(5, 75, 45, 0.35) 0%, rgba(2, 40, 25, 0.5) 100%)'
          : 'linear-gradient(135deg, rgba(5, 105, 65, 0.55) 0%, rgba(2, 52, 34, 0.85) 100%)',
        borderRadius: '0.95rem',
        border: isCompleted
          ? '1px solid rgba(0, 230, 118, 0.2)'
          : isBtnGlowing
          ? '1px solid rgba(250, 204, 21, 0.7)'
          : '1px solid rgba(0, 230, 118, 0.4)',
        boxShadow: isBtnGlowing
          ? '0 0 16px rgba(250, 204, 21, 0.3), 0 4px 12px rgba(0, 0, 0, 0.35)'
          : '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        color: 'white',
        gap: '0.75rem',
        fontFamily: 'Outfit, sans-serif',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: isCompleted ? 0.75 : 1,
        transition: 'transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      {/* Left Icon Thumbnail */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '11px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)'
        }}
      >
        {typeof task.icon === 'string' &&
        (task.icon.endsWith('.png') || task.icon.endsWith('.jpg') || task.icon.endsWith('.svg') || task.icon.endsWith('.gif') || task.icon.endsWith('.webp') || task.icon.includes('/') || task.isIconImage || task.iconUrl) ? (
          <img
            src={task.iconUrl || (task.icon as string)}
            alt="Task Icon"
            style={{
              width: typeof task.icon === 'string' && task.icon.endsWith('.gif') ? '28px' : '26px',
              height: typeof task.icon === 'string' && task.icon.endsWith('.gif') ? '28px' : '26px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        ) : (
          <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{task.icon || (isTelegramChannel ? '📢' : isMilestone ? '🎯' : '🔗')}</span>
        )}
      </div>

      {/* Middle: Title, Rewards & Progress Bar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {/* Title */}
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.86rem',
            color: '#ffffff',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {task.title}
        </div>

        {/* Dual Reward Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Diamonds Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              color: '#fde047',
              fontSize: '0.74rem',
              fontWeight: 800
            }}
          >
            <img
              src="./assets/diamond_animated.gif"
              alt="Diamond"
              style={{ width: '20px', height: '20px', objectFit: 'contain' }}
            />
            <span>+{rewardDiamonds}</span>
          </div>

          {/* Spins Badge */}
          {rewardSpins > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                color: '#67e8f9',
                fontSize: '0.74rem',
                fontWeight: 800
              }}
            >
              <img
                src="./assets/ticket_animated.gif"
                alt="Spins"
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              />
              <span>+{rewardSpins} Spin{rewardSpins > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Type 2 Visual Progress Bar for Milestone Quests */}
        {isMilestone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
            <div
              style={{
                flex: 1,
                maxWidth: '120px',
                height: '6px',
                background: 'rgba(0, 0, 0, 0.45)',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.round((currentProgress / totalProgress) * 100))}%`,
                  height: '100%',
                  background: isMilestoneCompleted
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #facc15, #eab308)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <span style={{ fontSize: '0.68rem', color: isMilestoneCompleted ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
              {currentProgress}/{totalProgress}
            </span>
          </div>
        )}
      </div>

      {/* Right: Sleek Interactive Action Button */}
      {!task.hideButton && (
        <button
          onClick={handleAction}
          onMouseDown={() => !isBtnDisabled && setIsBtnPressed(true)}
          onMouseUp={() => setIsBtnPressed(false)}
          onMouseLeave={() => setIsBtnPressed(false)}
          onTouchStart={() => !isBtnDisabled && setIsBtnPressed(true)}
          onTouchEnd={() => setIsBtnPressed(false)}
          disabled={isBtnDisabled}
          style={{
            background: isVerifying
              ? 'rgba(255, 255, 255, 0.15)'
              : isCompleted
              ? 'rgba(16, 185, 129, 0.25)'
              : isBtnGlowing
              ? 'linear-gradient(180deg, #00e676 0%, #00a854 100%)'
              : countdown !== null
              ? 'rgba(234, 179, 8, 0.25)'
              : isMilestone && !isMilestoneCompleted
              ? 'rgba(255, 255, 255, 0.08)'
              : isTelegramChannel
              ? 'linear-gradient(180deg, #0088cc 0%, #006699 100%)'
              : 'linear-gradient(180deg, #facc15 0%, #eab308 60%, #ca8a04 100%)',
            color: isCompleted
              ? '#6ee7b7'
              : isBtnGlowing || isTelegramChannel
              ? '#ffffff'
              : countdown !== null
              ? '#fde047'
              : isMilestone && !isMilestoneCompleted
              ? '#94a3b8'
              : '#1e293b',
            border: isCompleted
              ? '1px solid rgba(52, 211, 153, 0.4)'
              : isBtnGlowing
              ? '1px solid rgba(167, 243, 208, 0.9)'
              : countdown !== null
              ? '1px solid rgba(234, 179, 8, 0.5)'
              : isMilestone && !isMilestoneCompleted
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : isTelegramChannel
              ? '1px solid rgba(56, 189, 248, 0.6)'
              : '1px solid rgba(254, 240, 138, 0.8)',
            borderRadius: '0.7rem',
            padding: '0.4rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: isBtnDisabled ? 'default' : 'pointer',
            boxShadow: isBtnPressed
              ? '0 1px 0 rgba(0,0,0,0.5), inset 0 1px 2px rgba(0,0,0,0.3)'
              : isBtnGlowing
              ? '0 3px 0 #007038, 0 4px 10px rgba(0, 230, 118, 0.4)'
              : isTelegramChannel
              ? '0 2.5px 0 #004466, 0 3px 8px rgba(0, 136, 204, 0.35)'
              : isMilestone && !isMilestoneCompleted
              ? 'none'
              : '0 2.5px 0 #854d0e, 0 3px 6px rgba(0,0,0,0.25)',
            transform: isBtnPressed ? 'translateY(2px)' : 'translateY(0)',
            transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.15s ease',
            flexShrink: 0,
            minWidth: '78px',
            textAlign: 'center'
          }}
        >
          {getButtonContent()}
        </button>
      )}
    </div>
  );
};
