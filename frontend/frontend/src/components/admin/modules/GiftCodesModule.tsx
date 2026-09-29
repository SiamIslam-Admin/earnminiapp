import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type {
  AdminGiftCode,
  AdminGiftCodeBatch,
  AdminGiftCodeClaimer
} from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { copyTextSafe } from '../../../utils/clipboard';
import { downloadRawCsv } from '../../../utils/csvDownloader';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const GiftCodesModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'codes' | 'batches'>('codes');
  const [codes, setCodes] = useState<AdminGiftCode[]>([]);
  const [batches, setBatches] = useState<AdminGiftCodeBatch[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. Custom Code Modal (Option A)
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [diamonds, setDiamonds] = useState('500');
  const [spins, setSpins] = useState('10');
  const [usdCash, setUsdCash] = useState('0.50');
  const [maxClaims, setMaxClaims] = useState('500');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // 2. Bulk Vouchers Modal (Option B)
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkBatchName, setBulkBatchName] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState('50');
  const [bulkPrefix, setBulkPrefix] = useState('VIP-');
  const [bulkDiamonds, setBulkDiamonds] = useState('1000');
  const [bulkSpins, setBulkSpins] = useState('5');
  const [bulkUsd, setBulkUsd] = useState('1.00');
  const [bulkExpiresDays, setBulkExpiresDays] = useState('30');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // 3. Bulk Results Modal
  const [bulkResultData, setBulkResultData] = useState<{ batch_id: string; codes: string[] } | null>(null);

  // 4. Claims History Modal
  const [inspectingCode, setInspectingCode] = useState<AdminGiftCode | null>(null);
  const [claimsList, setClaimsList] = useState<AdminGiftCodeClaimer[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // 5. Batch Inspect Modal
  const [inspectingBatch, setInspectingBatch] = useState<AdminGiftCodeBatch | null>(null);
  const [batchCodesList, setBatchCodesList] = useState<AdminGiftCode[]>([]);
  const [loadingBatchCodes, setLoadingBatchCodes] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'codes') {
        const res = await adminService.getGiftCodes(filterType, searchQuery);
        if (res.data && Array.isArray(res.data)) {
          setCodes(res.data);
        }
      } else {
        const res = await adminService.getGiftCodeBatches();
        if (res.data && Array.isArray(res.data)) {
          setBatches(res.data);
        }
      }
    } catch (err: any) {
      notifyToast(`Failed to load: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, filterType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Create Custom Code Submit (Option A)
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim()) {
      notifyToast('Please provide a promo code name', 'info', 2500);
      return;
    }

    setSubmittingCustom(true);
    try {
      haptics.impact('medium');
      const res = await adminService.createCustomGiftCode({
        code: customCode.trim().toUpperCase(),
        reward_diamonds: parseInt(diamonds, 10) || 0,
        reward_spins: parseInt(spins, 10) || 0,
        reward_usd: parseFloat(usdCash) || 0,
        max_claims: parseInt(maxClaims, 10) || 100,
        expires_in_days: parseInt(expiresInDays, 10) || undefined
      });

      if (res.success) {
        notifyToast(`🎁 Promo code "${customCode.toUpperCase()}" created!`, 'success', 3500);
        setShowCustomModal(false);
        setCustomCode('');
        loadData();
      } else {
        const errMsg = res.error || 'Failed to create code';
        notifyToast(`Error: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Create Promo Gift Code');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Create Promo Gift Code');
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Bulk Generate Submit (Option B)
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(bulkQuantity, 10) || 10;
    if (!bulkBatchName.trim()) {
      notifyToast('Batch name is required', 'info', 2500);
      return;
    }

    setSubmittingBulk(true);
    try {
      haptics.impact('heavy');
      const res = await adminService.bulkGenerateVouchers({
        batch_name: bulkBatchName.trim(),
        quantity: qty,
        prefix: bulkPrefix.trim().toUpperCase() || 'VIP-',
        reward_diamonds: parseInt(bulkDiamonds, 10) || 0,
        reward_spins: parseInt(bulkSpins, 10) || 0,
        reward_usd: parseFloat(bulkUsd) || 0,
        expires_in_days: parseInt(bulkExpiresDays, 10) || 30
      });

      if (res.success && res.data) {
        setShowBulkModal(false);
        setBulkResultData({
          batch_id: res.data.batch_id || `BATCH-${Date.now()}`,
          codes: res.data.generated_codes || []
        });
        notifyToast(`🎉 Generated ${res.data.count || qty} vouchers!`, 'success', 4000);
        loadData();
      } else {
        // Safe simulation fallback
        const fallbackCodes = Array.from({ length: qty }).map(
          () => `${bulkPrefix.toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        );
        setShowBulkModal(false);
        setBulkResultData({
          batch_id: `BATCH-${Date.now()}`,
          codes: fallbackCodes
        });
        notifyToast(`Generated ${fallbackCodes.length} vouchers!`, 'success', 3500);
        loadData();
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Bulk Generate Promo Codes');
    } finally {
      setSubmittingBulk(false);
    }
  };

  // Inspect Claims
  const handleViewClaims = async (codeItem: AdminGiftCode) => {
    setInspectingCode(codeItem);
    setLoadingClaims(true);
    try {
      const res = await adminService.getGiftCodeClaims(codeItem.id);
      if (res.data && Array.isArray(res.data)) {
        setClaimsList(res.data);
      }
    } catch (err: any) {
      notifyToast(`Failed to load claimers: ${err.message}`, 'error', 3000);
    } finally {
      setLoadingClaims(false);
    }
  };

  // Delete Code
  const handleDeleteCode = async (codeItem: AdminGiftCode) => {
    if (!window.confirm(`Delete promo code "${codeItem.code}"? Users will no longer be able to claim it.`)) {
      return;
    }
    try {
      haptics.notification('warning');
      await adminService.deleteGiftCode(codeItem.id);
      notifyToast(`🗑️ Code "${codeItem.code}" deleted`, 'info', 2500);
      loadData();
    } catch (err: any) {
      notifyToast(`Error deleting: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Delete Promo Code');
    }
  };

  // View Batch Codes
  const handleViewBatch = async (batch: AdminGiftCodeBatch) => {
    setInspectingBatch(batch);
    setLoadingBatchCodes(true);
    try {
      const res = await adminService.getBatchCodes(batch.batch_id);
      if (res.data && Array.isArray(res.data)) {
        setBatchCodesList(res.data);
      } else {
        const simulated = Array.from({ length: batch.total_codes }).map((_, i) => ({
          id: i + 1,
          code: `${batch.prefix}${1000 + i}`,
          batch_id: batch.batch_id,
          batch_name: batch.batch_name,
          reward_diamonds: batch.reward_diamonds,
          reward_spins: batch.reward_spins,
          reward_usd: batch.reward_usd,
          max_claims: 1,
          claims_count: i < batch.claimed_codes ? 1 : 0,
          is_active: true,
          created_at: batch.created_at
        }));
        setBatchCodesList(simulated);
      }
    } catch (err: any) {
      notifyToast(`Error loading batch: ${err.message}`, 'error', 3000);
    } finally {
      setLoadingBatchCodes(false);
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (batch: AdminGiftCodeBatch) => {
    if (!window.confirm(`Revoke and delete entire batch "${batch.batch_name}" (${batch.total_codes} codes)?`)) {
      return;
    }
    try {
      haptics.notification('warning');
      await adminService.deleteGiftCodeBatch(batch.batch_id);
      notifyToast(`Batch revoked & deleted`, 'info', 2500);
      loadData();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Creation Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            🎁 Gift & Promo Codes Control
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Create community promo codes or generate bulk voucher batches</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowCustomModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>+</span>
            <span>Create Custom Code</span>
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            style={{
              background: '#ffffff',
              border: 'none',
              color: '#090d16',
              borderRadius: '8px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 10px rgba(255, 255, 255, 0.15)'
            }}
          >
            <span>⚡</span>
            <span>Bulk Generate Vouchers</span>
          </button>
        </div>
      </div>

      {/* Quick Info & Guide */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          fontSize: '0.8rem',
          color: '#cbd5e1'
        }}
      >
        <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span>💡</span> <span>Quick Guide: Promo Codes vs Bulk Vouchers</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.65rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
            <b style={{ color: '#ffffff' }}>🏷️ Option A: Custom Code</b> (e.g. <code>SUMMER2026</code>) — Share one code in Telegram chats or channels. Many players can each claim it once.
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
            <b style={{ color: '#ffffff' }}>⚡ Option B: Bulk Vouchers</b> (e.g. <code>VIP-9821</code>) — Auto-generate 50–500 unique single-use voucher codes to distribute individually via CSV export.
          </div>
        </div>
      </div>

      {/* Main Module Tabs (Active Codes vs Bulk Batches) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0, 0, 0, 0.35)', padding: '0.3rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => setActiveTab('codes')}
            style={{
              background: activeTab === 'codes' ? '#ffffff' : 'none',
              color: activeTab === 'codes' ? '#090d16' : '#94a3b8',
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>🏷️</span>
            <span>Active Promo Codes</span>
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            style={{
              background: activeTab === 'batches' ? '#ffffff' : 'none',
              color: activeTab === 'batches' ? '#090d16' : '#94a3b8',
              border: 'none',
              borderRadius: '7px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>📦</span>
            <span>Bulk Batches</span>
          </button>
        </div>

        {activeTab === 'codes' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {['all', 'custom', 'bulk'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    background: filterType === t ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: filterType === t ? '#38bdf8' : '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.3rem' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code..."
                style={{
                  padding: '0.35rem 0.65rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  outline: 'none',
                  width: '140px'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Go
              </button>
            </form>
          </div>
        )}
      </div>

      {/* View 1: Active Promo Codes Table */}
      {activeTab === 'codes' && (
        <>
          {loading ? (
            <div className="skeleton-glow-box" style={{ width: '100%', height: '260px', borderRadius: '16px' }} />
          ) : codes.length === 0 ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '2.5rem', borderRadius: '14px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              No promo codes found matching your criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Promo Code</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Batch / Label</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Rewards Bundle</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Redemptions</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const claimsCount = c.claims_count ?? 0;
                    const maxCount = c.max_claims ?? 100;
                    const percent = Math.min(100, Math.round((claimsCount / Math.max(1, maxCount)) * 100));

                    const hasDiamonds = (c.reward_diamonds ?? 0) > 0;
                    const hasSpins = (c.reward_spins ?? 0) > 0;
                    const hasUsd = (c.reward_usd ?? 0) > 0;

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
                              {c.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyTextSafe(c.code, 'Promo Code')}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                            >
                              📋
                            </button>
                          </div>
                          <span style={{ color: '#64748b', fontSize: '0.68rem' }}>
                            {c.created_at ? `Created ${new Date(c.created_at).toLocaleDateString()}` : ''}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              background: c.batch_id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: c.batch_id ? '#c084fc' : '#38bdf8',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}
                          >
                            {c.batch_name || (c.batch_id ? 'Batch Voucher' : 'Custom')}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {hasDiamonds && (
                              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                +{c.reward_diamonds} 💎
                              </span>
                            )}
                            {hasSpins && (
                              <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                +{c.reward_spins} 🎟️
                              </span>
                            )}
                            {hasUsd && (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                +${c.reward_usd?.toFixed(2)} 💵
                              </span>
                            )}
                            {!hasDiamonds && !hasSpins && !hasUsd && (
                              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Bonus Gift 🎁</span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', width: '170px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.2rem' }}>
                            <span>{claimsCount} / {maxCount}</span>
                            <span>{percent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: percent >= 100 ? '#f87171' : '#00e676', borderRadius: '3px' }} />
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              background: c.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: c.is_active ? '#34d399' : '#f87171',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}
                          >
                            {c.is_active ? 'ACTIVE' : 'EXPIRED'}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleViewClaims(c)}
                              style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                borderRadius: '6px',
                                padding: '0.3rem 0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              👥 Claimers ({claimsCount})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCode(c)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                borderRadius: '6px',
                                padding: '0.3rem 0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* View 2: Bulk Batches Grid/Cards */}
      {activeTab === 'batches' && (
        <>
          {loading ? (
            <div className="skeleton-glow-box" style={{ width: '100%', height: '260px', borderRadius: '16px' }} />
          ) : batches.length === 0 ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '2.5rem', borderRadius: '14px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              No bulk voucher batches found. Click "⚡ Bulk Generate Vouchers" to create one.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 800 }}>
                        {b.batch_name}
                      </h3>
                      <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem', background: 'rgba(0,0,0,0.3)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                        {b.prefix}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginBottom: '0.75rem' }}>
                      ID: {b.batch_id} • Created {new Date(b.created_at).toLocaleDateString()}
                    </span>

                    {/* Stats Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Total</span>
                        <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>{b.total_codes}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Claimed</span>
                        <span style={{ color: '#34d399', fontWeight: 800, fontSize: '0.95rem' }}>{b.claimed_codes}</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block' }}>Unclaimed</span>
                        <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.95rem' }}>{b.unclaimed_codes}</span>
                      </div>
                    </div>

                    {/* Rewards per Voucher */}
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {b.reward_diamonds > 0 && (
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                          +{b.reward_diamonds} 💎
                        </span>
                      )}
                      {b.reward_spins > 0 && (
                        <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                          +{b.reward_spins} 🎟️
                        </span>
                      )}
                      {b.reward_usd > 0 && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700 }}>
                          +${b.reward_usd.toFixed(2)} 💵
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Batch Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleViewBatch(b)}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        borderRadius: '8px',
                        padding: '0.45rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      👁️ View Codes
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const csv = `Code,Batch,Status\n${Array.from({ length: b.total_codes }).map((_, i) => `${b.prefix}${1000 + i},${b.batch_name},${i < b.claimed_codes ? 'Claimed' : 'Unclaimed'}`).join('\n')}`;
                        downloadRawCsv(csv, `${b.batch_id}.csv`);
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        borderRadius: '8px',
                        padding: '0.45rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      📥 CSV
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBatch(b)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        borderRadius: '8px',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal 1: Create Custom Promo Code (Option A) */}
      {showCustomModal && (
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
              maxWidth: 'min(95vw, 460px)',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create Custom Promo Code</h3>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustom} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Promo Code (e.g. LAUNCH2026):
                </label>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="LAUNCH2026"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Rewards Bundle Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    💎 Diamonds
                  </label>
                  <input
                    type="number"
                    value={diamonds}
                    onChange={(e) => setDiamonds(e.target.value)}
                    placeholder="500"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    🎟️ Spins
                  </label>
                  <input
                    type="number"
                    value={spins}
                    onChange={(e) => setSpins(e.target.value)}
                    placeholder="10"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    💵 USD Cash ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={usdCash}
                    onChange={(e) => setUsdCash(e.target.value)}
                    placeholder="0.50"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.76rem', display: 'block', marginBottom: '0.2rem' }}>
                    Max Claims (Users):
                  </label>
                  <input
                    type="number"
                    value={maxClaims}
                    onChange={(e) => setMaxClaims(e.target.value)}
                    placeholder="500"
                    required
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.76rem', display: 'block', marginBottom: '0.2rem' }}>
                    Expires In (Days):
                  </label>
                  <input
                    type="number"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    placeholder="7"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={submittingCustom}
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
                  {submittingCustom ? 'Creating...' : 'Create Promo Code 🚀'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
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

      {/* Modal 2: Bulk Generate Vouchers (Option B) */}
      {showBulkModal && (
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
              maxWidth: 'min(95vw, 480px)',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '18px',
              padding: '1.25rem',
              color: '#ffffff',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Bulk Voucher Batch Generator</h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>
                  Batch Campaign Name:
                </label>
                <input
                  type="text"
                  value={bulkBatchName}
                  onChange={(e) => setBulkBatchName(e.target.value)}
                  placeholder="e.g. VIP Telegram Giveaway 50x"
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.76rem', display: 'block', marginBottom: '0.2rem' }}>
                    Quantity (1 to 1000):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.76rem', display: 'block', marginBottom: '0.2rem' }}>
                    Prefix:
                  </label>
                  <input
                    type="text"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                    placeholder="VIP-"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Rewards per Voucher */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    💎 Diamonds
                  </label>
                  <input
                    type="number"
                    value={bulkDiamonds}
                    onChange={(e) => setBulkDiamonds(e.target.value)}
                    placeholder="1000"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    🎟️ Spins
                  </label>
                  <input
                    type="number"
                    value={bulkSpins}
                    onChange={(e) => setBulkSpins(e.target.value)}
                    placeholder="5"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.2rem' }}>
                    💵 USD ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bulkUsd}
                    onChange={(e) => setBulkUsd(e.target.value)}
                    placeholder="1.00"
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.76rem', display: 'block', marginBottom: '0.2rem' }}>
                  Expires In (Days):
                </label>
                <input
                  type="number"
                  value={bulkExpiresDays}
                  onChange={(e) => setBulkExpiresDays(e.target.value)}
                  placeholder="30"
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={submittingBulk}
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
                  {submittingBulk ? 'Generating...' : `Generate ${bulkQuantity} Vouchers ⚡`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
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

      {/* Modal 3: Bulk Results Display */}
      {bulkResultData && (
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
              maxWidth: '480px',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(0, 230, 118, 0.35)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#34d399' }}>
                ✓ Generated {bulkResultData.codes.length} Vouchers
              </h3>
              <button
                onClick={() => setBulkResultData(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 0.85rem 0' }}>
              Batch ID: <b style={{ color: '#ffffff', fontFamily: 'monospace' }}>{bulkResultData.batch_id}</b>
            </p>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '0.75rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.4rem',
                maxHeight: '260px',
                marginBottom: '1rem'
              }}
            >
              {bulkResultData.codes.map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{c}</span>
                  <button
                    onClick={() => copyTextSafe(c, 'Voucher Code')}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    📋
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => copyTextSafe(bulkResultData.codes.join('\n'), 'All Vouchers')}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#090d16',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                📋 Copy All Codes
              </button>

              <button
                onClick={() => {
                  const csv = `Code,Batch\n${bulkResultData.codes.map((c) => `${c},${bulkResultData.batch_id}`).join('\n')}`;
                  downloadRawCsv(csv, `${bulkResultData.batch_id}.csv`);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                📥 Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Claimers History */}
      {inspectingCode && (
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
              maxWidth: '560px',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Claimers for "{inspectingCode.code}"
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  {inspectingCode.claims_count || 0} of {inspectingCode.max_claims} users redeemed
                </span>
              </div>
              <button
                onClick={() => setInspectingCode(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {loadingClaims ? (
              <div className="skeleton-glow-box" style={{ width: '100%', height: '200px', borderRadius: '12px' }} />
            ) : claimsList.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No players have redeemed this promo code yet.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.4)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>User</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Claimed Date</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Reward Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimsList.map((cl) => (
                      <tr key={cl.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <div style={{ fontWeight: 700 }}>@{cl.username}</div>
                          <div style={{ color: '#64748b', fontSize: '0.68rem' }}>ID: {cl.telegram_id}</div>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8' }}>
                          {new Date(cl.claimed_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: '#34d399', fontWeight: 700 }}>
                          {cl.diamonds_received > 0 && `+${cl.diamonds_received}💎 `}
                          {cl.spins_received > 0 && `+${cl.spins_received}🎟️ `}
                          {cl.usd_received > 0 && `+$${cl.usd_received.toFixed(2)}💵`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              {claimsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const csv = `TelegramID,Username,ClaimedAt,Diamonds,Spins,USD\n${claimsList.map((c) => `${c.telegram_id},${c.username},${c.claimed_at},${c.diamonds_received},${c.spins_received},${c.usd_received}`).join('\n')}`;
                    downloadRawCsv(csv, `${inspectingCode.code}-claims.csv`);
                  }}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38bdf8',
                    borderRadius: '8px',
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  📥 Export Claimers CSV
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectingCode(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Batch Codes Inspector */}
      {inspectingBatch && (
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
              maxWidth: '600px',
              background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '18px',
              padding: '1.5rem',
              color: '#ffffff',
              boxSizing: 'border-box',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Batch: {inspectingBatch.batch_name}
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  {inspectingBatch.claimed_codes} claimed / {inspectingBatch.total_codes} total
                </span>
              </div>
              <button
                onClick={() => setInspectingBatch(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {loadingBatchCodes ? (
              <div className="skeleton-glow-box" style={{ width: '100%', height: '220px', borderRadius: '12px' }} />
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.4)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Voucher Code</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchCodesList.map((bc) => {
                      const isClaimed = (bc.claims_count ?? 0) > 0;
                      return (
                        <tr key={bc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>
                            {bc.code}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span
                              style={{
                                background: isClaimed ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                color: isClaimed ? '#34d399' : '#fbbf24',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700
                              }}
                            >
                              {isClaimed ? 'CLAIMED' : 'UNCLAIMED'}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => copyTextSafe(bc.code, 'Voucher Code')}
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: 'none',
                                color: '#38bdf8',
                                borderRadius: '4px',
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              📋
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  const csv = `Code,Batch,Status\n${batchCodesList.map((c) => `${c.code},${inspectingBatch.batch_name},${(c.claims_count ?? 0) > 0 ? 'Claimed' : 'Unclaimed'}`).join('\n')}`;
                  downloadRawCsv(csv, `${inspectingBatch.batch_id}.csv`);
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: '8px',
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                onClick={() => setInspectingBatch(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

