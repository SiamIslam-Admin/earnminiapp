import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { notifyToast } from '../../utils/debugToast';
import { haptics } from '../../utils/haptics';

export interface ConnectWalletModalProps {
  onClose: () => void;
  onSave: (data: { address: string; phone?: string }) => void;
  initialAddress?: string | null;
  initialPhone?: string | null;
}

export const ConnectWalletModal: FC<ConnectWalletModalProps> = ({
  onClose,
  onSave,
  initialAddress
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [address, setAddress] = useState(initialAddress || '');

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handlePasteAddress = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setAddress(text.trim());
          haptics.notification('success');
          notifyToast('📋 Address pasted from clipboard', 'info', 2000);
          return;
        }
      }
    } catch {
      notifyToast('Please paste your address manually', 'info', 2500);
    }
  };

  const handleSave = () => {
    const trimmed = address.trim();
    if (!trimmed) {
      notifyToast('Please enter or paste your BEP-20 wallet address', 'error', 3000);
      return;
    }

    if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
      notifyToast('Please enter a valid 42-character BEP-20 address (0x...)', 'error', 3500);
      return;
    }

    onSave({ address: trimmed });
    handleClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}
    >
      {/* Dark overlay backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0
        }}
      />

      {/* Bottom Sheet Modal Container */}
      <div
        style={{
          width: '100%',
          background: 'linear-gradient(180deg, #059669 0%, #013820 100%)',
          borderTopLeftRadius: '1.5rem',
          borderTopRightRadius: '1.5rem',
          borderTop: '1px solid rgba(0, 230, 118, 0.55)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 1.25rem 1.75rem 1.25rem',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
          fontFamily: 'Outfit, sans-serif'
        }}
      >
        {/* Header Title & Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', marginBottom: '0.75rem' }}>
          <h2
            style={{
              margin: 0,
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 800
            }}
          >
            Connect BEP-20 Wallet
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: 'white',
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

        {/* USDT BEP-20 Subtitle Section */}
        <div style={{ marginBottom: '1.25rem', background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🟡</span>
            <span style={{ color: '#fbbf24', fontSize: '0.95rem', fontWeight: 800 }}>USDT (BNB Smart Chain)</span>
          </div>
          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.78rem',
              lineHeight: 1.35
            }}
          >
            Enter your destination BEP-20 address (Trust Wallet, Binance, MetaMask, etc.) for direct cashout payouts.
          </p>
        </div>

        {/* Wallet Address Input Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
          <label style={{ color: '#a7f3d0', fontSize: '0.82rem', fontWeight: 700 }}>
            BEP-20 Destination Address:
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                borderRadius: '0.75rem',
                padding: '0.65rem 0.75rem',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
                minWidth: 0
              }}
            >
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  width: '100%'
                }}
              />
            </div>

            {/* Paste Button */}
            <button
              type="button"
              onClick={handlePasteAddress}
              style={{
                background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                border: '1px solid rgba(254, 240, 138, 0.6)',
                borderRadius: '0.75rem',
                padding: '0.65rem 0.95rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.4)',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              <span>Paste</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'rgba(6, 78, 59, 0.75)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              borderRadius: '0.65rem',
              padding: '0.55rem 1.4rem',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              background: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
              border: '1px solid rgba(167, 243, 208, 0.8)',
              borderRadius: '0.65rem',
              padding: '0.55rem 1.8rem',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0, 230, 118, 0.4)'
            }}
          >
            Save Address
          </button>
        </div>
      </div>
    </div>
  );
};
