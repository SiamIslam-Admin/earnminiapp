import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminReferralRewardSettings } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const ReferralSettingsModule: React.FC = () => {
  const [settings, setSettings] = useState<AdminReferralRewardSettings>({
    initial_organic_spins: 15,
    referrer_spins: 2,
    referrer_diamonds: 500,
    referrer_usd: 0.10,
    welcome_spins: 5,
    welcome_diamonds: 1000,
    welcome_usd: 0.25
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await adminService.getReferralRewards();
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err: any) {
      notifyToast(`Failed to load referral rules: ${err?.message || 'Error'}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (field: keyof AdminReferralRewardSettings, val: number) => {
    setSettings((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      haptics.impact('medium');
      const payload: AdminReferralRewardSettings = {
        initial_organic_spins: Number(settings.initial_organic_spins ?? settings.initialOrganicSpins) || 15,
        referrer_spins: Number(settings.referrer_spins) || 0,
        referrer_diamonds: Number(settings.referrer_diamonds) || 0,
        referrer_usd: Number(settings.referrer_usd) || 0,
        welcome_spins: Number(settings.welcome_spins) || 0,
        welcome_diamonds: Number(settings.welcome_diamonds) || 0,
        welcome_usd: Number(settings.welcome_usd) || 0
      };

      const res = await adminService.updateReferralRewards(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast('👥 Referral Multi-Asset & Starting Rules saved successfully!', 'success', 3500);
        loadSettings();
      } else {
        haptics.notification('error');
        const errMsg = res.error || res.message || 'Failed to save referral rules';
        notifyToast(`Save failed: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Save Referral Settings');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err?.message || 'Failed to save'}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Referral Settings');
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
            👥 Referral Multi-Asset & Starting Rewards
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            Configure organic starting spins, welcome gifts for new players, and invite bonuses for referrers
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              haptics.impact('light');
              loadSettings();
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
            <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div className="skeleton-glow-box" style={{ height: '240px', borderRadius: '16px' }} />
          <div className="skeleton-glow-box" style={{ height: '240px', borderRadius: '16px' }} />
          <div className="skeleton-glow-box" style={{ height: '240px', borderRadius: '16px' }} />
        </div>
      ) : (
        <>
          {/* Card 0: Direct (Organic) Starting Spins */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '16px',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}
              >
                🎯
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.05rem', fontWeight: 800 }}>
                  Direct (Organic) Starting Spins
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  Granted immediately to new players who open the Mini App without any referral/invite link
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#a7f3d0', fontSize: '0.85rem', fontWeight: 700 }}>Starting Spins:</span>
              <input
                type="number"
                min="0"
                value={settings.initial_organic_spins ?? settings.initialOrganicSpins ?? 15}
                onChange={(e) => handleChange('initial_organic_spins', parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '90px',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 900,
                  textAlign: 'center'
                }}
              />
              <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 800 }}>🎡 Spins</span>
            </div>
          </div>

          {/* 2-Card Grid: Inviter & Referee */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Card 1: Inviter (Referrer) Rewards */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(251, 191, 36, 0.15)',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                  }}
                >
                  🎁
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 800 }}>
                    Inviter (Referrer) Rewards
                  </h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Multi-asset reward credited for each successful invited friend
                  </span>
                </div>
              </div>

              {/* Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    🎡 Free Spins per Invite
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.referrer_spins}
                    onChange={(e) => handleChange('referrer_spins', parseInt(e.target.value, 10) || 0)}
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
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    💎 Diamonds per Invite
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.referrer_diamonds}
                    onChange={(e) => handleChange('referrer_diamonds', parseInt(e.target.value, 10) || 0)}
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
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    💵 USD Cash per Invite ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.referrer_usd}
                    onChange={(e) => handleChange('referrer_usd', parseFloat(e.target.value) || 0)}
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
              </div>
            </div>

            {/* Card 2: New Player (Referee) Welcome Gifts */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                  }}
                >
                  🌟
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 800 }}>
                    New Player Welcome Gift
                  </h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Welcome assets awarded when joining via an invite link
                  </span>
                </div>
              </div>

              {/* Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    🎡 Welcome Spins
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.welcome_spins}
                    onChange={(e) => handleChange('welcome_spins', parseInt(e.target.value, 10) || 0)}
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
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    💎 Welcome Diamonds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.welcome_diamonds}
                    onChange={(e) => handleChange('welcome_diamonds', parseInt(e.target.value, 10) || 0)}
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
                  <label style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem' }}>
                    💵 Welcome USD Cash ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.welcome_usd}
                    onChange={(e) => handleChange('welcome_usd', parseFloat(e.target.value) || 0)}
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

