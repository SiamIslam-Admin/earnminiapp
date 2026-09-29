import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { haptics } from '../utils/haptics';

export interface OutOfSpinsModalProps {
  diamonds: number;
  onClose: () => void;
  onInvite: () => void;
  onTasks: () => void;
}

export const OutOfSpinsModal: FC<OutOfSpinsModalProps> = ({
  diamonds,
  onClose,
  onInvite,
  onTasks
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    haptics.impact('light');
    setIsVisible(false);
    setTimeout(onClose, 250);
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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.25s ease',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }}
    >
      {/* Backdrop Click */}
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
          background: 'linear-gradient(180deg, #057a44 0%, #012a18 100%)',
          borderTopLeftRadius: '2rem',
          borderTopRightRadius: '2rem',
          borderTop: '1px solid rgba(0, 230, 118, 0.55)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.75rem 1.25rem 2.25rem 1.25rem',
          position: 'relative',
          boxShadow: '0 -15px 35px rgba(0,0,0,0.6)',
          fontFamily: 'Outfit, sans-serif',
          zIndex: 1,
          boxSizing: 'border-box'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            cursor: 'pointer',
            zIndex: 20
          }}
        >
          ✕
        </button>

        {/* Inner Glass Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            background: 'rgba(3, 30, 22, 0.92)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '1.5rem',
            padding: '1.5rem 1.25rem',
            textAlign: 'center',
            boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}
        >
          {/* Animated Header Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(0,0,0,0) 70%)',
              border: '2px solid #fbbf24',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.85rem auto',
              fontSize: '2rem',
              boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)'
            }}
          >
            ⚡
          </div>

          <h2
            style={{
              color: '#ffffff',
              margin: '0 0 0.4rem 0',
              fontWeight: 900,
              fontSize: '1.35rem',
              fontFamily: 'Georgia, serif',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            Need More Spins?
          </h2>

          <p
            style={{
              color: 'rgba(255, 255, 255, 0.78)',
              fontSize: '0.86rem',
              lineHeight: 1.45,
              margin: '0 0 1rem 0'
            }}
          >
            Each spin requires <strong style={{ color: '#6ee7b7' }}>1 Free Spin Ticket</strong> or{' '}
            <strong style={{ color: '#fbbf24' }}>1,000 💎</strong> to win instant USDT.
          </p>

          {/* Current Balance Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '0.5rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '1.25rem'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 800 }}>
              🎟️ 0 Spins
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span style={{ fontSize: '0.8rem', color: '#fde047', fontWeight: 800 }}>
              💎 {diamonds.toLocaleString()} / 1,000
            </span>
          </div>

          {/* Action 1: Invite Friends */}
          <button
            onClick={() => {
              haptics.impact('medium');
              setIsVisible(false);
              setTimeout(onInvite, 200);
            }}
            style={{
              width: '100%',
              padding: '0.78rem',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: '1px solid rgba(167, 243, 208, 0.8)',
              boxShadow: '0 4px 14px rgba(0, 168, 84, 0.35), inset 0 1px 1px rgba(255,255,255,0.4)',
              fontSize: '0.94rem',
              fontWeight: 900,
              fontFamily: 'Georgia, serif',
              cursor: 'pointer',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'transform 0.1s ease'
            }}
          >
            <span>👥</span>
            <span>Invite Friends (+1 Spin Each)</span>
          </button>

          {/* Action 2: Complete Tasks */}
          <button
            onClick={() => {
              haptics.impact('light');
              setIsVisible(false);
              setTimeout(onTasks, 200);
            }}
            style={{
              width: '100%',
              padding: '0.74rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#fef08a',
              border: '1px solid rgba(254, 240, 138, 0.4)',
              fontSize: '0.90rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              marginBottom: '0.65rem'
            }}
          >
            <span>💎</span>
            <span>Complete Tasks (Earn 💎)</span>
          </button>

          {/* Close */}
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6ee7b7',
              textDecoration: 'underline',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0.2rem'
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
