import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminWithdrawalItem, PayoutSettings } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';
import { copyTextSafe } from '../../../utils/clipboard';
import { downloadCsvAuthenticated } from '../../../utils/csvDownloader';
import { openDownloadInBrowser } from '../../../utils/browserOpener';

export const WithdrawalsModule: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('processing');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Payout Settings (Manual vs Instant)
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({ payout_mode: 'manual' });
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Mark Manual Paid Modal
  const [manualPaidModalItem, setManualPaidModalItem] = useState<AdminWithdrawalItem | null>(null);
  const [manualTxHash, setManualTxHash] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [submittingManualPaid, setSubmittingManualPaid] = useState(false);

  // Reject Modal
  const [rejectModalItem, setRejectModalItem] = useState<AdminWithdrawalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('Suspicious activity / Invalid wallet address');
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wRes, pRes] = await Promise.all([
        adminService.getWithdrawals(statusFilter, searchQuery),
        adminService.getPayoutSettings()
      ]);
      if (wRes.data && Array.isArray(wRes.data)) {
        setWithdrawals(wRes.data);
      }
      if (pRes.data) {
        setPayoutSettings(pRes.data as any);
      }
    } catch (err: any) {
      notifyToast(`Failed to load data: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleTogglePayoutMode = async (newMode: 'manual' | 'instant') => {
    if (payoutSettings.payout_mode === newMode) return;
    setUpdatingSettings(true);
    try {
      haptics.selection();
      const res = await adminService.updatePayoutSettings({ payout_mode: newMode });
      if (res.success) {
        setPayoutSettings((prev) => ({ ...prev, payout_mode: newMode }));
        notifyToast(`✓ Switched to ${newMode === 'instant' ? 'Instant Automated Mode ⚡' : 'Manual Review Mode 🛡️'}`, 'success', 3500);
      } else {
        notifyToast(`Failed to update payout settings: ${res.error || 'Server error'}`, 'error', 3500);
        showAdminDiagnostic(res.error || 'Failed to update payout settings', 'Update Payout Mode');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Update Payout Mode');
    } finally {
      setUpdatingSettings(false);
    }
  };

  // 1. Pay on-chain from Master HD Vault
  const handlePayFromVault = async (w: AdminWithdrawalItem) => {
    const netAmt = (w.net_amount_usd ?? 0).toFixed(2);
    if (!window.confirm(`⚡ Broadcast on-chain payout of $${netAmt} USDT from Master HD Vault to:\n\n${w.destination_address}?`)) {
      return;
    }

    setProcessingId(w.id);
    try {
      haptics.impact('heavy');
      const res = await adminService.payoutWithdrawalFromVault(w.id);
      if (res.success) {
        notifyToast(`🚀 On-chain payout broadcasted! Tx: ${res.data?.tx_hash?.substring(0, 14)}...`, 'success', 4500);
        loadData();
      } else {
        const errMsg = res.error || 'Check vault BNB gas or USDT reserve balance';
        notifyToast(`Payout failed: ${errMsg}`, 'error', 4500);
        showAdminDiagnostic(errMsg, 'Master Vault Payout');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Master Vault Payout');
    } finally {
      setProcessingId(null);
    }
  };

  // 2. Mark as Paid (External Transfer)
  const handleConfirmManualPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPaidModalItem) return;

    setSubmittingManualPaid(true);
    try {
      haptics.impact('medium');
      const res = await adminService.markWithdrawalManualPaid(manualPaidModalItem.id, {
        tx_hash: manualTxHash.trim() || undefined,
        notes: manualNotes.trim() || undefined
      });
      if (res.success) {
        notifyToast(`✓ Withdrawal #${manualPaidModalItem.id} marked as Paid externally!`, 'success', 3500);
        setManualPaidModalItem(null);
        setManualTxHash('');
        setManualNotes('');
        loadData();
      } else {
        notifyToast(`Error: ${res.error || 'Could not mark paid'}`, 'error', 3500);
        showAdminDiagnostic(res.error || 'Could not mark paid', 'Mark Withdrawal Paid');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Mark Withdrawal Paid');
    } finally {
      setSubmittingManualPaid(false);
    }
  };

  // 3. Reject & Refund
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalItem) return;

    setSubmittingReject(true);
    try {
      haptics.impact('medium');
      const res = await adminService.rejectWithdrawal(rejectModalItem.id, rejectReason.trim() || 'Admin rejected');
      if (res.success) {
        notifyToast(`✕ Cashout rejected and refunded to @${rejectModalItem.username}`, 'info', 4000);
        setRejectModalItem(null);
        loadData();
      } else {
        notifyToast(`Error: ${res.error || 'Rejection failed'}`, 'error', 3500);
        showAdminDiagnostic(res.error || 'Rejection failed', 'Reject Withdrawal');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Reject Withdrawal');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleExportCsv = async () => {
    const url = adminService.getWithdrawalsCsvUrl();
    await downloadCsvAuthenticated(url, 'withdrawals.csv');
  };

  const handleShareTempLink = async () => {
    const tempUrl = await adminService.getTempExportDownloadLink('withdrawals');
    await openDownloadInBrowser(tempUrl, 'Withdrawals CSV');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & CSV Exporters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            💸 Withdrawals Cashout Queue
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Review pending cashouts, pay on-chain, or mark as paid externally</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExportCsv}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>📥</span>
            <span>Download CSV</span>
          </button>

          <button
            onClick={handleShareTempLink}
            title="Open download link in external browser"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>🌐</span>
            <span>Open in Browser</span>
          </button>
        </div>
      </div>

      {/* 1. Flexible Payout Mode Toggle Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: payoutSettings.payout_mode === 'instant' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(251, 191, 36, 0.2)',
              border: payoutSettings.payout_mode === 'instant' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem'
            }}
          >
            {payoutSettings.payout_mode === 'instant' ? '⚡' : '🛡️'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '0.98rem', fontWeight: 800 }}>
                Payout Processing Mode
              </h3>
              <span
                style={{
                  background: payoutSettings.payout_mode === 'instant' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                  color: payoutSettings.payout_mode === 'instant' ? '#34d399' : '#fbbf24',
                  border: payoutSettings.payout_mode === 'instant' ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}
              >
                {payoutSettings.payout_mode === 'instant' ? 'Instant Mode Active' : 'Manual Review Active'}
              </span>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
              {payoutSettings.payout_mode === 'instant'
                ? 'User cashouts are automatically broadcasted on-chain from Master HD Vault.'
                : 'User cashouts are held in queue for admin verification before sending funds.'}
            </span>
          </div>
        </div>

        {/* Mode Toggle Switch Pills */}
        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.4)', padding: '0.3rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            type="button"
            disabled={updatingSettings}
            onClick={() => handleTogglePayoutMode('manual')}
            style={{
              background: payoutSettings.payout_mode === 'manual' ? '#ffffff' : 'none',
              color: payoutSettings.payout_mode === 'manual' ? '#090d16' : '#94a3b8',
              border: 'none',
              borderRadius: '7px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: payoutSettings.payout_mode === 'manual' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🛡️</span>
            <span>Manual Review</span>
          </button>
          <button
            type="button"
            disabled={updatingSettings}
            onClick={() => handleTogglePayoutMode('instant')}
            style={{
              background: payoutSettings.payout_mode === 'instant' ? '#ffffff' : 'none',
              color: payoutSettings.payout_mode === 'instant' ? '#090d16' : '#94a3b8',
              border: 'none',
              borderRadius: '7px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: payoutSettings.payout_mode === 'instant' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>⚡</span>
            <span>Instant Auto</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {['all', 'processing', 'completed', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                color: statusFilter === st ? '#090d16' : '#94a3b8',
                border: statusFilter === st ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                fontWeight: statusFilter === st ? 800 : 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                boxShadow: statusFilter === st ? '0 2px 8px rgba(255,255,255,0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {st === 'processing' ? '⏳ Processing / Pending' : st}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.4rem', minWidth: '240px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search username, ID, or 0x..."
            style={{
              flex: 1,
              padding: '0.4rem 0.75rem',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Withdrawals Table */}
      {loading ? (
        <div className="skeleton-glow-box" style={{ width: '100%', height: '260px', borderRadius: '16px' }} />
      ) : withdrawals.length === 0 ? (
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '2.5rem', borderRadius: '14px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          No withdrawal requests found in this view.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem 1rem' }}>User</th>
                <th style={{ padding: '0.75rem 1rem' }}>Requested / Net</th>
                <th style={{ padding: '0.75rem 1rem' }}>Recipient BEP-20 Address</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Tx Hash / Notes</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const isPending = w.status === 'processing' || w.status === 'pending';
                const netAmount = typeof w.net_amount_usd === 'number' ? w.net_amount_usd : (w.amount_usd || 0);
                const reqAmount = typeof w.amount_usd === 'number' ? w.amount_usd : 0;
                const feeAmount = typeof w.fee_usd === 'number' ? w.fee_usd : (reqAmount * 0.02);

                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#ffffff' }}>@{w.username || 'user'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        {w.first_name ? `${w.first_name} • ` : ''}ID: {w.telegram_id}
                        {w.phone ? ` • ${w.phone}` : ''}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: '0.15rem' }}>
                        {w.created_at ? new Date(w.created_at).toLocaleString() : 'Recent'}
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.95rem' }}>
                        ${netAmount.toFixed(2)} USDT
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        Req: ${reqAmount.toFixed(2)} | Fee: ${feeAmount.toFixed(2)}
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#cbd5e1' }}>
                          {w.destination_address || '—'}
                        </span>
                        {w.destination_address && (
                          <button
                            type="button"
                            onClick={() => copyTextSafe(w.destination_address, 'BEP-20 Address')}
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              padding: '0.2rem 0.35rem'
                            }}
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          background:
                            isPending
                              ? 'rgba(245, 158, 11, 0.2)'
                              : w.status === 'completed'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                          color:
                            isPending
                              ? '#f59e0b'
                              : w.status === 'completed'
                              ? '#34d399'
                              : '#f87171',
                          border: `1px solid ${
                            isPending
                              ? 'rgba(245, 158, 11, 0.35)'
                              : w.status === 'completed'
                              ? 'rgba(16, 185, 129, 0.35)'
                              : 'rgba(239, 68, 68, 0.35)'
                          }`,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}
                      >
                        {isPending ? 'PROCESSING' : w.status}
                      </span>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      {w.tx_hash ? (
                        <a
                          href={`https://bscscan.com/tx/${w.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#38bdf8', textDecoration: 'underline', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <span>{w.tx_hash.substring(0, 10)}...{w.tx_hash.substring(w.tx_hash.length - 6)}</span>
                          <span>↗</span>
                        </a>
                      ) : w.reject_reason ? (
                        <span style={{ color: '#f87171', fontSize: '0.72rem', fontStyle: 'italic' }}>
                          Reason: {w.reject_reason}
                        </span>
                      ) : w.notes ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                          {w.notes}
                        </span>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '0.72rem' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {isPending ? (
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {/* Button 1: Pay from Vault */}
                          <button
                            type="button"
                            disabled={processingId === w.id}
                            onClick={() => handlePayFromVault(w)}
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span>⚡</span>
                            <span>{processingId === w.id ? 'Sending...' : 'Pay from Vault'}</span>
                          </button>

                          {/* Button 2: Mark as Paid (External) */}
                          <button
                            type="button"
                            disabled={processingId === w.id}
                            onClick={() => {
                              setManualPaidModalItem(w);
                              setManualTxHash('');
                              setManualNotes(`Paid externally via Binance/TrustWallet`);
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span>📝</span>
                            <span>Mark Paid</span>
                          </button>

                          {/* Button 3: Reject & Refund */}
                          <button
                            type="button"
                            disabled={processingId === w.id}
                            onClick={() => {
                              setRejectModalItem(w);
                              setRejectReason('Suspicious activity / Invalid wallet address');
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              color: '#f87171',
                              borderRadius: '6px',
                              padding: '0.35rem 0.55rem',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Mark as Paid (External Transfer) */}
      {manualPaidModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(16px)',
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
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📝</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Mark as Paid (External)</h3>
              </div>
              <button
                onClick={() => setManualPaidModalItem(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
              Use this when you have manually transferred <b>${(manualPaidModalItem.net_amount_usd ?? 0).toFixed(2)} USDT</b> to the user from Binance, TrustWallet, or an external wallet.
            </p>

            {/* Recipient Address Info Box */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '0.2rem' }}>Recipient BEP-20 Address:</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all' }}>
                  {manualPaidModalItem.destination_address}
                </span>
                <button
                  type="button"
                  onClick={() => copyTextSafe(manualPaidModalItem.destination_address, 'BEP-20 Address')}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  📋
                </button>
              </div>
            </div>

            <form onSubmit={handleConfirmManualPaid} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  External Transaction Hash (Optional):
                </label>
                <input
                  type="text"
                  value={manualTxHash}
                  onChange={(e) => setManualTxHash(e.target.value)}
                  placeholder="0x... (e.g. from Binance or BscScan)"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Admin Notes / Remarks:
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="e.g. Sent via Binance P2P"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={submittingManualPaid}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#090d16',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {submittingManualPaid ? 'Confirming...' : 'Mark as Completed ✓'}
                </button>
                <button
                  type="button"
                  onClick={() => setManualPaidModalItem(null)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
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

      {/* Modal 2: Reject & Refund Reason */}
      {rejectModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem' }}>❌</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>Reject & Refund Cashout</h3>
              </div>
              <button
                onClick={() => setRejectModalItem(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.45, margin: '0 0 1rem 0' }}>
              Rejecting will automatically refund <b>${(rejectModalItem.amount_usd ?? 0).toFixed(2)} USD</b> back to <b>@{rejectModalItem.username}</b>'s balance in the app.
            </p>

            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Rejection Reason:
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g. Invalid BEP-20 wallet address or duplicate accounts"
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={submittingReject}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {submittingReject ? 'Refunding...' : 'Confirm Rejection ❌'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalItem(null)}
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
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
