import React, { useState } from 'react';
import { adminService } from '../../services/adminService';
import { notifyToast } from '../../utils/debugToast';
import { haptics } from '../../utils/haptics';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [secretKey, setSecretKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey.trim()) {
      setErrorMsg('Please enter the administrative key.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await adminService.authenticate(secretKey.trim());
      if (res.success && res.data?.token) {
        haptics.notification('success');
        notifyToast('Admin session authorized', 'success', 3000);
        setSecretKey('');
        onSuccess();
      } else {
        triggerError(res.error || res.message || 'Invalid security key');
      }
    } catch (err: any) {
      triggerError(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerError = (msg: string) => {
    haptics.notification('error');
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div
        className={isShaking ? 'shake-animation' : ''}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(180deg, #111827 0%, #0b0f17 100%)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '18px',
          padding: '1.75rem 1.5rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        {/* Minimalist Executive Lock Icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.3rem',
            marginBottom: '1rem',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
          }}
        >
          🔒
        </div>

        <h2
          style={{
            margin: '0 0 0.35rem 0',
            color: '#ffffff',
            fontSize: '1.2rem',
            fontWeight: 700,
            letterSpacing: '-0.2px'
          }}
        >
          Executive Access
        </h2>
        <p
          style={{
            margin: '0 0 1.35rem 0',
            color: '#94a3b8',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            maxWidth: '300px'
          }}
        >
          Please provide your administrative secret key to enter the management console.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ position: 'relative', marginBottom: '0.85rem', width: '100%' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter administrative key..."
              autoFocus
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem 2.8rem 0.75rem 0.95rem',
                background: 'rgba(0, 0, 0, 0.45)',
                border: errorMsg ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                letterSpacing: showKey ? '0.5px' : '2px',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)')}
              onBlur={(e) => (e.target.style.borderColor = errorMsg ? '#ef4444' : 'rgba(255, 255, 255, 0.16)')}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '4px',
                opacity: 0.6
              }}
            >
              {showKey ? '👁️' : '🔒'}
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                color: '#f87171',
                fontSize: '0.76rem',
                fontWeight: 600,
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem'
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Solid Professional Executive White Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              color: '#090d16',
              fontWeight: 700,
              fontSize: '0.88rem',
              letterSpacing: '0.2px',
              cursor: isLoading ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(255, 255, 255, 0.15)',
              marginBottom: '0.65rem',
              opacity: isLoading ? 0.7 : 1,
              transition: 'opacity 0.15s ease, transform 0.1s ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isLoading ? 'Verifying...' : 'Authenticate'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.65rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
          >
            Return to Mini App
          </button>
        </form>
      </div>

      <style>{`
        @keyframes adminShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-animation {
          animation: adminShake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};
