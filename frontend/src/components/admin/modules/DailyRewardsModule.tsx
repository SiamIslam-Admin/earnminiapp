import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminDailyStreakDay } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const DailyRewardsModule: React.FC = () => {
  const [days, setDays] = useState<AdminDailyStreakDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDays = async () => {
    setLoading(true);
    try {
      const res = await adminService.getDailyStreakRewards();
      const rawData = res.data;
      const daysList: AdminDailyStreakDay[] = Array.isArray(rawData)
        ? rawData
        : (rawData as any)?.days || (rawData as any)?.items || [];

      // Ensure days 1 to 7 are present
      const fullDays: AdminDailyStreakDay[] = [];
      for (let i = 1; i <= 7; i++) {
        const found = daysList.find((d) => Number(d.day) === i);
        if (found) {
          fullDays.push({
            ...found,
            reward_gems: Number(found.reward_gems ?? (found as any).rewardDiamonds ?? (found as any).rewardGems ?? (i === 7 ? 6000 : 80)),
            reward_spins: Number(found.reward_spins ?? (found as any).rewardSpins ?? (i === 7 ? 5 : 0)),
            reward_usd: Number(found.reward_usd ?? (found as any).rewardUsd ?? (i === 7 ? 0.5 : 0.0)),
            label: found.label || (i === 7 ? 'MEGA +6000 💎 + 5 Spins + $0.50' : `+${found.reward_gems || 80} 💎`),
            icon: found.icon || (i === 7 || i === 3 ? './assets/giftIconInDailySignIn.png' : './assets/purple-diamond.png'),
            is_mega: Boolean(found.is_mega ?? (found as any).isMega ?? i === 7)
          });
        } else {
          fullDays.push({
            day: i,
            reward_gems: i === 7 ? 6000 : i === 3 ? 200 : 80,
            reward_spins: i === 7 ? 5 : i === 3 ? 1 : 0,
            reward_usd: i === 7 ? 0.5 : 0.0,
            label: i === 7 ? 'MEGA +6000 💎 + 5 Spins + $0.50' : `+80 💎`,
            icon: i === 7 || i === 3 ? './assets/giftIconInDailySignIn.png' : './assets/purple-diamond.png',
            is_mega: i === 7
          });
        }
      }
      setDays(fullDays);
    } catch (err: any) {
      notifyToast(`Failed to load streak rewards: ${err?.message || 'Error'}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDays();
  }, []);

  const handleUpdateDay = (index: number, field: keyof AdminDailyStreakDay, val: any) => {
    setDays((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      haptics.impact('medium');
      const payload = {
        days: days.map((d) => ({
          day: Number(d.day),
          reward_gems: Number(d.reward_gems) || 0,
          reward_spins: Number(d.reward_spins) || 0,
          reward_usd: Number(d.reward_usd) || 0,
          label: d.label?.trim() || `Day ${d.day} Reward`,
          icon: d.icon || (d.day === 7 || d.day === 3 ? './assets/giftIconInDailySignIn.png' : './assets/purple-diamond.png'),
          is_mega: Boolean(d.is_mega)
        }))
      };

      const res = await adminService.updateDailyStreakRewards(payload);
      if (res.success) {
        haptics.notification('success');
        // Clear session cache so players get fresh streak definitions immediately
        try {
          sessionStorage.removeItem('cached_daily_rewards');
        } catch {}
        notifyToast(`📅 Saved 7-Day Rewards Ladder! Day 1: +${payload.days[0].reward_gems} 💎, Day 7: +${payload.days[6].reward_gems} 💎`, 'success', 4000);
        await loadDays();
      } else {
        haptics.notification('error');
        const errMsg = res.error || res.message || 'Failed to save daily streak ladder';
        notifyToast(`Save failed: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Save Daily Streak Rewards Ladder');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err?.message || 'Failed to save'}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Daily Streak Rewards Ladder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            📅 7-Day Daily Streak Rewards Ladder
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            Configure multi-asset rewards (Diamonds 💎, Free Spins 🎡, USD Cash 💵) for each consecutive check-in day
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              haptics.impact('light');
              loadDays();
            }}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '0.45rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>💾</span>
            <span>{saving ? 'Saving...' : 'Save 7-Day Rewards Ladder'}</span>
          </button>
        </div>
      </div>

      {/* 7 Day Cards Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="skeleton-glow-box" style={{ height: '220px', borderRadius: '14px' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {days.map((dayItem, idx) => {
            const isMega = dayItem.is_mega || dayItem.day === 7;
            const borderColor = isMega ? '#f59e0b' : dayItem.day === 3 ? '#38bdf8' : 'rgba(255, 255, 255, 0.12)';
            const headerBg = isMega
              ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(234, 179, 8, 0.1))'
              : 'rgba(0, 0, 0, 0.25)';

            return (
              <div
                key={dayItem.day}
                style={{
                  background: isMega ? 'rgba(245, 158, 11, 0.06)' : 'rgba(15, 23, 42, 0.75)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '14px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: isMega ? '0 6px 20px rgba(245, 158, 11, 0.2)' : '0 4px 14px rgba(0, 0, 0, 0.3)',
                  position: 'relative'
                }}
              >
                {/* Day Header Badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: headerBg,
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: isMega ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{isMega ? '🌟' : dayItem.day === 3 ? '🎁' : '📅'}</span>
                    <span style={{ color: isMega ? '#fde047' : '#ffffff', fontWeight: 900, fontSize: '0.95rem' }}>
                      Day {dayItem.day} {isMega ? '• MEGA MILESTONE' : ''}
                    </span>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(dayItem.is_mega)}
                      onChange={(e) => handleUpdateDay(idx, 'is_mega', e.target.checked)}
                      style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span>Mega Badge</span>
                  </label>
                </div>

                {/* Multi-Asset Inputs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  {/* Diamonds */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.55rem', borderRadius: '8px' }}>
                    <label style={{ color: '#fde047', fontSize: '0.72rem', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      💎 Diamonds
                    </label>
                    <input
                      type="number"
                      value={dayItem.reward_gems}
                      onChange={(e) => handleUpdateDay(idx, 'reward_gems', parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.45rem',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(250, 204, 21, 0.3)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Free Spins */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.55rem', borderRadius: '8px' }}>
                    <label style={{ color: '#67e8f9', fontSize: '0.72rem', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      🎡 Spins
                    </label>
                    <input
                      type="number"
                      value={dayItem.reward_spins}
                      onChange={(e) => handleUpdateDay(idx, 'reward_spins', parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.45rem',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* USD Cash */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.55rem', borderRadius: '8px' }}>
                    <label style={{ color: '#34d399', fontSize: '0.72rem', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      💵 Cash ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={dayItem.reward_usd}
                      onChange={(e) => handleUpdateDay(idx, 'reward_usd', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.45rem',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Custom Label Override */}
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '0.25rem' }}>
                    Custom Display Label (optional)
                  </label>
                  <input
                    type="text"
                    value={dayItem.label || ''}
                    onChange={(e) => handleUpdateDay(idx, 'label', e.target.value)}
                    placeholder={`e.g. +${dayItem.reward_gems} 💎`}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      fontSize: '0.8rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

