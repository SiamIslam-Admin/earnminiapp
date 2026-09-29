import React, { useEffect, useState } from 'react';
import { getOfficialChannelStatus, verifyOfficialChannelJoin } from '../services/dataService';
import type { UserProfile } from '../types/api';
import { throwConfetti } from '../utils/confetti';
import { haptics } from '../utils/haptics';
import { notifyToast } from '../utils/debugToast';

export interface OfficialChannelModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onClaimSuccess: (rewards: { spins: number; diamonds: number; user?: UserProfile }) => void;
  userProfile?: UserProfile;
}

export const OfficialChannelModal: React.FC<OfficialChannelModalProps> = ({
  onClose,
  onClaimSuccess
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [channelData, setChannelData] = useState({
    username: '@SpinCraftNews',
    inviteLink: 'https://t.me/SpinCraftNews',
    rewardSpins: 3,
    rewardDiamonds: 500
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Fetch live channel configuration
    const fetchStatus = async () => {
      try {
        const res = await getOfficialChannelStatus();
        if (res && res.success) {
          setChannelData({
            username: res.channel_username || '@SpinCraftNews',
            inviteLink: res.channel_link || 'https://t.me/SpinCraftNews',
            rewardSpins: Number(res.reward_spins || 3),
            rewardDiamonds: Number(res.reward_diamonds || 500)
          });
        }
      } catch (err) {
        console.warn('Failed to load official channel data:', err);
      }
    };

    fetchStatus();
  }, []);

  const handleClose = () => {
    haptics.impact('light');
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  const handleJoinClick = () => {
    haptics.impact('medium');
    const link = channelData.inviteLink || 'https://t.me/SpinCraftNews';

    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }

    setHasClickedJoin(true);
  };

  const handleVerifyClick = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    haptics.impact('medium');

    try {
      const res = await verifyOfficialChannelJoin();
      if (res.success) {
        const awardedSpins = Number(res.reward_spins ?? channelData.rewardSpins);
        const awardedDiamonds = Number(res.reward_diamonds ?? channelData.rewardDiamonds);

        haptics.notification('success');
        haptics.playWinSound();
        throwConfetti();
        notifyToast(
          `🎉 Channel Joined! Received +${awardedSpins} Free Spins & +${awardedDiamonds} Diamonds!`,
          'success',
          5000
        );

        setIsVisible(false);
        setTimeout(() => {
          onClaimSuccess({ spins: awardedSpins, diamonds: awardedDiamonds, user: res.user });
        }, 250);
      } else {
        haptics.notification('warning');
        notifyToast(res.message || 'Please join the channel first to verify!', 'error', 4000);
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(err?.message || 'Verification failed. Please try again.', 'error', 4000);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.25s ease',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      {/* Backdrop Dismiss */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0
        }}
      />

      {/* Bottom Sheet Modal Container */}
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, #065F46 0%, #064E3B 40%, #022C22 100%)',
          borderTopLeftRadius: '2rem',
          borderTopRightRadius: '2rem',
          borderTop: '1px solid rgba(52, 211, 153, 0.5)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.75rem 1.25rem 2.25rem 1.25rem',
          position: 'relative',
          boxShadow: '0 -15px 35px rgba(0, 0, 0, 0.7)',
          fontFamily: 'Outfit, sans-serif',
          zIndex: 1,
          boxSizing: 'border-box'
        }}
      >
        {/* Top Dismiss Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          ✕
        </button>

        {/* Inner Glass Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            background: 'rgba(2, 44, 34, 0.94)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '1.5rem',
            padding: '1.5rem 1.25rem',
            textAlign: 'center',
            boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
        >
          {/* Telegram Brand Icon with Glowing Circle */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #2AABEE 0%, #229ED9 70%, #0088cc 100%)',
              border: '2px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.85rem auto',
              boxShadow: '0 0 24px rgba(42, 171, 238, 0.65), inset 0 2px 4px rgba(255, 255, 255, 0.4)'
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M21.5 2.5L2.5 10.5L9.5 13.5L18.5 6.5L11.5 15.5L18.5 20.5L21.5 2.5Z"
                fill="#ffffff"
              />
              <path
                d="M9.5 13.5V18.5L12.5 15.5L9.5 13.5Z"
                fill="rgba(255, 255, 255, 0.7)"
              />
            </svg>
          </div>

          <h2
            style={{
              color: '#ffffff',
              margin: '0 0 0.35rem 0',
              fontWeight: 900,
              fontSize: '1.35rem',
              letterSpacing: '0.02em',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
            }}
          >
            Join Official Channel
          </h2>

          <p
            style={{
              color: '#6ee7b7',
              margin: '0 0 1.15rem 0',
              fontSize: '0.92rem',
              fontWeight: 700,
              lineHeight: 1.3
            }}
          >
            Get +{channelData.rewardSpins} Free Spins &amp; +{channelData.rewardDiamonds} Diamonds
          </p>

          {/* Reward Badges Showcase */}
          <div
            style={{
              display: 'flex',
              gap: '0.65rem',
              justifyContent: 'center',
              marginBottom: '1.25rem'
            }}
          >
            {/* Free Spins Badge */}
            <div
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '1rem',
                padding: '0.65rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <img
                src="./assets/ticket_animated.gif"
                alt="Spins"
                style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              />
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>
                +{channelData.rewardSpins} Spins
              </span>
            </div>

            {/* Diamonds Badge */}
            <div
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '1rem',
                padding: '0.65rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <img
                src="./assets/diamond_animated.gif"
                alt="Diamonds"
                style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              />
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>
                +{channelData.rewardDiamonds} 💎
              </span>
            </div>
          </div>

          <p
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.76rem',
              margin: '0 0 1.25rem 0',
              lineHeight: 1.4
            }}
          >
            Subscribe to <span style={{ color: '#38bdf8', fontWeight: 700 }}>{channelData.username}</span> to unlock instant free spins, exclusive giveaway drops, and jackpot announcements!
          </p>

          {/* Action Button */}
          {!hasClickedJoin ? (
            <button
              onClick={handleJoinClick}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, #00e676 0%, #00b359 100%)',
                border: 'none',
                borderRadius: '1rem',
                padding: '0.85rem',
                color: '#022C22',
                fontWeight: 900,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 230, 118, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'transform 0.1s ease'
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span>🚀</span>
              <span>Join Channel</span>
            </button>
          ) : (
            <button
              onClick={handleVerifyClick}
              disabled={isVerifying}
              style={{
                width: '100%',
                background: isVerifying
                  ? 'rgba(56, 189, 248, 0.5)'
                  : 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                border: 'none',
                borderRadius: '1rem',
                padding: '0.85rem',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1rem',
                cursor: isVerifying ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'transform 0.1s ease'
              }}
              onMouseDown={(e) => {
                if (!isVerifying) e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                if (!isVerifying) e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <span>🔍</span>
              <span>{isVerifying ? 'Verifying Membership...' : 'Verify Membership'}</span>
            </button>
          )}

          {/* Re-open channel link if already clicked */}
          {hasClickedJoin && (
            <div
              onClick={handleJoinClick}
              style={{
                marginTop: '0.85rem',
                color: '#94a3b8',
                fontSize: '0.75rem',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Didn't join yet? Click here to open channel again
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficialChannelModal;
