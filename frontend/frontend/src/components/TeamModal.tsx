import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { haptics } from '../utils/haptics';
import { getInitialTeamData, fetchTeamData } from '../services/dataService';
import { notifyToast } from '../utils/debugToast';
import type { TeamStatsData } from '../types/api';
import { UserAvatar } from './UserAvatar';

export interface TeamModalProps {
  onClose: () => void;
}

export const TeamModal: FC<TeamModalProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [teamData, setTeamData] = useState<TeamStatsData | null>(() => getInitialTeamData());
  const [loading, setLoading] = useState(() => teamData === null);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchTeamData()
      .then((data) => {
        if (data) {
          setTeamData(data);
        } else {
          setError('Failed to load team data from server.');
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load team data.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
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

  const handleInvite = () => {
    haptics.impact('medium');
    haptics.playClickSound();

    const userTgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '';
    const inviteUrl = teamData?.inviteUrl || (userTgId ? `https://t.me/SpinCraft_bot/earnnow?startapp=ref_${userTgId}` : `https://t.me/SpinCraft_bot/earnnow?startapp=ref_user`);
    const shareText = teamData?.shareText || `Join me on Spin Craft and spin the wheel for massive cash rewards! 🎰💰`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;

    try {
      // @ts-ignore
      if (window.Telegram?.WebApp?.openTelegramLink) {
        // @ts-ignore
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else if (navigator?.clipboard) {
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        notifyToast('Invite link copied to clipboard! 📋', 'success', 3000);
        setTimeout(() => setCopied(false), 2500);
      } else {
        window.open(shareUrl, '_blank');
      }
    } catch {
      setCopied(true);
      notifyToast('Invite link copied to clipboard! 📋', 'success', 3000);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const teamMembers = (teamData?.members || []) as any[];
  const totalCount = teamData?.totalCount ?? teamMembers.length;
  const activeCount = teamData?.activeCount ?? teamMembers.filter((m) => m.joinedChannel).length;
  const currentTier = (teamData?.currentTier || 'Bronze').toLowerCase();

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
      {/* Dark overlay click */}
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

      {/* Floating Copy Toast Notification */}
      {copied && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '0.6rem 1.25rem',
            borderRadius: '25px',
            border: '1px solid #6ee7b7',
            boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            fontSize: '0.9rem',
            fontWeight: 800,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            animation: 'slideUp 0.3s ease'
          }}
        >
          <span>📋</span> Invite Link Copied to Clipboard!
        </div>
      )}

      {/* Bottom Sheet Container */}
      <div
        style={{
          width: '100%',
          height: '86vh',
          maxHeight: '88vh',
          background: 'linear-gradient(180deg, #058245 0%, #02381e 100%)',
          borderTopLeftRadius: '1.75rem',
          borderTopRightRadius: '1.75rem',
          borderTop: '1px solid rgba(52, 211, 153, 0.5)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.1rem 1.25rem 1.5rem 1.25rem',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            marginBottom: '0.75rem'
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#ffffff',
              fontSize: '1.35rem',
              fontWeight: 800,
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.3px'
            }}
          >
            My Referral Team
          </h2>
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              right: 0,
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

        {/* Loading / Error States */}
        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#a7f3d0', fontSize: '0.95rem' }}>
            ⏳ Loading Referral Team from server...
          </div>
        ) : error || !teamData ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem'
            }}
          >
            <div style={{ color: '#f87171', fontSize: '0.92rem', fontWeight: 700 }}>
              ⚠️ {error || 'Failed to load team data from server.'}
            </div>
            <button
              onClick={loadData}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                borderRadius: '0.5rem',
                padding: '0.45rem 1.2rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              🔄 Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                padding: '0.4rem 1rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '1rem',
                marginBottom: '0.75rem',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              {/* Total Count */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Friends
                </span>
                <span
                  style={{
                    color: '#facc15',
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    fontFamily: 'Georgia, serif',
                    lineHeight: 1.1
                  }}
                >
                  {totalCount}
                </span>
              </div>

              <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.15)' }} />

              {/* Active Count */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Active in Channel
                </span>
                <span
                  style={{
                    color: '#34d399',
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    fontFamily: 'Georgia, serif',
                    lineHeight: 1.1
                  }}
                >
                  {activeCount}
                </span>
              </div>
            </div>

            {/* Partner Tier Roadmap */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '0.85rem',
                padding: '0.65rem 0.9rem',
                marginBottom: '0.85rem',
                border: '1px solid rgba(52, 211, 153, 0.3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fde68a' }}>
                  🌟 REFERRAL TIER REWARDS
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    color: '#1e293b',
                    background: currentTier === 'gold' ? '#facc15' : currentTier === 'silver' ? '#e2e8f0' : '#d97706',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '8px',
                    textTransform: 'uppercase'
                  }}
                >
                  {teamData.currentTier || 'Bronze'} Tier
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)' }}>
                <span style={{ color: currentTier === 'bronze' ? '#fde68a' : 'inherit', fontWeight: currentTier === 'bronze' ? 800 : 500 }}>
                  🥉 Bronze: 1 Spin/friend
                </span>
                <span style={{ color: currentTier === 'silver' ? '#fde68a' : 'inherit', fontWeight: currentTier === 'silver' ? 800 : 500 }}>
                  🥈 Silver: 2 Spins + 5%
                </span>
                <span style={{ color: currentTier === 'gold' ? '#fde68a' : 'inherit', fontWeight: currentTier === 'gold' ? 800 : 500 }}>
                  🥇 Gold: 3 Spins + 10%
                </span>
              </div>
            </div>

            {/* Highlight Invite Offer Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.6) 0%, rgba(2, 44, 34, 0.8) 100%)',
                borderRadius: '1rem',
                border: '1px solid rgba(251, 191, 36, 0.5)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.65rem',
                marginBottom: '0.85rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  color: '#ffffff',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  fontFamily: 'Georgia, serif'
                }}
              >
                <img
                  src="./assets/inviteFeatureCardIcon.png"
                  alt="Invite"
                  style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                />
                <span>Invite 1 Friend =</span>
                <img
                  src="./assets/ticket_animated.gif"
                  alt="Spin Ticket"
                  style={{ width: '34px', height: '34px', objectFit: 'contain' }}
                />
                <span style={{ color: '#facc15' }}>1 Free Spin</span>
              </div>

              <button
                onClick={handleInvite}
                style={{
                  width: '100%',
                  background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                  border: '1px solid rgba(167, 243, 208, 0.7)',
                  borderRadius: '0.75rem',
                  padding: '0.7rem 1.25rem',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  fontFamily: 'Georgia, serif',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                  textAlign: 'center'
                }}
              >
                {copied ? 'Link Copied! ✓' : 'Share Referral Link 🚀'}
              </button>
            </div>

            {/* Invited Members Table */}
            <div
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  padding: '0 0.25rem'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                  Invited Friend
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                  Channel Status
                </span>
              </div>

              <div
                className="hide-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem'
                }}
              >
                {teamMembers.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      padding: '1.5rem 1rem',
                      textAlign: 'center',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '0.82rem',
                      gap: '0.4rem'
                    }}
                  >
                    <span style={{ fontSize: '1.8rem' }}>👥</span>
                    <span>No friends invited yet.</span>
                    <span style={{ fontSize: '0.74rem', color: '#a7f3d0' }}>
                      Share your link to unlock free spins and earn partner tier bonuses!
                    </span>
                  </div>
                ) : (
                  teamMembers.map((member: any) => (
                    <div
                      key={member.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: '0.75rem',
                        padding: '0.55rem 0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <UserAvatar
                          name={member.name || 'Friend'}
                          photoUrl={member.photo_url || member.avatar}
                          size={32}
                          border="1px solid rgba(255, 255, 255, 0.2)"
                          boxShadow="0 2px 6px rgba(0, 0, 0, 0.25)"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>
                            {member.name}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
                            {member.joinedDate}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          background: member.joinedChannel ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: member.joinedChannel ? '1px solid #4ade80' : '1px solid #ef4444',
                          color: member.joinedChannel ? '#4ade80' : '#f87171',
                          borderRadius: '12px',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}
                      >
                        {member.joinedChannel ? 'Active ✓' : 'Pending'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Disclaimer */}
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.72rem',
                color: 'rgba(255, 255, 255, 0.65)',
                marginTop: '0.5rem'
              }}
            >
              * Free spins are unlocked when your invited friends join the channel.
            </div>
          </>
        )}
      </div>
    </div>
  );
};
