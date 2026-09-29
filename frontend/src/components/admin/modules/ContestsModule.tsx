import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminContest, ContestPrizeLadderEntry } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

interface StandardTournamentConfig {
  category: 'spins' | 'referrals';
  defaultTitle: string;
  defaultPrizePool: number;
  defaultDurationDays: number;
  defaultLadder: ContestPrizeLadderEntry[];
  icon: string;
  themeColor: string;
  badgeLabel: string;
}

const STANDARD_TOURNAMENTS: StandardTournamentConfig[] = [
  {
    category: 'spins',
    defaultTitle: 'Weekly Spin Masters Tournament',
    defaultPrizePool: 500,
    defaultDurationDays: 7,
    defaultLadder: [
      { rank_from: 1, rank_to: 1, prize_usd: 250, badge: '👑 1st' },
      { rank_from: 2, rank_to: 2, prize_usd: 150, badge: '🥈 2nd' },
      { rank_from: 3, rank_to: 3, prize_usd: 100, badge: '🥉 3rd' }
    ],
    icon: '🎡',
    themeColor: '#38bdf8',
    badgeLabel: 'Top Spinner Tournament'
  },
  {
    category: 'referrals',
    defaultTitle: 'Top Inviters Grand Arena',
    defaultPrizePool: 300,
    defaultDurationDays: 7,
    defaultLadder: [
      { rank_from: 1, rank_to: 1, prize_usd: 150, badge: '👑 1st' },
      { rank_from: 2, rank_to: 2, prize_usd: 90, badge: '🥈 2nd' },
      { rank_from: 3, rank_to: 3, prize_usd: 60, badge: '🥉 3rd' }
    ],
    icon: '👥',
    themeColor: '#34d399',
    badgeLabel: 'Top Inviter Tournament'
  }
];

