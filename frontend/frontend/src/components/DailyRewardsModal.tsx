import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { haptics } from '../utils/haptics';
import { throwConfetti } from '../utils/confetti';
import { notifyToast } from '../utils/debugToast';
import {
  getCachedDailyRewards,
  fetchDailyRewardsData,
  claimDailyReward
} from '../services/dataService';
import { showRewardedAd, fetchAdsConfig } from '../services/adController';
import type { DailyRewardsStatusData } from '../types/api';

export interface DailyRewardsModalProps {
  onClose: () => void;
  onClaimSuccess?: (rewardGems: number) => void;
}

export const DailyRewardsModal: FC<DailyRewardsModalProps> = ({ onClose, onClaimSuccess }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [dailyData, setDailyData] = useState<DailyRewardsStatusData | null>(() => getCachedDailyRewards());
  const [loading, setLoading] = useState(() => dailyData === null);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(false);

  const loadData = (force: boolean = false) => {
    if (!force && dailyData) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchDailyRewardsData(force)
      .then((data) => {
        if (data) {
          setDailyData(data);
        } else {
          setError('Failed to load daily rewards from server.');
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load daily rewards.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    fetchAdsConfig().then((cfg) => {
      setAdsEnabled(cfg.adsgram_enabled);
    });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    haptics.impact('light');
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const currentDay = dailyData?.currentDay || 1;
  const canClaimToday = dailyData?.canClaimToday ?? false;
  const days = dailyData?.days || [];

  const handleClaim = async () => {
    if (!canClaimToday || isClaiming) return;

    setIsClaiming(true);
    haptics.notification('success');
    haptics.playWinSound();
    throwConfetti();

    // Optimistically update local claim state
    setDailyData((prev) => (prev ? { ...prev, canClaimToday: false } : null));

    try {
      const res = await claimDailyReward(false);
      if (res.success) {
        const rawData = res.data as any;
        const gemsWon = rawData?.rewardGems ?? rawData?.reward_diamonds ?? rawData?.reward_gems ?? 80;
        const spinsWon = rawData?.rewardSpins ?? rawData?.reward_spins ?? 0;
        const usdWon = rawData?.rewardUSD ?? rawData?.reward_usd ?? rawData?.rewardUsd ?? 0;

        onClaimSuccess?.(gemsWon);

        const rewardsList: string[] = [];
        if (gemsWon > 0) rewardsList.push(`+${gemsWon} 💎`);
        if (spinsWon > 0) rewardsList.push(`+${spinsWon} Spin${spinsWon > 1 ? 's' : ''}`);
        if (usdWon > 0) rewardsList.push(`+$${Number(usdWon).toFixed(2)}`);
        const summary = rewardsList.length > 0 ? rewardsList.join(', ') : `+${gemsWon} 💎`;

        notifyToast(`🎁 Claimed Day ${currentDay} Reward (${summary})!`, 'success', 3500);
      } else {
        notifyToast(`🔴 ${res.message || 'Failed to claim reward'}`, 'error', 4000);
      }
    } catch (err: any) {
      notifyToast(`🔴 ${err?.message || 'Failed to claim daily reward.'}`, 'error', 4000);
    }

    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  const handleDoubleClaim = async () => {
    if (!canClaimToday || isClaiming) return;

    setIsClaiming(true);
    haptics.impact('heavy');

    const adResult = await showRewardedAd();
    if (!adResult.success) {
      setIsClaiming(false);
      notifyToast(`⚠️ ${adResult.error || 'Please finish watching the full ad to double your reward!'}`, 'info', 4000);
      return;
    }

    haptics.notification('success');
    haptics.playWinSound();
    throwConfetti();

    setDailyData((prev) => (prev ? { ...prev, canClaimToday: false } : null));

    try {
      const res = await claimDailyReward(true);
      if (res.success) {
        const rawData = res.data as any;
        const gemsWon = rawData?.rewardGems ?? rawData?.reward_diamonds ?? rawData?.reward_gems ?? 160;
        const spinsWon = rawData?.rewardSpins ?? rawData?.reward_spins ?? 0;
        const usdWon = rawData?.rewardUSD ?? rawData?.reward_usd ?? rawData?.rewardUsd ?? 0;

        onClaimSuccess?.(gemsWon);

        const rewardsList: string[] = [];
        if (gemsWon > 0) rewardsList.push(`+${gemsWon} 💎`);
        if (spinsWon > 0) rewardsList.push(`+${spinsWon} Spin${spinsWon > 1 ? 's' : ''}`);
        if (usdWon > 0) rewardsList.push(`+$${Number(usdWon).toFixed(2)}`);
        const summary = rewardsList.length > 0 ? rewardsList.join(', ') : `+${gemsWon} 💎`;

        notifyToast(`🎉 2x DOUBLE REWARD (${summary})!`, 'success', 4000);
      } else {
        notifyToast(`🔴 ${res.message || 'Failed to claim double reward'}`, 'error', 4000);
      }
    } catch (err: any) {
      notifyToast(`🔴 ${err?.message || 'Failed to claim double reward.'}`, 'error', 4000);
    }

    setTimeout(() => {
      handleClose();
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }}
    >
      {/* Dark overlay backdrop click */}
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

      {/* Outer Bottom Sheet Container */}
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, #057a44 0%, #012a18 100%)',
          borderTopLeftRadius: '2rem',
          borderTopRightRadius: '2rem',
          borderTop: '1px solid rgba(0, 230, 118, 0.55)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.75rem 1.25rem 2.25rem 1.25rem',
          position: 'relative',
          boxShadow: '0 -15px 35px rgba(0,0,0,0.6)',
          fontFamily: 'Outfit, sans-serif',
          zIndex: 1,
          boxSizing: 'border-box'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          ✕
        </button>

        {/* Inner Binder Card with Dark Emerald Glass */}
        <div
          style={{
            width: '100%',
            maxWidth: '390px',
            background: 'rgba(3, 30, 22, 0.90)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '1.5rem',
            position: 'relative',
            paddingBottom: '1.25rem',
            boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
        >
          {/* Binder Straps / Metallic Gold Pegs */}
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '12%',
              width: '14px',
              height: '32px',
              background: 'linear-gradient(180deg, #fde047 0%, #b45309 100%)',
              borderRadius: '8px',
              zIndex: 10,
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 3px 6px rgba(0,0,0,0.4)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              right: '12%',
              width: '14px',
              height: '32px',
              background: 'linear-gradient(180deg, #fde047 0%, #b45309 100%)',
              borderRadius: '8px',
              zIndex: 10,
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 3px 6px rgba(0,0,0,0.4)'
            }}
          />

          {/* Header Block with Streak Flame */}
          <div
            style={{
              background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
              borderRadius: '1.5rem 1.5rem 1rem 1rem',
              padding: '1.1rem 1rem',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '0.9rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.4)'
            }}
          >
            <h2
              style={{
                color: 'white',
                margin: 0,
                fontWeight: 900,
                fontSize: '1.25rem',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Daily Sign-in Rewards
            </h2>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(0,0,0,0.25)',
                padding: '0.2rem 0.65rem',
                borderRadius: '12px',
                marginTop: '0.35rem',
                color: '#fef08a',
                fontSize: '0.74rem',
                fontWeight: 800
              }}
            >
              <span>🔥</span>
              <span>{dailyData?.streakBonus || `Day ${currentDay} Streak Active (+10% Spin Luck!)`}</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              1. SKELETON LOADING STATE (Glow-Wave 7-Day Grid)
              ══════════════════════════════════════════════════════════ */}
          {loading ? (
            <div className="page-reveal-fade">
              {/* Shimmering 7-Day Skeleton Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.45rem',
                  padding: '0 0.85rem',
                  marginBottom: '1rem'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <div
                    key={num}
                    className="skeleton-glow-box"
                    style={{
                      borderRadius: '0.75rem',
                      height: '84px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.45rem 0.15rem',
                      gap: '0.35rem'
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '10px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.15)'
                      }}
                    />
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.18)'
                      }}
                    />
                    <div
                      style={{
                        width: '26px',
                        height: '8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.12)'
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Shimmering Button Skeleton */}
              <div style={{ padding: '0 1rem' }}>
                <div
                  className="skeleton-glow-box"
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '0.75rem',
                    marginBottom: '0.5rem'
                  }}
                />
              </div>
            </div>
          ) : error || !dailyData ? (
            /* ══════════════════════════════════════════════════════════
               2. EXPLICIT SERVER ERROR STATE
               ══════════════════════════════════════════════════════════ */
            <div
              style={{
                padding: '1.5rem 1rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.65rem'
              }}
            >
              <div style={{ color: '#f87171', fontSize: '0.88rem', fontWeight: 700 }}>
                ⚠️ {error || 'Failed to load daily rewards from server.'}
              </div>
              <button
                onClick={() => loadData(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  padding: '0.4rem 1rem',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                🔄 Retry Connection
              </button>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════
               3. LIVE DATA RENDER (Refined Subtle Aesthetics)
               ══════════════════════════════════════════════════════════ */
            <div className="page-reveal-fade">
              {/* Days Grid Layout (Days 1 to 7) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.45rem',
                  padding: '0 0.85rem',
                  marginBottom: '1rem'
                }}
              >
                {days.map((d) => {
                  const dayNum = d.day;
                  let isClaimed = false;
                  let isReadyToday = false;
                  let isNextTomorrow = false;
                  let isLocked = false;

                  if (canClaimToday) {
                    if (dayNum < currentDay) {
                      isClaimed = true;
                    } else if (dayNum === currentDay) {
                      isReadyToday = true;
                    } else {
                      isLocked = true;
                    }
                  } else {
                    if (dayNum <= currentDay) {
                      isClaimed = true;
                    } else if (dayNum === currentDay + 1) {
                      isNextTomorrow = true;
                    } else {
                      isLocked = true;
                    }
                  }

                  return (
                    <div
                      key={d.day}
                      style={{
                        background: isReadyToday
                          ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)'
                          : isNextTomorrow
                          ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.22) 0%, rgba(180, 83, 9, 0.30) 100%)'
                          : d.isMega && !isClaimed
                          ? 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)'
                          : isClaimed
                          ? 'rgba(0, 0, 0, 0.40)'
                          : 'rgba(0, 0, 0, 0.28)',
                        borderRadius: '0.75rem',
                        padding: '0.45rem 0.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isReadyToday
                          ? '0 4px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.3)'
                          : 'inset 0 1px 2px rgba(0,0,0,0.2)',
                        border: isReadyToday
                          ? '2px solid #6ee7b7'
                          : isNextTomorrow
                          ? '1px dashed #fbbf24'
                          : isClaimed
                          ? '1px solid rgba(74, 222, 128, 0.4)'
                          : d.isMega
                          ? '2px solid #fde68a'
                          : '1px solid rgba(255,255,255,0.08)',
                        color: isReadyToday || isNextTomorrow || d.isMega ? '#ffffff' : isClaimed ? '#a7f3d0' : '#94a3b8',
                        transform: isReadyToday ? 'scale(1.02)' : 'none',
                        opacity: isLocked ? 0.45 : 1,
                        zIndex: isReadyToday ? 5 : isNextTomorrow ? 4 : 1,
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Status Badge Tag */}
                      {isClaimed && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                            color: 'white',
                            fontSize: '8px',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: '6px',
                            border: '1px solid #6ee7b7',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            zIndex: 10
                          }}
                        >
                          ✓ Claimed
                        </div>
                      )}

                      {isReadyToday && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            background: 'linear-gradient(180deg, #facc15 0%, #ca8a04 100%)',
                            color: '#1e293b',
                            fontSize: '8px',
                            fontWeight: 900,
                            padding: '1px 5px',
                            borderRadius: '6px',
                            border: '1px solid #ffffff',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                            zIndex: 10
                          }}
                        >
                          READY ⭐
                        </div>
                      )}

                      {isNextTomorrow && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
                            color: '#1e293b',
                            fontSize: '8px',
                            fontWeight: 900,
                            padding: '1px 4px',
                            borderRadius: '6px',
                            border: '1px solid #fef08a',
                            zIndex: 10
                          }}
                        >
                          NEXT ⏳
                        </div>
                      )}

                      {isLocked && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '3px',
                            right: '4px',
                            fontSize: '9px',
                            opacity: 0.6
                          }}
                        >
                          🔒
                        </div>
                      )}

                      {/* Day Label */}
                      <div
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          marginBottom: '0.15rem',
                          color: isReadyToday ? '#fef08a' : isNextTomorrow ? '#fde68a' : isClaimed ? '#86efac' : '#94a3b8'
                        }}
                      >
                        Day {d.day}
                      </div>

                      {/* Reward Icon */}
                      <div
                        style={{
                          fontSize: '1.25rem',
                          marginBottom: '0.15rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          filter: isReadyToday || d.isMega ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : isClaimed ? 'grayscale(0.3)' : 'none'
                        }}
                      >
                        <img
                          src={d.icon}
                          alt="Reward"
                          style={{
                            width: d.isMega ? '32px' : '30px',
                            height: d.isMega ? '32px' : '30px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>

                      {/* Reward Text */}
                      <div
                        style={{
                          fontSize: d.isMega ? '0.65rem' : '0.72rem',
                          fontWeight: 800,
                          color: isReadyToday ? '#ffffff' : isNextTomorrow ? '#fef08a' : isClaimed ? '#86efac' : '#cbd5e1'
                        }}
                      >
                        {d.reward}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button Section */}
              <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem', width: '100%', boxSizing: 'border-box' }}>
                {canClaimToday && adsEnabled && (
                  <button
                    onClick={handleDoubleClaim}
                    disabled={isClaiming}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      border: '1px solid rgba(254, 240, 138, 0.9)',
                      borderRadius: '0.75rem',
                      padding: '0.75rem',
                      fontSize: '0.94rem',
                      fontWeight: 900,
                      fontFamily: 'Georgia, serif',
                      boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4), inset 0 1px 1px rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>🎬</span> Watch Ad & Claim 2x Double Reward! (2x 💎)
                  </button>
                )}

                <button
                  onClick={handleClaim}
                  disabled={!canClaimToday || isClaiming}
                  style={{
                    width: '100%',
                    background: canClaimToday
                      ? 'linear-gradient(180deg, #00e676 0%, #00a854 100%)'
                      : 'rgba(255, 255, 255, 0.12)',
                    color: canClaimToday ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                    border: canClaimToday ? '1px solid rgba(167, 243, 208, 0.8)' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.75rem',
                    padding: canClaimToday ? '0.65rem' : '0.78rem',
                    fontSize: canClaimToday ? '0.86rem' : '0.96rem',
                    fontWeight: 800,
                    fontFamily: 'Georgia, serif',
                    boxShadow: canClaimToday ? '0 3px 10px rgba(0, 168, 84, 0.25)' : 'none',
                    cursor: canClaimToday ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {canClaimToday
                    ? `Claim Standard Day ${currentDay} Reward 💎`
                    : '✓ Claimed Today (Come Back Tomorrow)'}
                </button>
              </div>
            </div>
          )}

          {/* Close Link */}
          <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6ee7b7',
                textDecoration: 'underline',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
