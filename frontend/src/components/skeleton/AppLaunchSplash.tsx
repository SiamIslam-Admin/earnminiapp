import { useEffect, useState } from 'react';
import type { FC } from 'react';

interface AppLaunchSplashProps {
  onLoaded?: () => void;
  duration?: number;
}

export const AppLaunchSplash: FC<AppLaunchSplashProps> = ({
  onLoaded,
  duration = 1800
}) => {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor(12 + (elapsed / duration) * 88));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        if (onLoaded) onLoaded();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onLoaded]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 30%, #057a44 0%, #024e2c 45%, #012a18 80%, #00170d 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}
    >
      {/* Radiant Glowing Background Aura */}
      <div
        style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 230, 118, 0.25) 0%, rgba(251, 191, 36, 0.15) 50%, transparent 70%)',
          filter: 'blur(30px)',
          animation: 'pulseGlow 2s infinite ease-in-out',
          pointerEvents: 'none'
        }}
      />

      {/* Main Animated Branding Emblem */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 2
        }}
      >
        {/* Glowing Badge Frame */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(6, 125, 78, 0.7) 0%, rgba(1, 45, 28, 0.9) 100%)',
            border: '2px solid rgba(0, 230, 118, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(0, 230, 118, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
            animation: 'pulseGlow 2.2s infinite ease-in-out'
          }}
        >
          <img
            src="./assets/SingleCoin_animated.gif"
            alt="Spin Craft"
            style={{
              width: '58px',
              height: '58px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
            }}
          />
        </div>

        {/* Title & Subtitle */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 900,
              fontFamily: 'Outfit, sans-serif',
              color: '#ffffff',
              letterSpacing: '0.04em',
              textShadow: '0 2px 10px rgba(0, 230, 118, 0.6), 0 0 20px rgba(254, 240, 138, 0.4)'
            }}
          >
            SPIN CRAFT
          </h1>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#a7f3d0',
              letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}
          >
            Spin &amp; Earn Crypto
          </span>
        </div>

        {/* Progress Bar Container */}
        <div
          style={{
            marginTop: '1.5rem',
            width: '220px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)'
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00a854 0%, #00e676 50%, #fef08a 100%)',
                borderRadius: '6px',
                boxShadow: '0 0 10px rgba(0, 230, 118, 0.8)',
                transition: 'width 0.08s ease-out'
              }}
            />
          </div>

          {/* Dynamic Loading Text */}
          <span
            style={{
              fontSize: '0.72rem',
              color: 'rgba(255, 255, 255, 0.75)',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '0.02em'
            }}
          >
            {progress < 45
              ? 'Connecting to Telegram...'
              : progress < 85
              ? 'Loading lucky spin wheel...'
              : 'Starting session...'}
          </span>
        </div>
      </div>
    </div>
  );
};
