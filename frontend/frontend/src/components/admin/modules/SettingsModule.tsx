import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const SettingsModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingChannel, setSavingChannel] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);

  // Official Channel Gatekeeper Settings
  const [channelId, setChannelId] = useState('');
  const [channelTitle, setChannelTitle] = useState('');
  const [channelUsername, setChannelUsername] = useState('@SpinCraftNews');
  const [channelLink, setChannelLink] = useState('https://t.me/SpinCraftNews');
  const [rewardSpins, setRewardSpins] = useState('3');
  const [rewardDiamonds, setRewardDiamonds] = useState('500');
  const [verifyingChannel, setVerifyingChannel] = useState(false);
  const [channelVerified, setChannelVerified] = useState(false);
  const [showManualLinkOverride, setShowManualLinkOverride] = useState(false);

  // General Financial & System Settings
  const [feePercent, setFeePercent] = useState('2.0');
  const [minWithdrawUsd, setMinWithdrawUsd] = useState('1.00');
  const [minDepositUsd, setMinDepositUsd] = useState('0.50');
  const [enableMockSeeds, setEnableMockSeeds] = useState(false);
  const [savingDataMode, setSavingDataMode] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSystemSettings();
      if (res && res.data) {
        const s = res.data;
        if (s.official_channel_id) setChannelId(s.official_channel_id);
        if (s.official_channel_title) setChannelTitle(s.official_channel_title);
        if (s.official_channel_username) setChannelUsername(s.official_channel_username);
        if (s.official_channel_link) setChannelLink(s.official_channel_link);
        if (s.official_channel_reward_spins) setRewardSpins(String(s.official_channel_reward_spins));
        if (s.official_channel_reward_diamonds) setRewardDiamonds(String(s.official_channel_reward_diamonds));

        if (s.fee_percent) setFeePercent(s.fee_percent);
        if (s.min_withdraw_usd) setMinWithdrawUsd(s.min_withdraw_usd);
        if (s.min_deposit_usd) setMinDepositUsd(s.min_deposit_usd);
        if (s.enable_mock_seeds !== undefined) {
          setEnableMockSeeds(String(s.enable_mock_seeds) === 'true' || String(s.enable_mock_seeds) === '1');
        }
      }
    } catch (err: any) {
      console.warn('Failed to load system settings:', err);
      notifyToast('Failed to load system settings', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleAutoDetectChannel = async () => {
    const target = channelId.trim() || channelUsername.trim();
    if (!target) {
      notifyToast('Please enter a Telegram Chat ID (e.g. -100...) or @username', 'info', 3000);
      return;
    }

    setVerifyingChannel(true);
    try {
      haptics.impact('medium');
      const res = await adminService.verifyAndConnectChannel(target);
      if (res.success && res.data) {
        setChannelVerified(true);
        if (res.data.title) setChannelTitle(res.data.title);
        if (res.data.username) setChannelUsername(res.data.username);
        if (res.data.invite_link) setChannelLink(res.data.invite_link);
        if (res.data.chat_id) setChannelId(res.data.chat_id);
        haptics.notification('success');
        notifyToast(`✓ Connected: ${res.data.title}! Permanent invite link generated.`, 'success', 4000);
      } else {
        setChannelVerified(false);
        haptics.notification('error');
        const errMsg = res.error || 'Failed to detect channel. Ensure the bot is an Administrator in that chat!';
        notifyToast(errMsg, 'error', 4500);
        showAdminDiagnostic(errMsg, 'Auto-Detect Telegram Channel');
      }
    } catch (err: any) {
      setChannelVerified(false);
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 4500);
      showAdminDiagnostic(err, 'Auto-Detect Telegram Channel');
    } finally {
      setVerifyingChannel(false);
    }
  };

  const handleSaveChannelSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = channelId.trim() || channelUsername.trim();
    if (!targetId) {
      notifyToast('Please enter your Telegram Channel @username or Chat ID', 'info', 3000);
      return;
    }

    setSavingChannel(true);
    try {
      let finalLink = channelLink.trim();
      let finalTitle = channelTitle.trim();
      let finalUsername = channelUsername.trim();

      // If target is specified, attempt live bot verification and invite link auto-export
      try {
        const verifyRes = await adminService.verifyAndConnectChannel(targetId);
        if (verifyRes.success && verifyRes.data) {
          setChannelVerified(true);
          if (verifyRes.data.title) finalTitle = verifyRes.data.title;
          if (verifyRes.data.username) finalUsername = verifyRes.data.username;
          if (verifyRes.data.invite_link) finalLink = verifyRes.data.invite_link;
          setChannelTitle(finalTitle);
          setChannelUsername(finalUsername);
          setChannelLink(finalLink);
        }
      } catch {
        // Fallback: If verification fails and targetId starts with @, construct public link automatically
        if (!finalLink && targetId.startsWith('@')) {
          finalLink = `https://t.me/${targetId.replace('@', '')}`;
          setChannelLink(finalLink);
        }
      }

      const payload: Record<string, string> = {
        official_channel_id: targetId,
        official_channel_title: finalTitle || 'Official Telegram Channel',
        official_channel_username: finalUsername || (targetId.startsWith('@') ? targetId : ''),
        official_channel_link: finalLink || (targetId.startsWith('@') ? `https://t.me/${targetId.replace('@', '')}` : ''),
        official_channel_reward_spins: String(parseInt(rewardSpins, 10) || 3),
        official_channel_reward_diamonds: String(parseInt(rewardDiamonds, 10) || 500)
      };

      const res = await adminService.updateSystemSettings(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast('✓ Official Telegram Channel Gatekeeper saved! Link auto-generated.', 'success', 3500);
      } else {
        haptics.notification('error');
        notifyToast(res.error || 'Failed to save channel settings', 'error', 3500);
        showAdminDiagnostic(res.error || 'Failed to save channel settings', 'Save Channel Gatekeeper Settings');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Channel Gatekeeper Settings');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleSaveFinancialSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFinancial(true);
    try {
      const payload: Record<string, string> = {
        fee_percent: feePercent.trim() !== '' ? feePercent.trim() : '2.0',
        min_withdraw_usd: minWithdrawUsd.trim() !== '' ? minWithdrawUsd.trim() : '0.00',
        min_withdrawal_usd: minWithdrawUsd.trim() !== '' ? minWithdrawUsd.trim() : '0.00',
        min_deposit_usd: minDepositUsd.trim() !== '' ? minDepositUsd.trim() : '0.00'
      };

      const res = await adminService.updateSystemSettings(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast('✓ Global Financial & Payout rules saved!', 'success', 3500);
      } else {
        haptics.notification('error');
        notifyToast(res.error || 'Failed to save financial settings', 'error', 3500);
        showAdminDiagnostic(res.error || 'Failed to save financial settings', 'Save Financial Settings');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Financial Settings');
    } finally {
      setSavingFinancial(false);
    }
  };

  const handleToggleMockSeeds = async (val: boolean) => {
    setEnableMockSeeds(val);
    setSavingDataMode(true);
    try {
      const res = await adminService.updateSystemSettings({
        enable_mock_seeds: val ? 'true' : 'false'
      });
      if (res.success) {
        haptics.notification('success');
        notifyToast(
          val
            ? '✓ Mock seeds enabled for tournament preview.'
            : '✓ 100% Real Live Data Mode activated! Only real player scores will show.',
          'success',
          3500
        );
      } else {
        haptics.notification('error');
        notifyToast(res.error || 'Failed to update data mode', 'error', 3000);
        showAdminDiagnostic(res.error || 'Failed to update data mode', 'Update Data Mode');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Update Data Mode');
    } finally {
      setSavingDataMode(false);
    }
  };

  const handleTestLink = () => {
    const link = channelLink.trim() || 'https://t.me/SpinCraftNews';
    window.open(link, '_blank');
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading System &amp; Gatekeeper Settings...
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span>
            <span>System &amp; Gatekeeper Settings</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Configure official Telegram channel join barriers, out-of-spins rewards, and platform parameters.
          </p>
        </div>

        <button
          onClick={loadSettings}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '0.45rem 0.85rem',
            color: '#cbd5e1',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. Official Telegram Channel Gatekeeper Card */}
      <div
        style={{
          background: '#0e1422',
          border: '1px solid rgba(42, 171, 238, 0.35)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(42, 171, 238, 0.4)'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M21.5 2.5L2.5 10.5L9.5 13.5L18.5 6.5L11.5 15.5L18.5 20.5L21.5 2.5Z"
                fill="#ffffff"
              />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
              Official Telegram Channel Gatekeeper
            </h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.76rem', color: '#38bdf8' }}>
              Triggered automatically when players run out of spins to drive organic channel growth.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveChannelSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Telegram Chat ID or Username */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Official Telegram Channel (@username or Chat ID)
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={channelId || channelUsername}
                  onChange={(e) => {
                    setChannelId(e.target.value);
                    if (e.target.value.startsWith('@')) {
                      setChannelUsername(e.target.value);
                    }
                  }}
                  placeholder="@MyChannel or -1002345678901"
                  style={{
                    flex: '1 1 240px',
                    background: '#070a12',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.85rem',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={handleAutoDetectChannel}
                  disabled={verifyingChannel}
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 0.95rem',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: verifyingChannel ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                  }}
                >
                  {verifyingChannel ? '⏳ Detecting...' : '🔍 Connect & Auto-Export Link'}
                </button>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Simply enter your Channel handle or Chat ID. The bot automatically creates and links the permanent invite link.
              </span>
            </div>

            {/* Live Auto-Generated Link Status & Preview Badge */}
            <div
              style={{
                gridColumn: '1 / -1',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>{channelVerified ? '🛡️' : '📢'}</span>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                    {channelTitle || 'No Channel Connected'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: channelLink ? '#38bdf8' : '#64748b', wordBreak: 'break-all' }}>
                    {channelLink || 'Invite link will be generated automatically when saved'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {channelLink && (
                  <button
                    type="button"
                    onClick={handleTestLink}
                    title="Open Link in New Tab"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.65rem',
                      color: '#38bdf8',
                      fontWeight: 700,
                      fontSize: '0.74rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔗 Test Link
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowManualLinkOverride(!showManualLinkOverride)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {showManualLinkOverride ? 'Hide Custom URL' : 'Override URL (Optional)'}
                </button>
              </div>
            </div>

            {/* Optional Manual Link Override */}
            {showManualLinkOverride && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                  Custom Redirect URL (Optional Override)
                </label>
                <input
                  type="url"
                  value={channelLink}
                  onChange={(e) => setChannelLink(e.target.value)}
                  placeholder="https://t.me/yourlink"
                  style={{
                    width: '100%',
                    background: '#070a12',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Reward Spins */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Reward Spins (+Spins)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={rewardSpins}
                onChange={(e) => setRewardSpins(e.target.value)}
                placeholder="3"
                style={{
                  width: '100%',
                  background: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Free spins awarded upon Telegram membership verification (Default: 3).
              </span>
            </div>

            {/* Reward Diamonds */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Reward Diamonds (+💎)
              </label>
              <input
                type="number"
                min="0"
                max="50000"
                value={rewardDiamonds}
                onChange={(e) => setRewardDiamonds(e.target.value)}
                placeholder="500"
                style={{
                  width: '100%',
                  background: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                Diamonds awarded alongside free spins (Default: 500).
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={savingChannel}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid #38bdf8',
                borderRadius: '8px',
                padding: '0.6rem 1.4rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: savingChannel ? 'wait' : 'pointer',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>💾</span>
              <span>{savingChannel ? 'Saving Changes...' : 'Save Gatekeeper Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Platform Financial & Cashout Parameters Card */}
      <div
        style={{
          background: '#0e1422',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(5, 150, 105, 0.4)'
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>💸</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
              Platform Payout &amp; Deposit Parameters
            </h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
              Universal minimums, gas buffers, and cashout commission percentages.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveFinancialSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Min Cashout */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Minimum Cashout ($ USD)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minWithdrawUsd}
                onChange={(e) => setMinWithdrawUsd(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  background: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                Set to 0.00 for no minimum restriction.
              </span>
            </div>

            {/* Min Deposit */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Minimum Crypto Deposit ($ USD)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minDepositUsd}
                onChange={(e) => setMinDepositUsd(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  background: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                Set to 0.00 for micro-deposits / no minimum.
              </span>
            </div>

            {/* Gas Fee Percent */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Cashout Fee (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
                placeholder="2.0"
                style={{
                  width: '100%',
                  background: '#070a12',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.6rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={savingFinancial}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '0.6rem 1.4rem',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: savingFinancial ? 'wait' : 'pointer',
                boxShadow: '0 2px 10px rgba(5, 150, 105, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>💾</span>
              <span>{savingFinancial ? 'Saving...' : 'Save Financial Rules'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card 3: Tournament Leaderboard & Data Mode */}
      <div
        style={{
          background: 'linear-gradient(180deg, #111827 0%, #0b0f19 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🏆</span>
              <span>Tournament &amp; Contest Data Mode</span>
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Switch between 100% Real Live Players mode and Demo Placeholder Competitor seeds.
            </p>
          </div>

          <button
            onClick={() => handleToggleMockSeeds(!enableMockSeeds)}
            disabled={savingDataMode}
            style={{
              background: enableMockSeeds
                ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              border: enableMockSeeds ? '1px solid #f59e0b' : '1px solid #10b981',
              borderRadius: '20px',
              padding: '0.45rem 1.1rem',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: savingDataMode ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: enableMockSeeds ? '0 2px 10px rgba(217, 119, 6, 0.4)' : '0 2px 10px rgba(5, 150, 105, 0.4)'
            }}
          >
            <span>{enableMockSeeds ? '🟡 Demo Seeds Active' : '🟢 100% Real Live Data Active'}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>({enableMockSeeds ? 'Switch to Real' : 'Switch to Demo'})</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModule;
