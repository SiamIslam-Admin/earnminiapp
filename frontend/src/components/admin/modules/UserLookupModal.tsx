import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminUserListItem, AdminUserLookupData, UserLookupTransaction } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { copyTextSafe } from '../../../utils/clipboard';
import { haptics } from '../../../utils/haptics';

interface UserLookupModalProps {
  initialUser?: AdminUserListItem | null;
  searchQuery?: string;
  onClose: () => void;
  onAdjustBalance: (user: AdminUserListItem) => void;
  onToggleBan: (user: AdminUserListItem) => void;
}

export const UserLookupModal: React.FC<UserLookupModalProps> = ({
  initialUser,
  searchQuery = '',
  onClose,
  onAdjustBalance,
  onToggleBan
}) => {
  const [data, setData] = useState<AdminUserLookupData | null>(null);
  const [loading, setLoading] = useState(true);

  const queryToUse = searchQuery || (initialUser ? String(initialUser.telegram_id || initialUser.id) : '');

  const loadDeepLookup = async () => {
    if (!queryToUse) return;
    setLoading(true);
    try {
      const res = await adminService.getDeepUserLookup(queryToUse);
      if (res.success && res.data) {
        setData(res.data);
      } else if (initialUser) {
        // Fallback with initialUser info
        setData({
          user: initialUser,
          stats: {
            total_deposits_count: 0,
            total_deposits_usd: 0,
            total_cashouts_count: 0,
            total_cashouts_usd: 0,
            total_referrals_count: 0,
            net_profit_usd: 0
          },
          recent_transactions: []
        });
      } else {
        notifyToast(`Lookup failed: ${res.error || 'User not found'}`, 'error', 3500);
      }
    } catch (err: any) {
      notifyToast(`Lookup error: ${err?.message || 'Failed to fetch'}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeepLookup();
  }, [queryToUse]);

  const user = data?.user || initialUser;
  const stats = data?.stats;
  const txs: UserLookupTransaction[] = data?.recent_transactions || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'linear-gradient(180deg, #0f172a 0%, #090e1a 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '20px',
          padding: '1.5rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
          overflowY: 'auto'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.25rem', fontWeight: 800 }}>
              🔍 Deep User Profile & Audit Inspector
            </h3>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              Full financial balance, referral counts, and ledger audit
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#cbd5e1',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="skeleton-glow-box" style={{ width: '100%', height: '220px', borderRadius: '14px' }} />
        ) : !user ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            User profile not found.
          </div>
        ) : (
          <>
            {/* User Profile Overview Card */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '1.1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00e676, #00b0ff)',
                    color: '#060a12',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {(user.first_name || user.username || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>
                      {user.first_name || 'Player'}
                    </span>
                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                      @{user.username || 'no_user'}
                    </span>
                    {user.is_admin && (
                      <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        ADMIN
                      </span>
                    )}
                    {user.is_banned && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        BANNED
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    Telegram ID: <strong style={{ color: '#cbd5e1' }}>{user.telegram_id}</strong> • Internal ID: #{user.id}
                  </div>
                  {user.ton_wallet && (
                    <div
                      onClick={() => {
                        copyTextSafe(user.ton_wallet || '');
                        notifyToast('Copied BEP-20 Wallet Address!', 'success', 2000);
                      }}
                      style={{ color: '#34d399', fontSize: '0.72rem', cursor: 'pointer', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>💳 {user.ton_wallet.substring(0, 10)}...{user.ton_wallet.substring(user.ton_wallet.length - 8)}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>📋 (copy)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    haptics.impact('medium');
                    onAdjustBalance(user);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 0.9rem',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  💰 Adjust Balance
                </button>
                <button
                  onClick={() => {
                    haptics.impact('heavy');
                    onToggleBan(user);
                  }}
                  style={{
                    background: user.is_banned ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    border: user.is_banned ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                    color: user.is_banned ? '#4ade80' : '#f87171',
                    borderRadius: '8px',
                    padding: '0.5rem 0.8rem',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {user.is_banned ? '✓ Unban' : '🚫 Ban'}
                </button>
              </div>
            </div>

            {/* Financial Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>USDT Cash Balance</span>
                <span style={{ color: '#fbbf24', fontSize: '1.1rem', fontWeight: 900 }}>${(user.balance_usd || 0).toFixed(2)}</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Diamonds Balance</span>
                <span style={{ color: '#38bdf8', fontSize: '1.1rem', fontWeight: 900 }}>{user.diamonds || 0} 💎</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Free Spins</span>
                <span style={{ color: '#a7f3d0', fontSize: '1.1rem', fontWeight: 900 }}>{user.spins || 0} 🎡</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Total Referrals</span>
                <span style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 900 }}>{stats?.total_referrals_count || 0} 👥</span>
              </div>
            </div>

            {/* Audit History (Recent 50 Transactions) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 800 }}>
                  Recent Transactions & Ledger Log ({txs.length})
                </span>
              </div>

              {txs.length === 0 ? (
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  No transaction history recorded yet.
                </div>
              ) : (
                <div style={{ maxHeight: '240px', overflowY: 'auto', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                    <thead style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#94a3b8', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Type</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Amount</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txs.map((t, idx) => (
                        <tr key={t.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent' }}>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#f1f5f9', fontWeight: 700 }}>
                            {t.type || t.category || 'Transaction'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#fbbf24', fontWeight: 800 }}>
                            {t.amount_usd !== undefined ? `$${Number(t.amount_usd).toFixed(2)} USDT` : (t.amount_diamonds ? `${t.amount_diamonds} 💎` : String(t.amount || '-'))}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{
                              background: t.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: t.status === 'completed' ? '#34d399' : '#fbbf24',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700
                            }}>
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
