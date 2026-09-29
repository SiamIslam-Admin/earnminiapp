import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminOverviewMetrics, MasterVaultStatus } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { copyTextSafe } from '../../../utils/clipboard';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

const formatUsd = (val?: number | null): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCount = (val?: number | null): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('en-US');
};

export const OverviewModule: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [vault, setVault] = useState<MasterVaultStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Transfer Modal State (Main Admin Only)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAsset, setTransferAsset] = useState<'usdt' | 'bnb'>('usdt');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccessData, setTransferSuccessData] = useState<{
    tx_hash: string;
    asset: string;
    amount: number;
    recipient_address: string;
    explorer_url: string;
  } | null>(null);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [mRes, vRes] = await Promise.all([
        adminService.getOverviewMetrics(),
        adminService.getMasterVaultStatus()
      ]);
      if (mRes.data) setMetrics(mRes.data);
      if (vRes.data) setVault(vRes.data);
    } catch (err: any) {
      notifyToast(`Failed to refresh metrics: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyAddress = async (addr: string) => {
    await copyTextSafe(addr, 'Master Vault Address');
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAddr = recipientAddress.trim();
    const numAmount = parseFloat(transferAmount);

    if (!cleanAddr || !cleanAddr.startsWith('0x') || cleanAddr.length !== 42) {
      notifyToast('Please enter a valid 42-character BSC wallet address (0x...)', 'error', 3500);
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      notifyToast('Please enter a valid transfer amount greater than 0', 'error', 3500);
      return;
    }

    if (transferAsset === 'usdt' && vault && numAmount > (vault.usdt_reserve_balance ?? 0)) {
      const errMsg = `Insufficient USDT reserve balance in Master Vault! Available: $${formatUsd(vault.usdt_reserve_balance)}`;
      notifyToast(errMsg, 'error', 4000);
      showAdminDiagnostic(errMsg, 'Master Vault Transfer');
      return;
    }

    if (transferAsset === 'bnb' && vault && numAmount > (vault.bnb_gas_balance ?? 0)) {
      const errMsg = `Insufficient BNB gas balance in Master Vault! Available: ${vault.bnb_gas_balance} BNB`;
      notifyToast(errMsg, 'error', 4000);
      showAdminDiagnostic(errMsg, 'Master Vault Transfer');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await adminService.transferVaultFunds({
        asset: transferAsset,
        recipient_address: cleanAddr,
        amount: numAmount,
        notes: transferNotes.trim() || undefined
      });

      if (res.success && res.data) {
        setTransferSuccessData(res.data);
        notifyToast(`✓ Successfully broadcasted ${numAmount} ${transferAsset.toUpperCase()} transfer!`, 'success', 5000);
        loadData().catch(() => {});
      } else {
        const errMsg = res.error || 'Server error';
        notifyToast(`Transfer failed: ${errMsg}`, 'error', 4500);
        showAdminDiagnostic(errMsg, 'Master Vault Transfer');
      }
    } catch (err: any) {
      notifyToast(`Transfer error: ${err.message || 'Network failure'}`, 'error', 4500);
      showAdminDiagnostic(err, 'Master Vault Transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: '#94a3b8' }}>
        <div className="skeleton-glow-box" style={{ width: '100%', height: '220px', borderRadius: '16px' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header bar with Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            📊 System Overview & Master Vault
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Real-time telemetry and hot wallet reserves</span>
        </div>
        <button
          onClick={loadData}
          disabled={isRefreshing}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#38bdf8',
            borderRadius: '10px',
            padding: '0.45rem 0.85rem',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Master Vault Status Card */}
      {vault && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🏦</span>
              <h3 style={{ margin: 0, color: '#a7f3d0', fontSize: '1.05rem', fontWeight: 800 }}>
                Master Treasury Vault (BEP-20)
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Transfer Funds Button */}
              <button
                onClick={() => {
                  setTransferAsset('usdt');
                  setRecipientAddress('');
                  setTransferAmount('');
                  setTransferNotes('');
                  setTransferSuccessData(null);
                  setShowTransferModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                }}
              >
                <span>💸 Transfer Funds</span>
              </button>

              <button
                onClick={() => {
                  adminService.downloadVaultSecretsFile();
                  notifyToast('📥 Master Vault Secrets (.txt) downloaded', 'success', 3000);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <span>Backup Secrets 📥</span>
              </button>
              <span
                style={{
                  background: vault.bnb_gas_status === 'healthy' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: vault.bnb_gas_status === 'healthy' ? '#34d399' : '#f87171',
                  border: `1px solid ${vault.bnb_gas_status === 'healthy' ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}
              >
                Gas: {vault.bnb_gas_status}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', minWidth: 0 }}>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                Master Address
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <span
                  title={vault.master_address}
                  style={{
                    color: '#f1f5f9',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 'calc(100% - 30px)'
                  }}
                >
                  {vault.master_address
                    ? `${vault.master_address.substring(0, 6)}...${vault.master_address.substring(vault.master_address.length - 4)}`
                    : 'N/A'}
                </span>
                <button
                  onClick={() => copyAddress(vault.master_address)}
                  title="Copy full address"
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.45rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  📋
                </button>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', minWidth: 0 }}>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                BNB Gas Reserve
              </span>
              <span style={{ color: '#fef08a', fontSize: '1rem', fontWeight: 800 }}>
                {vault.bnb_gas_balance} BNB
              </span>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', minWidth: 0 }}>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                USDT Liquidity Reserve
              </span>
              <span style={{ color: '#34d399', fontSize: '1rem', fontWeight: 800 }}>
                ${formatUsd(vault.usdt_reserve_balance)} USDT
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Traffic Telemetry Bar (Per Min, Per Hour, Per Day, Per Month) */}
      {metrics?.traffic && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '16px',
            padding: '1.2rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🌐</span>
              <div>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.05rem', fontWeight: 800 }}>
                  Live Traffic & Active Telemetry
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Real-time Redis request rate & active unique users
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                ⚡ Live RPS: {formatCount(metrics.traffic.live_rps || 0)} /s (Peak: {formatCount(metrics.traffic.peak_rps || 0)})
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            {/* 1. Per Minute */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Per Minute</span>
                <span style={{ fontSize: '0.9rem' }}>⏱️</span>
              </div>
              <div style={{ color: '#38bdf8', fontSize: '1.3rem', fontWeight: 900 }}>
                {formatCount(metrics.traffic.live_rpm || 0)}
              </div>
              <span style={{ color: '#64748b', fontSize: '0.70rem' }}>Requests in current minute</span>
            </div>

            {/* 2. Per Hour */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Per Hour</span>
                <span style={{ fontSize: '0.9rem' }}>⏳</span>
              </div>
              <div style={{ color: '#818cf8', fontSize: '1.3rem', fontWeight: 900 }}>
                {formatCount(metrics.traffic.hour_requests || 0)}
              </div>
              <span style={{ color: '#64748b', fontSize: '0.70rem' }}>Requests in current hour</span>
            </div>

            {/* 3. Per Day */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Per Day (Today)</span>
                <span style={{ fontSize: '0.9rem' }}>📅</span>
              </div>
              <div style={{ color: '#34d399', fontSize: '1.3rem', fontWeight: 900 }}>
                {formatCount(metrics.traffic.today_requests || 0)}
              </div>
              <span style={{ color: '#64748b', fontSize: '0.70rem' }}>
                DAU: {formatCount(metrics.traffic.daily_active_users || metrics.active_users_dau || 0)} unique
              </span>
            </div>

            {/* 4. Per Month */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>Per Month</span>
                <span style={{ fontSize: '0.9rem' }}>🗓️</span>
              </div>
              <div style={{ color: '#f472b6', fontSize: '1.3rem', fontWeight: 900 }}>
                {formatCount(metrics.traffic.month_requests || 0)}
              </div>
              <span style={{ color: '#64748b', fontSize: '0.70rem' }}>
                MAU: {formatCount(metrics.traffic.monthly_active_users || metrics.active_users_mau || 0)} unique
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metric Cards Grid */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
          {/* Card 1: Deposits */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Total Deposits</span>
              <span style={{ fontSize: '1.1rem' }}>📥</span>
            </div>
            <span style={{ color: '#10b981', fontSize: '1.35rem', fontWeight: 900 }}>
              ${formatUsd(metrics.total_deposits_usd)}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Gross user on-chain deposits</span>
          </div>

          {/* Card 2: Withdrawals */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Total Cashouts</span>
              <span style={{ fontSize: '1.1rem' }}>📤</span>
            </div>
            <span style={{ color: '#f59e0b', fontSize: '1.35rem', fontWeight: 900 }}>
              ${formatUsd(metrics.total_withdrawals_usd)}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Completed player payouts</span>
          </div>

          {/* Card 3: DAU */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Daily Active Users</span>
              <span style={{ fontSize: '1.1rem' }}>👥</span>
            </div>
            <span style={{ color: '#38bdf8', fontSize: '1.35rem', fontWeight: 900 }}>
              {formatCount(metrics.active_users_dau)}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Total: {formatCount(metrics.total_registered_users)} players</span>
          </div>

          {/* Card 4: Spins Today */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Spins Played Today</span>
              <span style={{ fontSize: '1.1rem' }}>🎡</span>
            </div>
            <span style={{ color: '#c084fc', fontSize: '1.35rem', fontWeight: 900 }}>
              {formatCount(metrics.total_spins_today)}
            </span>
            <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Wheel engagement volume</span>
          </div>
        </div>
      )}

      {/* Transfer Vault Funds Modal (Main Admin Only) */}
      {showTransferModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => {
            if (!isTransferring) {
              setShowTransferModal(false);
              setTransferSuccessData(null);
            }
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              color: '#f8fafc',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>💸</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                    Transfer Master Vault Funds
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Send USDT or BNB on-chain directly from Master HD Vault
                  </span>
                </div>
              </div>
              {!isTransferring && (
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setTransferSuccessData(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#94a3b8',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {transferSuccessData ? (
              /* Success View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '2px solid #10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem'
                  }}
                >
                  ✓
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#34d399', fontSize: '1.15rem', fontWeight: 800 }}>
                    Transfer Broadcasted Successfully!
                  </h4>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    Sent <b>{transferSuccessData.amount} {transferSuccessData.asset}</b> to:
                  </span>
                  <div
                    style={{
                      marginTop: '0.4rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      color: '#38bdf8',
                      wordBreak: 'break-all'
                    }}
                  >
                    {transferSuccessData.recipient_address}
                  </div>
                </div>

                {/* Tx Hash Box */}
                <div style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '10px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Transaction Hash:</span>
                    <button
                      onClick={() => copyTextSafe(transferSuccessData.tx_hash, 'Transaction Hash')}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        borderRadius: '4px',
                        padding: '0.15rem 0.4rem',
                        fontSize: '0.72rem',
                        cursor: 'pointer'
                      }}
                    >
                      Copy Hash 📋
                    </button>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#cbd5e1', wordBreak: 'break-all' }}>
                    {transferSuccessData.tx_hash}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                  <a
                    href={transferSuccessData.explorer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      textDecoration: 'none',
                      borderRadius: '10px',
                      padding: '0.65rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span>View on BscScan ↗</span>
                  </a>
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferSuccessData(null);
                    }}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '0.65rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Transfer Form View */
              <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* 1. Asset Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Select Currency Asset
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => setTransferAsset('usdt')}
                      style={{
                        background: transferAsset === 'usdt' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${transferAsset === 'usdt' ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: '12px',
                        padding: '0.65rem 0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>💵</span>
                        <span style={{ fontWeight: 800, color: transferAsset === 'usdt' ? '#a7f3d0' : '#e2e8f0', fontSize: '0.9rem' }}>
                          USDT (BEP-20)
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                        Avail: <b style={{ color: '#34d399' }}>${formatUsd(vault?.usdt_reserve_balance)}</b>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferAsset('bnb')}
                      style={{
                        background: transferAsset === 'bnb' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${transferAsset === 'bnb' ? '#eab308' : 'rgba(255, 255, 255, 0.1)'}`,
                        borderRadius: '12px',
                        padding: '0.65rem 0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚡</span>
                        <span style={{ fontWeight: 800, color: transferAsset === 'bnb' ? '#fef08a' : '#e2e8f0', fontSize: '0.9rem' }}>
                          BNB (Gas)
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
                        Avail: <b style={{ color: '#fef08a' }}>{vault?.bnb_gas_balance ?? '0.000'} BNB</b>
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. Recipient Address */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                      Destination BSC Wallet Address
                    </label>
                    {recipientAddress.trim().startsWith('0x') && recipientAddress.trim().length === 42 && (
                      <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>✓ Valid Format</span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="0x... (Binance, Trust Wallet, MetaMask)"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      padding: '0.65rem 0.85rem',
                      color: '#f8fafc',
                      fontFamily: 'monospace',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 3. Amount */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                      Amount to Transfer
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (transferAsset === 'usdt') {
                          setTransferAmount(String(vault?.usdt_reserve_balance ?? 0));
                        } else {
                          const maxBnb = Math.max(0, (vault?.bnb_gas_balance ?? 0) - 0.001);
                          setTransferAmount(String(Number(maxBnb.toFixed(5))));
                        }
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: 'none',
                        color: '#38bdf8',
                        borderRadius: '4px',
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      MAX
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.000001"
                      placeholder={transferAsset === 'usdt' ? '10.00' : '0.05'}
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '0.65rem 0.85rem',
                        paddingRight: '4.5rem',
                        color: '#f8fafc',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: transferAsset === 'usdt' ? '#34d399' : '#fef08a',
                        fontWeight: 800,
                        fontSize: '0.8rem'
                      }}
                    >
                      {transferAsset.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* 4. Notes / Memo */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>
                    Internal Note / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Treasury withdrawal to Binance exchange"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '10px',
                      padding: '0.55rem 0.85rem',
                      color: '#f8fafc',
                      fontSize: '0.82rem',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Security Warning Notice */}
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.74rem',
                    color: '#fef08a',
                    lineHeight: 1.4
                  }}
                >
                  ⚠️ <b>On-Chain Warning:</b> This directly signs and broadcasts a live BSC Mainnet transaction from the Master HD Vault. Please double check the recipient address.
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    disabled={isTransferring}
                    onClick={() => setShowTransferModal(false)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#cbd5e1',
                      borderRadius: '10px',
                      padding: '0.7rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: isTransferring ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTransferring}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '0.7rem',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      cursor: isTransferring ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {isTransferring ? (
                      <>
                        <span>Broadcasting On-Chain...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Broadcast Transfer</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
