import type { FC } from 'react';
import type { TaskItem } from './types';
import { haptics } from '../../utils/haptics';

export interface TelegramJoinModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmJoin: (task: TaskItem) => void;
}

export const TelegramJoinModal: FC<TelegramJoinModalProps> = ({
  task,
  isOpen,
  onClose,
  onConfirmJoin
}) => {
  if (!isOpen || !task) return null;

  const channelHandle = task.channelId || task.channel_id || (task.actionUrl?.includes('t.me/') ? task.actionUrl.split('t.me/')[1] : '@Community');
  const rewardDiamonds = task.rewardGems ?? task.reward_gems ?? task.reward_diamonds ?? 500;
  const rewardSpins = task.rewardSpins ?? task.reward_spins ?? 0;

  const handleJoinClick = () => {
    haptics.impact('heavy');
    onConfirmJoin(task);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease forwards'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #0f1f17 0%, #06130d 100%)',
          border: '1px solid rgba(0, 230, 118, 0.4)',
          borderRadius: '1.25rem',
          padding: '1.5rem',
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 230, 118, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
          position: 'relative',
          fontFamily: 'Outfit, sans-serif'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.85rem',
            right: '0.85rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#94a3b8',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            fontWeight: 800
          }}
        >
          ✕
        </button>

        {/* Telegram Big Animated Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #0088cc 0%, #005f8f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 8px 20px rgba(0, 136, 204, 0.4)',
            marginTop: '0.5rem'
          }}
        >
          ✈️
        </div>

        {/* Modal Title & Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Join Telegram Channel
          </h3>
          <p style={{ margin: 0, color: '#a7f3d0', fontSize: '0.86rem', lineHeight: 1.4 }}>
            Subscribe to <b>{channelHandle.startsWith('@') ? channelHandle : `@${channelHandle}`}</b> to unlock massive bonuses!
          </p>
        </div>

        {/* Rewards Showcase Card */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(0, 230, 118, 0.25)',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}
        >
          {/* Diamond Reward */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <img src="./assets/diamond_animated.gif" alt="Diamonds" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Diamonds</span>
              <span style={{ fontSize: '1rem', color: '#fde047', fontWeight: 900 }}>+{rewardDiamonds}</span>
            </div>
          </div>

          {rewardSpins > 0 && (
            <>
              <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.12)' }} />
              {/* Spins Reward */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <img src="./assets/ticket_animated.gif" alt="Spins" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>Free Spins</span>
                  <span style={{ fontSize: '1rem', color: '#67e8f9', fontWeight: 900 }}>+{rewardSpins}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 2-Step Instruction Notice */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.04)', padding: '0.5rem 0.75rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
          💡 <b>Step 1:</b> Tap Join Channel below ➔ <b>Step 2:</b> Return to app and tap <b>Check / Verify 🔍</b> to claim.
        </div>

        {/* Action Button */}
        <button
          onClick={handleJoinClick}
          style={{
            width: '100%',
            background: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
            color: '#042211',
            border: 'none',
            borderRadius: '0.85rem',
            padding: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0, 230, 118, 0.4), 0 2px 0 #007038',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            transition: 'transform 0.1s ease'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span>Join Channel 🚀</span>
        </button>
      </div>
    </div>
  );
};