export const ContestsModule: React.FC = () => {
  const [contests, setContests] = useState<AdminContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'spins' | 'referrals'>('spins');

  // Form State
  const [title, setTitle] = useState('');
  const [prizePool, setPrizePool] = useState('500');
  const [durationDays, setDurationDays] = useState('7');
  const [status, setStatus] = useState<'active' | 'scheduled' | 'ended'>('active');
  const [ladder, setLadder] = useState<ContestPrizeLadderEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadContests = async () => {
    setLoading(true);
    try {
      const res = await adminService.getContests();
      if (res.data) setContests(res.data);
    } catch (err: any) {
      notifyToast(`Failed to load contests: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContests();
  }, []);

  const getContestForCategory = (cat: 'spins' | 'referrals'): AdminContest | undefined => {
    return contests.find((c) => c.category === cat && c.status === 'active') || contests.find((c) => c.category === cat);
  };

  const openConfigureModal = (config: StandardTournamentConfig) => {
    const existing = getContestForCategory(config.category);
    setActiveCategory(config.category);
    setTitle(existing?.title || config.defaultTitle);
    setPrizePool(String(existing?.prize_pool_usd || config.defaultPrizePool));
    setDurationDays(String(config.defaultDurationDays));
    setStatus(existing?.status === 'active' || existing?.status === 'scheduled' ? existing.status : 'active');
    setLadder(
      existing?.prize_ladder && existing.prize_ladder.length > 0
        ? existing.prize_ladder
        : config.defaultLadder
    );
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notifyToast('Please provide a tournament title', 'info', 2500);
      return;
    }

    setSubmitting(true);
    const startsAt = new Date().toISOString();
    const days = parseInt(durationDays || '7', 10) || 7;
    const endsAt = new Date(Date.now() + days * 86400000).toISOString();
    const pool = parseFloat(prizePool) || 500;

    const existing = getContestForCategory(activeCategory);

    try {
      if (existing && existing.id) {
        await adminService.updateContest(existing.id, {
          title: title.trim(),
          category: activeCategory,
          prize_pool_usd: pool,
          starts_at: status === 'active' ? startsAt : existing.starts_at,
          ends_at: status === 'active' ? endsAt : existing.ends_at,
          status: status,
          prize_ladder: ladder
        });
        notifyToast(`🏆 ${title} updated successfully!`, 'success', 3000);
      } else {
        await adminService.createContest({
          title: title.trim(),
          category: activeCategory,
          prize_pool_usd: pool,
          starts_at: startsAt,
          ends_at: endsAt,
          status: status,
          prize_ladder: ladder
        });
        notifyToast(`🎉 ${title} activated!`, 'success', 3000);
      }
      setShowModal(false);
      loadContests();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Tournament Configuration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickActivate = async (config: StandardTournamentConfig) => {
    const existing = getContestForCategory(config.category);
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + config.defaultDurationDays * 86400000).toISOString();

    try {
      haptics.impact('medium');
      if (existing && existing.id) {
        await adminService.updateContest(existing.id, {
          title: existing.title || config.defaultTitle,
          category: config.category,
          prize_pool_usd: existing.prize_pool_usd || config.defaultPrizePool,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'active',
          prize_ladder: existing.prize_ladder || config.defaultLadder
        });
        notifyToast(`⚡ ${config.badgeLabel} activated for ${config.defaultDurationDays} days!`, 'success', 3000);
      } else {
        await adminService.createContest({
          title: config.defaultTitle,
          category: config.category,
          prize_pool_usd: config.defaultPrizePool,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'active',
          prize_ladder: config.defaultLadder
        });
        notifyToast(`🎉 ${config.badgeLabel} launched!`, 'success', 3000);
      }
      loadContests();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Quick Launch Tournament');
    }
  };

  const handleDistribute = async (contest: AdminContest) => {
    if (
      !window.confirm(
        `Are you sure you want to distribute $${contest.prize_pool_usd} USDT in prizes to the top leaderboard winners of "${contest.title}"?`
      )
    ) {
      return;
    }

    try {
      haptics.impact('heavy');
      const res = await adminService.distributeContestPrizes(contest.id);
      if (res.success) {
        notifyToast(`💰 Prizes distributed to winners!`, 'success', 4000);
        loadContests();
      } else {
        const errMsg = res.error || 'Tournament prize distribution failed. Check tournament status and end date.';
        notifyToast(`Failed: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Distribute Tournament Prizes');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Distribute Tournament Prizes');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            🏆 Standard Tournaments Manager
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Configure and manage the two standard leaderboards: Top Spinner &amp; Top Inviter
          </span>
        </div>
        <button
          onClick={loadContests}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#f8fafc',
            borderRadius: '10px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>🔄</span> Refresh Status
        </button>
      </div>

      {/* 2 Core Standard Tournaments Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          <div className="skeleton-glow-box" style={{ width: '100%', height: '260px', borderRadius: '16px' }} />
          <div className="skeleton-glow-box" style={{ width: '100%', height: '260px', borderRadius: '16px' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {STANDARD_TOURNAMENTS.map((config) => {
            const contest = getContestForCategory(config.category);
            const isActive = contest?.status === 'active';
            const prizePoolUsd = contest?.prize_pool_usd ?? config.defaultPrizePool;
            const participants = contest?.total_participants ?? 0;
            const titleText = contest?.title || config.defaultTitle;
            const currentLadder = contest?.prize_ladder && contest.prize_ladder.length > 0 ? contest.prize_ladder : config.defaultLadder;

            return (
              <div
                key={config.category}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${isActive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  boxShadow: isActive ? '0 8px 24px rgba(0, 230, 118, 0.15)' : '0 4px 14px rgba(0, 0, 0, 0.4)',
                  position: 'relative',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.6rem' }}>{config.icon}</span>
                    <div>
                      <span
                        style={{
                          background: config.category === 'spins' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                          color: config.themeColor,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {config.badgeLabel}
                      </span>
                      <h3 style={{ margin: '0.35rem 0 0 0', color: '#ffffff', fontSize: '1.1rem', fontWeight: 800 }}>
                        {titleText}
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        background: isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.25)',
                        color: isActive ? '#34d399' : '#94a3b8',
                        border: `1px solid ${isActive ? 'rgba(52, 211, 153, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? '#34d399' : '#94a3b8',
                          boxShadow: isActive ? '0 0 6px #34d399' : 'none'
                        }}
                      />
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>

                {/* Metrics Stats Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>Prize Pool</span>
                    <span style={{ color: '#facc15', fontWeight: 900, fontSize: '1.05rem', fontFamily: 'Georgia, serif' }}>
                      ${prizePoolUsd.toFixed(2)} USDT
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', fontWeight: 600 }}>Active Players</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.05rem' }}>
                      {participants} Players
                    </span>
                  </div>
                </div>

                {/* Prize Ladder Visual Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Prize Distribution
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                    {currentLadder.slice(0, 3).map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '0.4rem 0.3rem',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#fef08a' }}>
                          {entry.badge || (idx === 0 ? '👑 1st' : idx === 1 ? '🥈 2nd' : '🥉 3rd')}
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#34d399', marginTop: '1px' }}>
                          ${entry.prize_usd}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.3rem' }}>
                  <button
                    onClick={() => openConfigureModal(config)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.15) 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.5)',
                      borderRadius: '8px',
                      color: '#38bdf8',
                      padding: '0.55rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <span>⚙️</span> Configure
                  </button>

                  {!isActive && (
                    <button
                      onClick={() => handleQuickActivate(config)}
                      style={{
                        background: 'linear-gradient(135deg, #00e676, #00a854)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#060a12',
                        padding: '0.55rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Activate
                    </button>
                  )}

                  {isActive && contest && (
                    <button
                      onClick={() => handleDistribute(contest)}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        padding: '0.55rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      💰 Distribute
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clean Configure Modal (Strictly bounds editing to the selected canonical tournament) */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#0f172a',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: '18px',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{activeCategory === 'spins' ? '🎡' : '👥'}</span>
                Configure {activeCategory === 'spins' ? 'Top Spinner' : 'Top Inviter'} Tournament
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Tournament Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activeCategory === 'spins' ? 'Weekly Spin Masters Tournament' : 'Top Inviters Grand Arena'}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.8rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                    Prize Pool ($ USDT)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={prizePool}
                    onChange={(e) => setPrizePool(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#facc15',
                      fontWeight: 800,
                      boxSizing: 'border-box',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    required
                    min="1"
                    max="90"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                  Tournament Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: status === 'active' ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
                      background: status === 'active' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0,0,0,0.3)',
                      color: status === 'active' ? '#00e676' : '#94a3b8',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    ✓ Active Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('ended')}
                    style={{
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: status === 'ended' ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.1)',
                      background: status === 'ended' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.3)',
                      color: status === 'ended' ? '#f87171' : '#94a3b8',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Paused / Ended
                  </button>
                </div>
              </div>

              {/* Prize Ladder Distribution Form */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>
                  Prize Ladder Breakdown ($ USDT)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {ladder.map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '75px 1fr',
                        gap: '0.5rem',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: '#fef08a', fontSize: '0.8rem', fontWeight: 800 }}>
                        {entry.badge || (idx === 0 ? '👑 1st' : idx === 1 ? '🥈 2nd' : '🥉 3rd')}
                      </span>
                      <input
                        type="number"
                        value={entry.prize_usd}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setLadder((prev) => {
                            const copy = [...prev];
                            copy[idx] = { ...copy[idx], prize_usd: val };
                            return copy;
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '6px',
                          color: '#34d399',
                          fontWeight: 800,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.65rem' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #00e676, #00b0ff)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#060a12',
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {submitting ? 'Saving...' : 'Save & Activate 🚀'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '0.75rem 1.2rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

