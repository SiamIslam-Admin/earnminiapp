import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const WheelSettingsModule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Weights (0 - 100)
  const [weightDiamonds, setWeightDiamonds] = useState<number>(30);
  const [weightCash, setWeightCash] = useState<number>(25);
  const [weightSpinTicket, setWeightSpinTicket] = useState<number>(15);
  const [weightDoubleReward, setWeightDoubleReward] = useState<number>(8);
  const [weightSpinTicket2, setWeightSpinTicket2] = useState<number>(10);
  const [weightGemLarge, setWeightGemLarge] = useState<number>(12);

  // Reward Amounts
  const [diamondReward, setDiamondReward] = useState<number>(80);
  const [megaDiamondReward, setMegaDiamondReward] = useState<number>(300);
  const [minCashReward, setMinCashReward] = useState<number>(0.01);
  const [maxCashReward, setMaxCashReward] = useState<number>(0.05);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await adminService.getWheelSettings();
      if (res.data) {
        const raw = res.data;
        const items = raw.items || [];
        const findWeight = (val: string, fallback: number) => {
          const item = items.find((i: any) => i.value === val);
          return item ? item.weight : fallback;
        };

        setWeightDiamonds(findWeight('gem', 30));
        setWeightCash(findWeight('coins', 25));
        setWeightSpinTicket(findWeight('spin_ticket', 15));
        setWeightDoubleReward(findWeight('double_reward', 8));
        setWeightSpinTicket2(findWeight('spin_ticket_2', 10));
        setWeightGemLarge(findWeight('gem_large', 12));

        if (raw.diamondReward !== undefined) setDiamondReward(raw.diamondReward);
        else if (raw.diamond_reward !== undefined) setDiamondReward(raw.diamond_reward);

        if (raw.megaDiamondReward !== undefined) setMegaDiamondReward(raw.megaDiamondReward);
        else if (raw.mega_diamond_reward !== undefined) setMegaDiamondReward(raw.mega_diamond_reward);

        if (raw.minCashReward !== undefined) setMinCashReward(raw.minCashReward);
        else if (raw.min_cash_reward !== undefined) setMinCashReward(raw.min_cash_reward);

        if (raw.maxCashReward !== undefined) setMaxCashReward(raw.maxCashReward);
        else if (raw.max_cash_reward !== undefined) setMaxCashReward(raw.max_cash_reward);
      }
    } catch (err: any) {
      console.warn('Failed to load wheel settings:', err);
      notifyToast(`Failed to load settings: ${err?.message || 'Error'}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const totalWeight =
    weightDiamonds +
    weightCash +
    weightSpinTicket +
    weightDoubleReward +
    weightSpinTicket2 +
    weightGemLarge;

  const getPercent = (w: number) => {
    if (totalWeight <= 0) return '0.0';
    return ((w / totalWeight) * 100).toFixed(1);
  };

  const handleSave = async () => {
    if (totalWeight <= 0) {
      notifyToast('Total RNG weight must be greater than 0!', 'error', 3000);
      return;
    }

    setSaving(true);
    try {
      haptics.impact('medium');
      const payload = {
        weight_diamonds: Number(weightDiamonds) || 0,
        weight_cash: Number(weightCash) || 0,
        weight_spin_ticket: Number(weightSpinTicket) || 0,
        weight_double_reward: Number(weightDoubleReward) || 0,
        weight_spin_ticket_2: Number(weightSpinTicket2) || 0,
        weight_gem_large: Number(weightGemLarge) || 0,
        diamond_reward: Number(diamondReward) || 80,
        mega_diamond_reward: Number(megaDiamondReward) || 300,
        min_cash_reward: Number(minCashReward) || 0.01,
        max_cash_reward: Number(maxCashReward) || 0.05
      };

      const res = await adminService.updateWheelSettings(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast('🎡 Wheel probabilities updated successfully!', 'success', 3500);
        await loadSettings();
      } else {
        haptics.notification('error');
        const errMsg = res.error || 'Failed to save wheel settings';
        notifyToast(`Update failed: ${errMsg}`, 'error', 3500);
        showAdminDiagnostic(errMsg, 'Save Lucky Wheel Probabilities');
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err?.message || 'Failed to save'}`, 'error', 3500);
      showAdminDiagnostic(err, 'Save Lucky Wheel Probabilities');
    } finally {
      setSaving(false);
    }
  };

  const itemsConfig = [
    {
      id: 'diamonds',
      name: 'Regular Diamonds',
      icon: '💎',
      value: 'gem',
      color: '#facc15',
      weight: weightDiamonds,
      setWeight: setWeightDiamonds,
      hasExtra: true,
      extraLabel: 'Diamond Prize Amount',
      extraValue: diamondReward,
      setExtra: setDiamondReward,
      step: 10,
      min: 10,
      max: 1000
    },
    {
      id: 'cash',
      name: 'USD Cash Coins',
      icon: '💵',
      value: 'coins',
      color: '#10b981',
      weight: weightCash,
      setWeight: setWeightCash,
      hasRange: true,
      minCash: minCashReward,
      setMinCash: setMinCashReward,
      maxCash: maxCashReward,
      setMaxCash: setMaxCashReward
    },
    {
      id: 'spin_1',
      name: '1 Free Spin Ticket',
      icon: '🎟️',
      value: 'spin_ticket',
      color: '#38bdf8',
      weight: weightSpinTicket,
      setWeight: setWeightSpinTicket
    },
    {
      id: 'double',
      name: '2x Multiplier Bonus',
      icon: '🎁',
      value: 'double_reward',
      color: '#c084fc',
      weight: weightDoubleReward,
      setWeight: setWeightDoubleReward
    },
    {
      id: 'spin_2',
      name: '2 Free Spin Tickets',
      icon: '🎟️',
      value: 'spin_ticket_2',
      color: '#67e8f9',
      weight: weightSpinTicket2,
      setWeight: setWeightSpinTicket2
    },
    {
      id: 'mega_gem',
      name: 'Mega Diamonds Jackpot',
      icon: '💎',
      value: 'gem_large',
      color: '#f43f5e',
      weight: weightGemLarge,
      setWeight: setWeightGemLarge,
      hasExtra: true,
      extraLabel: 'Mega Diamond Amount',
      extraValue: megaDiamondReward,
      setExtra: setMegaDiamondReward,
      step: 50,
      min: 100,
      max: 5000
    }
  ];

  const handleNormalize100 = () => {
    if (totalWeight <= 0) return;
    haptics.selection();
    const factor = 100 / totalWeight;
    const newDiamonds = Math.max(1, Math.round(weightDiamonds * factor));
    const newCash = Math.max(1, Math.round(weightCash * factor));
    const newSpinTicket = Math.max(1, Math.round(weightSpinTicket * factor));
    const newDouble = Math.max(1, Math.round(weightDoubleReward * factor));
    const newSpinTicket2 = Math.max(1, Math.round(weightSpinTicket2 * factor));
    const remaining = 100 - (newDiamonds + newCash + newSpinTicket + newDouble + newSpinTicket2);
    const newGemLarge = Math.max(1, remaining > 0 ? remaining : 1);

    setWeightDiamonds(newDiamonds);
    setWeightCash(newCash);
    setWeightSpinTicket(newSpinTicket);
    setWeightDoubleReward(newDouble);
    setWeightSpinTicket2(newSpinTicket2);
    setWeightGemLarge(newGemLarge);
    notifyToast('✨ Normalized all RNG weights to exact 100% total sum!', 'info', 2500);
  };

  const applyPreset = (name: 'balanced' | 'engagement' | 'jackpot') => {
    haptics.selection();
    if (name === 'balanced') {
      setWeightDiamonds(30);
      setWeightCash(25);
      setWeightSpinTicket(15);
      setWeightDoubleReward(8);
      setWeightSpinTicket2(10);
      setWeightGemLarge(12);
      notifyToast('Applied "Fair & Balanced" probability curve', 'info', 2500);
    } else if (name === 'engagement') {
      setWeightDiamonds(35);
      setWeightCash(15);
      setWeightSpinTicket(20);
      setWeightDoubleReward(10);
      setWeightSpinTicket2(15);
      setWeightGemLarge(5);
      notifyToast('Applied "High Engagement (Extra Spins)" curve', 'info', 2500);
    } else if (name === 'jackpot') {
      setWeightDiamonds(20);
      setWeightCash(30);
      setWeightSpinTicket(15);
      setWeightDoubleReward(10);
      setWeightSpinTicket2(10);
      setWeightGemLarge(15);
      notifyToast('Applied "Jackpot Heavy" curve', 'info', 2500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            🎡 Wheel of Fortune RNG & Probabilities
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
            Adjust RNG weights, winning percentages, and dynamic prize rewards in real-time
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleNormalize100}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ⚖️ Normalize to 100%
          </button>
          <button
            onClick={() => {
              haptics.impact('light');
              loadSettings();
            }}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🔄 Reset
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
            <span>{saving ? 'Saving...' : 'Save Probabilities'}</span>
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700 }}>Quick Presets:</span>
        <button
          onClick={() => applyPreset('balanced')}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            borderRadius: '6px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🎯 Fair & Balanced
        </button>
        <button
          onClick={() => applyPreset('engagement')}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            borderRadius: '6px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          🔥 High Engagement
        </button>
        <button
          onClick={() => applyPreset('jackpot')}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#e2e8f0',
            borderRadius: '6px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          💰 Jackpot Heavy
        </button>
      </div>

      {/* Real-Time Probability Distribution Segmented Bar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.92rem' }}>
            Live Win Probability Distribution
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
            Total Weight: <b style={{ color: totalWeight === 100 ? '#34d399' : '#38bdf8' }}>{totalWeight}</b> {totalWeight === 100 && <span style={{ color: '#34d399' }}>(100% Exact ✓)</span>}
          </span>
        </div>

        {/* Segmented Color Bar */}
        <div
          style={{
            width: '100%',
            height: '14px',
            borderRadius: '7px',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.12)'
          }}
        >
          {itemsConfig.map((item) => {
            const pct = parseFloat(getPercent(item.weight));
            if (pct <= 0) return null;
            return (
              <div
                key={item.id}
                title={`${item.name}: ${pct}%`}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: item.color,
                  transition: 'width 0.2s ease'
                }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between' }}>
          {itemsConfig.map((item) => {
            const pct = getPercent(item.weight);
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: item.color }} />
                <span style={{ color: '#cbd5e1' }}>{item.name}:</span>
                <b style={{ color: item.color }}>{pct}%</b>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6 Wheel Items Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-glow-box" style={{ height: '180px', borderRadius: '14px' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {itemsConfig.map((item) => {
            const pct = getPercent(item.weight);

            return (
              <div
                key={item.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: `1px solid ${item.color}33`,
                  borderRadius: '14px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
                  position: 'relative'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                    <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.92rem' }}>
                      {item.name}
                    </span>
                  </div>
                  <span
                    style={{
                      background: `${item.color}22`,
                      color: item.color,
                      border: `1px solid ${item.color}55`,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 800
                    }}
                  >
                    {pct}% Win Odds
                  </span>
                </div>

                {/* Weight Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.76rem', color: '#94a3b8' }}>
                    <span>RNG Weight (0 - 100)</span>
                    <b style={{ color: '#ffffff' }}>{item.weight}</b>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={item.weight}
                    onChange={(e) => item.setWeight(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      accentColor: item.color,
                      cursor: 'pointer'
                    }}
                  />
                </div>

                {/* Extra Prize Inputs if applicable */}
                {item.hasExtra && (
                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.65rem', borderRadius: '8px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.3rem' }}>
                      {item.extraLabel}
                    </label>
                    <input
                      type="number"
                      step={item.step || 10}
                      min={item.min || 10}
                      max={item.max || 5000}
                      value={item.extraValue}
                      onChange={(e) => item.setExtra?.(parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.45rem',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: '#fde047',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* Cash Range Input if applicable */}
                {item.hasRange && (
                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.65rem', borderRadius: '8px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block', marginBottom: '0.3rem' }}>
                      USD Cash Reward Range ($)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>Min ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          max="1.00"
                          value={item.minCash}
                          onChange={(e) => item.setMinCash?.(parseFloat(e.target.value) || 0.01)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            color: '#10b981',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.68rem', display: 'block' }}>Max ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="5.00"
                          value={item.maxCash}
                          onChange={(e) => item.setMaxCash?.(parseFloat(e.target.value) || 0.05)}
                          style={{
                            width: '100%',
                            padding: '0.4rem',
                            background: 'rgba(0, 0, 0, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            color: '#10b981',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

