import { useState } from 'react';
import type { FC } from 'react';
import { haptics } from '../utils/haptics';

export interface FeatureCardProps {
  title: string;
  icon: string;
  variant?: 'emerald' | 'colorful' | 'gold';
  badge?: string;
  badgeColor?: 'red' | 'gold' | 'emerald';
  onClick?: () => void;
}

export const FeatureCard: FC<FeatureCardProps> = ({
  title,
  icon,
  variant = 'emerald',
  badge,
  badgeColor = 'red',
  onClick
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    haptics.impact('light');
    haptics.playClickSound();
    if (onClick) onClick();
  };

  const getBorderAndBg = () => {
    if (variant === 'colorful') {
      return {
        bg: 'linear-gradient(180deg, rgba(139, 92, 246, 0.4) 0%, rgba(30, 27, 75, 0.85) 100%)',
        border: 'rgba(196, 181, 253, 0.5)',
        btnBg: 'linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%)',
        btnBorder: '#c4b5fd'
      };
    }
    if (variant === 'gold') {
      return {
        bg: 'linear-gradient(180deg, rgba(245, 158, 11, 0.35) 0%, rgba(69, 26, 3, 0.85) 100%)',
        border: 'rgba(253, 230, 138, 0.5)',
        btnBg: 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)',
        btnBorder: '#fde68a'
      };
    }
    // Emerald / Vibrant Jade
    return {
      bg: 'linear-gradient(180deg, rgba(5, 120, 75, 0.55) 0%, rgba(2, 50, 32, 0.92) 100%)',
      border: 'rgba(0, 230, 118, 0.55)',
      btnBg: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
      btnBorder: '#86efac'
    };
  };

  const styling = getBorderAndBg();

  return (
    <div
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        width: 'clamp(52px, 15.5vw, 68px)',
        aspectRatio: '64 / 76',
        transform: isPressed ? 'scale(0.92) translateY(2px)' : 'scale(1)',
        transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box'
      }}
    >
      {/* Optional Notification Badge */}
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background:
              badgeColor === 'gold'
                ? 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)'
                : badgeColor === 'emerald'
                ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)'
                : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            fontSize: '0.62rem',
            fontWeight: 900,
            padding: '0.1rem 0.35rem',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4), 0 0 6px rgba(239, 68, 68, 0.6)',
            zIndex: 10,
            lineHeight: 1,
            animation: 'pulse 2s infinite ease-in-out'
          }}
        >
          {badge}
        </div>
      )}

      {/* Main Card Body (Clipped to perfect 1rem rounded rect with exact borders) */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.35rem 0 0 0',
          borderRadius: '1rem',
          overflow: 'hidden',
          background: styling.bg,
          border: `1px solid ${styling.border}`,
          boxShadow: isPressed
            ? '0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
            : '0 8px 16px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
          boxSizing: 'border-box',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)'
        }}
      >
        {/* 3D Floating Icon Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '0.1rem',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {(icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.svg') || icon.endsWith('.gif') || icon.endsWith('.webp') || icon.includes('/')) ? (
              <img
                src={icon}
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.45))',
                  transform: isPressed
                    ? (icon.endsWith('.gif') ? 'scale(1.05)' : 'scale(0.92)')
                    : (icon.endsWith('.gif') ? 'scale(1.15)' : 'scale(1)'),
                  transition: 'transform 0.15s ease'
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: '1.75rem',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))'
                }}
              >
                {icon}
              </div>
            )}
          </div>
        </div>

        {/* 3D Beveled Title Label Pellet (Seamlessly fits bottom curve) */}
        <div
          style={{
            width: '100%',
            background: styling.btnBg,
            color: '#ffffff',
            margin: 0,
            padding: '0.22rem 0',
            fontSize: '0.68rem',
            fontWeight: 900,
            fontFamily: 'Georgia, serif',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            textAlign: 'center',
            borderTop: `1px solid ${styling.btnBorder}`,
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.4)',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
};
