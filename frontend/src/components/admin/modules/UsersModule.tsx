import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminUserListItem } from '../../../types/admin';
import { UserLookupModal } from './UserLookupModal';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { downloadCsvAuthenticated } from '../../../utils/csvDownloader';
import { openDownloadInBrowser } from '../../../utils/browserOpener';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const UsersModule: React.FC = () => {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Deep Lookup Modal
  const [inspectUser, setInspectUser] = useState<AdminUserListItem | null>(null);

  // Balance Adjuster Modal
  const [adjustingUser, setAdjustingUser] = useState<AdminUserListItem | null>(null);
  const [adjustType, setAdjustType] = useState<'diamonds' | 'spins' | 'balance_usd'>('diamonds');
  const [adjustAmount, setAdjustAmount] = useState('100');
  const [auditReason, setAuditReason] = useState('VIP bonus / Manual correction');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await adminService.lookupUser(searchQuery.trim());
        if (res.data && Array.isArray(res.data)) {
          setUsers(res.data);
        } else {
          setUsers([]);
        }
      } else {
        const res = await adminService.getUsers();
        if (res.data && res.data.users) {
          setUsers(res.data.users);
        } else if (Array.isArray(res.data)) {
          setUsers(res.data);
        }
      }
    } catch (err: any) {
      notifyToast(`Failed to load users: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser) return;
    if (!auditReason.trim()) {
      notifyToast('Audit reason is mandatory for financial adjustments', 'info', 3000);
      return;
    }

    setSubmitting(true);
    try {
      const amt = parseFloat(adjustAmount) || 0;
      await adminService.adjustBalance({
        user_id: adjustingUser.id,
        adjustment_type: adjustType,
        amount: amt,
        audit_reason: auditReason.trim()
      });
      notifyToast(`Balance adjusted for @${adjustingUser.username}!`, 'success', 3000);
      setAdjustingUser(null);
      loadUsers();
    } catch (err: any) {
      notifyToast(`Adjustment failed: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Adjust Player Balance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBan = async (user: AdminUserListItem) => {
    const action = user.is_banned ? 'Unban' : 'Ban';
    if (!window.confirm(`${action} user @${user.username} (ID: ${user.telegram_id})?`)) return;

    try {
      haptics.impact('heavy');
      await adminService.toggleUserBan(user.id, !user.is_banned, 'Admin action');
      notifyToast(`User @${user.username} ${user.is_banned ? 'unbanned' : 'banned'}`, 'info', 2500);
      loadUsers();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Toggle Player Ban Status');
    }
  };

  const handleExportCsv = async () => {
    const url = adminService.getUsersCsvUrl();
    await downloadCsvAuthenticated(url, 'users.csv');
  };

  const handleShareTempLink = async () => {
    const tempUrl = await adminService.getTempExportDownloadLink('users');
    await openDownloadInBrowser(tempUrl, 'Users CSV');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            👥 User Management & Search
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Live debounced search, financial adjustments, and deep inspection
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCsv}
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
            📥 Export CSV
          </button>
          <button
            onClick={handleShareTempLink}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔗 Share Link
          </button>
        </div>
      </div>

      {/* Search Input Bar with 300ms Debounce */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search user by Telegram ID, Username, or Name..."
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.4rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '0.9rem',
            boxSizing: 'border-box'
          }}
        />
        <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>
          🔍
        </span>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="skeleton-glow-box" style={{ width: '100%', height: '240px', borderRadius: '16px' }} />
      ) : users.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '14px' }}>
          No users matching search query: "{searchQuery}"
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              {/* User Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #00e676, #00b0ff)',
                      color: '#060a12',
                      fontSize: '1rem',
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {(u.first_name || u.username || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: '#ffffff', fontSize: '0.98rem', fontWeight: 800 }}>
                      {u.first_name || 'Player'}
                    </h3>
                    <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 600 }}>
                      @{u.username || 'no_user'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {u.is_admin && (
                    <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      ADMIN
                    </span>
                  )}
                  {u.is_banned && (
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      BANNED
                    </span>
                  )}
                </div>
              </div>

              {/* Balances Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', background: 'rgba(0, 0, 0, 0.3)', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>USDT Cash</span>
                  <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.88rem' }}>${(u.balance_usd || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Diamonds</span>
                  <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.88rem' }}>{u.diamonds || 0} 💎</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Spins</span>
                  <span style={{ color: '#a7f3d0', fontWeight: 800, fontSize: '0.88rem' }}>{u.spins || 0} 🎡</span>
                </div>
              </div>

              {/* ID & Wallet */}
              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                Telegram ID: <strong style={{ color: '#cbd5e1' }}>{u.telegram_id}</strong>
                {u.ton_wallet && (
                  <span style={{ display: 'block', color: '#34d399', marginTop: '0.2rem' }}>
                    Wallet: {u.ton_wallet.substring(0, 8)}...{u.ton_wallet.substring(u.ton_wallet.length - 6)}
                  </span>
                )}
              </div>

              {/* Card Footer Actions */}
              <div style={{ display: 'flex', gap: '0.45rem', marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    haptics.impact('light');
                    setInspectUser(u);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🔍 Inspect
                </button>
                <button
                  onClick={() => {
                    haptics.impact('light');
                    setAdjustingUser(u);
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    borderRadius: '8px',
                    color: '#34d399',
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  💰 Balance
                </button>
                <button
                  onClick={() => handleToggleBan(u)}
                  style={{
                    background: u.is_banned ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: u.is_banned ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '8px',
                    color: u.is_banned ? '#4ade80' : '#f87171',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deep User Inspector Modal */}
      {inspectUser && (
        <UserLookupModal
          initialUser={inspectUser}
          onClose={() => setInspectUser(null)}
          onAdjustBalance={(u) => {
            setInspectUser(null);
            setAdjustingUser(u);
          }}
          onToggleBan={(u) => handleToggleBan(u)}
        />
      )}

      {/* Balance Adjuster Modal */}
      {adjustingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.8)',
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
              maxWidth: '420px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem'
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff' }}>
              Adjust User Balance
            </h3>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginBottom: '1rem' }}>
              User: <strong style={{ color: '#ffffff' }}>@{adjustingUser.username}</strong> (ID: {adjustingUser.telegram_id})
            </span>

            <form onSubmit={handleAdjustBalance} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Asset Type
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="diamonds">💎 Diamonds (Gems)</option>
                  <option value="spins">🎡 Free Spins (Tickets)</option>
                  <option value="balance_usd">💵 USDT Cash ($ USD)</option>
                </select>
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Adjustment Amount (Use negative to deduct)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Audit Reason (Mandatory for Financial Logs)
                </label>
                <input
                  type="text"
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. VIP bonus / Contest correction"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
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
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {submitting ? 'Applying...' : 'Confirm Balance Adjustment'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  style={{
                    padding: '0.75rem 1.2rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    cursor: 'pointer'
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

