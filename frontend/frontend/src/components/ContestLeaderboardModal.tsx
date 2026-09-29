import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { haptics } from '../utils/haptics';
import { fetchContestData } from '../services/dataService';
import type { ContestLeaderboardData, ContestLeaderboardUser } from '../types/api';

export interface ContestLeaderboardModalProps {
  onClose: () => void;
  onInvite?: () => void;
}

export const ContestLeaderboardModal: FC<ContestLeaderboardModalProps> = ({ onClose, onInvite }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'spins' | 'referrals'>('spins');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contestData, setContestData] = useState<ContestLeaderboardData | null>(null);
  const [timeLeft, setTimeLeft] = useState('2d 14h 32m 45s');

  const loadData = useCallback(async (tab: 'spins' | 'referrals') => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContestData(tab);
      if (data) {
        setContestData(data);
        if (data.endsIn) setTimeLeft(data.endsIn);
      } else {
        setError('No active tournament data found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to tournament service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    loadData(activeTab);
  }, [activeTab, loadData]);

  // Live countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const seconds = 59 - now.getSeconds();
      const minutes = 59 - now.getMinutes();
      setTimeLeft(`2d 14h ${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    haptics.impact('light');
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleTabChange = (tab: 'spins' | 'referrals') => {
    if (tab === activeTab) return;
    haptics.impact('medium');
    haptics.playClickSound();
    setActiveTab(tab);
  };

  const topWinners: ContestLeaderboardUser[] = contestData?.topWinners || [];
  const otherRankings: ContestLeaderboardUser[] = contestData?.otherRankings || [];
  const first = topWinners[0];
  const second = topWinners[1];
  const third = topWinners[2];

  const metricLabel = activeTab === 'spins' ? 'Spins' : 'Invites';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        fontFamily: 'Outfit, sans-serif'
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

      {/* Bottom Sheet Modal Container */}
      <div
        style={{
          width: '100%',
          height: '88vh',
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
          borderTopLeftRadius: '1.75rem',
          borderTopRightRadius: '1.75rem',
          borderTop: '1px solid rgba(167, 139, 250, 0.5)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '1rem 1.25rem 0.6rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 900,
                fontFamily: 'Georgia, serif',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>🏆</span> {contestData?.title || (activeTab === 'spins' ? 'Spin Masters Contest' : 'Top Inviters Contest')}
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#c4b5fd', marginTop: '0.15rem' }}>
              Prize Pool: <span style={{ color: '#fbbf24', fontWeight: 900 }}>{contestData?.prizePool || '$500.00 USDT'}</span> • Ends in: {timeLeft}
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'white',
              fontSize: '1.1rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* 2 Category Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            onClick={() => handleTabChange('spins')}
            style={{
              flex: 1,
              padding: '0.55rem 0.5rem',
              borderRadius: '0.75rem',
              border: activeTab === 'spins' ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
              background: activeTab === 'spins'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'spins' ? '0 4px 12px rgba(139, 92, 246, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>🎡</span> Spin Masters
          </button>

          <button
            onClick={() => handleTabChange('referrals')}
            style={{
              flex: 1,
              padding: '0.55rem 0.5rem',
              borderRadius: '0.75rem',
              border: activeTab === 'referrals' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
              background: activeTab === 'referrals'
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'rgba(255,255,255,0.05)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              boxShadow: activeTab === 'referrals' ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <span>👥</span> Top Inviters
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.25rem 5.5rem 1.25rem'
          }}
        >
          {loading ? (
            /* Loading Skeleton Structure */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                className="skeleton-glow-box"
                style={{ height: '140px', borderRadius: '1rem', width: '100%' }}
              />
              <div
                className="skeleton-glow-box"
                style={{ height: '48px', borderRadius: '0.85rem', width: '100%' }}
              />
              <div
                className="skeleton-glow-box"
                style={{ height: '48px', borderRadius: '0.85rem', width: '100%' }}
              />
              <div
                className="skeleton-glow-box"
                style={{ height: '48px', borderRadius: '0.85rem', width: '100%' }}
              />
            </div>
          ) : error && !contestData ? (
            /* Error & Offline Fallback Card */
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '1rem',
                padding: '2rem 1rem',
                textAlign: 'center',
                color: '#fca5a5'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
                Failed to load tournament data
              </div>
              <div style={{ fontSize: '0.78rem', marginBottom: '1rem', opacity: 0.8 }}>
                {error}
              </div>
              <button
                onClick={() => loadData(activeTab)}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '0.6rem',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                🔄 Try Again
              </button>
            </div>
          ) : topWinners.length === 0 ? (
            /* Empty Active Contest State */
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '1.25rem',
                padding: '2.5rem 1.25rem',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>
                {activeTab === 'spins' ? '🎡' : '🚀'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
                Tournament Is Live!
              </div>
              <p style={{ fontSize: '0.8rem', color: '#c4b5fd', margin: '0.5rem 0 1.2rem 0' }}>
                {activeTab === 'spins'
                  ? 'Be the very first player to spin the wheel and claim Rank #1 on the leaderboard!'
                  : 'Invite friends to your team to claim Rank #1 in this weekly referral tournament!'}
              </p>
              <button
                onClick={() => {
                  if (activeTab === 'referrals' && onInvite) {
                    onInvite();
                  } else {
                    handleClose();
                  }
                }}
                style={{
                  background: activeTab === 'spins'
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                    : 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.85rem',
                  padding: '0.65rem 1.5rem',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {activeTab === 'spins' ? 'Spin to Qualify 🎡' : 'Invite Friends Now 👥'}
              </button>
            </div>
          ) : (
            /* Active Tournament Leaderboard View */
            <>
              {/* Top 3 Champions Podium (Safely handles available top entries) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                  marginBottom: '1.5rem',
                  marginTop: '0.5rem'
                }}
              >
                {/* 2nd Place Podium */}
                {second ? (
                  <div
                    style={{
                      background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)',
                      border: '1px solid rgba(203, 213, 225, 0.4)',
                      borderRadius: '1rem',
                      padding: '0.75rem 0.35rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: '0.35rem' }}>
                      {second.avatar && (second.avatar.startsWith('http') || second.avatar.startsWith('/') || second.avatar.startsWith('data:')) ? (
                        <img
                          src={second.avatar}
                          alt={second.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                          style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1' }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                          border: '2px solid #cbd5e1',
                          display: second.avatar && (second.avatar.startsWith('http') || second.avatar.startsWith('/') || second.avatar.startsWith('data:')) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          color: 'white',
                          fontSize: '0.9rem'
                        }}
                      >
                        {second.avatar && second.avatar.length <= 4 && !second.avatar.startsWith('http') ? second.avatar : (second.name ? second.name.substring(0, 2).toUpperCase() : '🥈')}
                      </div>
                      <span style={{ position: 'absolute', bottom: '-6px', right: '-6px', fontSize: '1rem' }}>🥈</span>
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }}>
                      {second.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {second.spins !== undefined ? second.spins : (second.referrals !== undefined ? second.referrals : second.score || 0)} {metricLabel}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.35rem' }}>
                      {second.prize}
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.3, textAlign: 'center', padding: '1rem 0' }}>🥈 Vacant</div>
                )}

                {/* 1st Place (Grand Winner) */}
                {first ? (
                  <div
                    style={{
                      background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.35) 0%, rgba(15, 23, 42, 0.8) 100%)',
                      border: '2px solid rgba(251, 191, 36, 0.7)',
                      boxShadow: '0 0 15px rgba(251, 191, 36, 0.3)',
                      borderRadius: '1.25rem',
                      padding: '1.1rem 0.35rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      transform: 'scale(1.06)',
                      zIndex: 2,
                      position: 'relative'
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: '0.35rem' }}>
                      {first.avatar && (first.avatar.startsWith('http') || first.avatar.startsWith('/') || first.avatar.startsWith('data:')) ? (
                        <img
                          src={first.avatar}
                          alt={first.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                          style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbbf24' }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                          border: '2px solid #fbbf24',
                          display: first.avatar && (first.avatar.startsWith('http') || first.avatar.startsWith('/') || first.avatar.startsWith('data:')) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          color: 'white',
                          fontSize: '1.1rem'
                        }}
                      >
                        {first.avatar && first.avatar.length <= 4 && !first.avatar.startsWith('http') ? first.avatar : (first.name ? first.name.substring(0, 2).toUpperCase() : '👑')}
                      </div>
                      <span style={{ position: 'absolute', bottom: '-6px', right: '-6px', fontSize: '1.3rem' }}>👑</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px' }}>
                      {first.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#fef08a' }}>
                      {first.spins !== undefined ? first.spins : (first.referrals !== undefined ? first.referrals : first.score || 0)} {metricLabel}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.35rem', fontFamily: 'Georgia, serif' }}>
                      {first.prize}
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.3, textAlign: 'center', padding: '1rem 0' }}>👑 Vacant</div>
                )}

                {/* 3rd Place Podium */}
                {third ? (
                  <div
                    style={{
                      background: 'linear-gradient(180deg, rgba(180, 83, 9, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)',
                      border: '1px solid rgba(217, 119, 6, 0.4)',
                      borderRadius: '1rem',
                      padding: '0.75rem 0.35rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative'
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: '0.35rem' }}>
                      {third.avatar && (third.avatar.startsWith('http') || third.avatar.startsWith('/') || third.avatar.startsWith('data:')) ? (
                        <img
                          src={third.avatar}
                          alt={third.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                          style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d97706' }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
                          border: '2px solid #d97706',
                          display: third.avatar && (third.avatar.startsWith('http') || third.avatar.startsWith('/') || third.avatar.startsWith('data:')) ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          color: 'white',
                          fontSize: '0.9rem'
                        }}
                      >
                        {third.avatar && third.avatar.length <= 4 && !third.avatar.startsWith('http') ? third.avatar : (third.name ? third.name.substring(0, 2).toUpperCase() : '🥉')}
                      </div>
                      <span style={{ position: 'absolute', bottom: '-6px', right: '-6px', fontSize: '1rem' }}>🥉</span>
                    </div>

                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }}>
                      {third.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#fca5a5' }}>
                      {third.spins !== undefined ? third.spins : (third.referrals !== undefined ? third.referrals : third.score || 0)} {metricLabel}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f87171', marginTop: '0.35rem' }}>
                      {third.prize}
                    </div>
                  </div>
                ) : (
                  <div style={{ opacity: 0.3, textAlign: 'center', padding: '1rem 0' }}>🥉 Vacant</div>
                )}
              </div>

              {/* Rankings Table (Ranks 4+) */}
              {otherRankings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                    Top Participants
                  </div>

                  {otherRankings.map((u) => {
                    const isImg = u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith('/') || u.avatar.startsWith('data:'));
                    return (
                      <div
                        key={u.rank}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.9rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'rgba(255,255,255,0.6)', width: '22px' }}>
                            #{u.rank}
                          </span>
                          {isImg ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              display: isImg ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              color: 'white',
                              fontSize: '0.75rem'
                            }}
                          >
                            {u.avatar && u.avatar.length <= 4 && !u.avatar.startsWith('http') ? u.avatar : (u.name ? u.name.substring(0, 2).toUpperCase() : '⭐')}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>{u.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                              {u.spins !== undefined ? u.spins : (u.referrals !== undefined ? u.referrals : u.score || 0)} {metricLabel.toLowerCase()}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#34d399' }}>
                          {u.prize}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky User Bottom Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0.85rem 1.25rem',
            background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 1) 100%)',
            borderTop: '1px solid rgba(167, 139, 250, 0.4)',
            boxShadow: '0 -4px 15px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: activeTab === 'spins'
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: 'white',
                fontSize: '0.85rem'
              }}
            >
              #{contestData?.userStatus?.rank || '--'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>Your Tournament Rank</span>
              <span style={{ fontSize: '0.72rem', color: '#c4b5fd' }}>
                {activeTab === 'spins'
                  ? `${contestData?.userStatus?.spins || 0} Spins`
                  : `${contestData?.userStatus?.referrals || 0} Invites`
                } • Projected: <b style={{ color: '#34d399' }}>{contestData?.userStatus?.projectedPrize || '$0.00'}</b>
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'referrals' && onInvite) {
                onInvite();
              } else {
                handleClose();
              }
            }}
            style={{
              background: activeTab === 'spins'
                ? 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)'
                : 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
              color: 'white',
              border: activeTab === 'spins' ? '1px solid #c4b5fd' : '1px solid #86efac',
              borderRadius: '0.75rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: activeTab === 'spins'
                ? '0 2px 8px rgba(139, 92, 246, 0.4)'
                : '0 2px 8px rgba(0, 230, 118, 0.4)'
            }}
          >
            {activeTab === 'spins' ? 'Spin to Rank ⬆' : 'Invite Friends 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};
