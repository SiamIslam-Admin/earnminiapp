import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminFailedTransaction } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { copyTextSafe } from '../../../utils/clipboard';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const SweepsModule: React.FC = () => {
  const [transactions, setTransactions] = useState<AdminFailedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweepingId, setSweepingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSweep, setSelectedSweep] = useState<AdminFailedTransaction | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await adminService.getFailedTransactions();
      const raw = res?.data;
      let list: AdminFailedTransaction[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        const potentialArray = (raw as any).transactions || (raw as any).failed_transactions || (raw as any).items || (raw as any).sweeps || (raw as any).data;
        if (Array.isArray(potentialArray)) {
          list = potentialArray;
        }
      }
      setTransactions(list);
    } catch (err: any) {
      console.warn('Failed to load sweeps:', err);
      notifyToast(`Failed to load stuck sweeps: ${err?.message || 'Network error'}`, 'error', 3000);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleForceSweep = async (tx: AdminFailedTransaction) => {
    setSweepingId(tx.id);
    try {
      haptics.impact('heavy');
      const res = await adminService.forceSweepInvoice(tx.id);
      if (res.success) {
        haptics.notification('success');
        notifyToast(`⚡ Force sweep dispatched for Invoice #${tx.id}!`, 'success', 4000);
        setSelectedSweep(null);
        await loadTransactions();
      } else {
        haptics.notification('error');
        const errMsg = res.error || 'Server error';
        notifyToast(`Sweep failed: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Force HD Vault Sweep');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Force HD Vault Sweep');
    } finally {
      setSweepingId(null);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterStatus === 'all') return true;
    return (t.status || '').toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
            🔍 Invoices & Sweep Auditor
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            Monitor user deposit addresses, fuel BNB gas, and trigger automated HD Vault sweeps
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              haptics.impact('light');
              loadTransactions();
            }}
            disabled={loading}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh Invoices'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
        {[
          { id: 'all', label: 'All Invoices' },
          { id: 'unfunded_gas', label: '⛽ Unfunded Gas' },
          { id: 'sweep_failed', label: '⚠️ Failed Sweeps' },
          { id: 'stuck_pending', label: '⏳ Stuck Pending' }
        ].map((tab) => {
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                haptics.selection();
                setFilterStatus(tab.id);
              }}
              style={{
                background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                border: isActive ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                color: isActive ? '#38bdf8' : '#94a3b8',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sweeps Table / Empty State */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-glow-box" style={{ width: '100%', height: '56px', borderRadius: '10px' }} />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            padding: '2.5rem 1.5rem',
            borderRadius: '14px',
            textAlign: 'center',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <div style={{ fontSize: '2rem' }}>✨</div>
          <div style={{ color: '#34d399', fontWeight: 800, fontSize: '1.05rem' }}>
            All User Deposit Sweeps are Healthy!
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.82rem', maxWidth: '420px' }}>
            No stuck invoices or pending gas shoots detected. All incoming USDT transactions are being swept into the Master Vault.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem 1rem' }}>User / Invoice</th>
                <th style={{ padding: '0.75rem 1rem' }}>Deposit Address</th>
                <th style={{ padding: '0.75rem 1rem' }}>USDT Detected</th>
                <th style={{ padding: '0.75rem 1rem' }}>Gas Fuel</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => {
                const usdtVal = typeof t.usdt_detected === 'number' ? t.usdt_detected : parseFloat(t.usdt_detected as any) || 0;
                const bnbVal = typeof t.bnb_gas_needed === 'number' ? t.bnb_gas_needed : parseFloat(t.bnb_gas_needed as any) || 0;
                const statusStr = String(t.status || 'pending').replace(/_/g, ' ');

                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>@{t.username || `user_${t.telegram_id || t.user_id}`}</div>
                      <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Invoice #{t.id}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>
                          {t.deposit_address ? `${t.deposit_address.substring(0, 8)}...${t.deposit_address.substring(t.deposit_address.length - 6)}` : 'N/A'}
                        </span>
                        {t.deposit_address && (
                          <button
                            onClick={() => copyTextSafe(t.deposit_address, 'Deposit Address')}
                            title="Copy address"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '0.75rem'
                            }}
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 800 }}>
                      ${usdtVal.toFixed(2)} USDT
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#fef08a', fontWeight: 700 }}>
                      {bnbVal.toFixed(4)} BNB
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          background:
                            t.status === 'unfunded_gas'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : t.status === 'sweep_failed'
                              ? 'rgba(239, 68, 68, 0.18)'
                              : 'rgba(56, 189, 248, 0.15)',
                          color:
                            t.status === 'unfunded_gas'
                              ? '#fde047'
                              : t.status === 'sweep_failed'
                              ? '#f87171'
                              : '#38bdf8',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}
                      >
                        {statusStr}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        disabled={sweepingId === t.id}
                        onClick={() => setSelectedSweep(t)}
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <span>⚡</span>
                        <span>{sweepingId === t.id ? 'Sweeping...' : 'Force Sweep'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Force Sweep Confirmation Modal */}
      {selectedSweep && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#090d16',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem'
                }}
              >
                ⚡
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 800 }}>
                  Confirm Force Re-Sweep
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Invoice #{selectedSweep.id}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              This will automatically broadcast a <b>BNB Gas Shoot</b> to deposit address <code style={{ color: '#38bdf8' }}>{selectedSweep.deposit_address}</code> and sweep detected <b style={{ color: '#10b981' }}>${selectedSweep.usdt_detected} USDT</b> directly to Master Vault.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                onClick={() => setSelectedSweep(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={sweepingId === selectedSweep.id}
                onClick={() => handleForceSweep(selectedSweep)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                }}
              >
                {sweepingId === selectedSweep.id ? 'Sweeping...' : 'Yes, Dispatch Sweep ⚡'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
