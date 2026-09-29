import { useState } from 'react';
import type { FC } from 'react';
import { haptics } from '../utils/haptics';

export interface TaskBannerProps {
  title: string;
  subtitle: string;
  icon: string;
  rewardAmount?: number;
  rewardIcon?: string;
  onClick?: () => void;
}

export const TaskBanner: FC<TaskBannerProps> = ({
  title,
  subtitle,
  icon,
  rewardAmount,
  rewardIcon = './assets/diamond_animated.gif',
  onClick
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isBtnPressed, setIsBtnPressed] = useState(false);

  const handleClick = () => {
    haptics.impact('light');
    haptics.playClickSound();
    if (onClick) onClick();
  };

  const renderReward = () => {
    if (!rewardAmount) return 'GO';
    const isImage = typeof rewardIcon === 'string' && (rewardIcon.includes('.') || rewardIcon.includes('/'));
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
        {isImage ? (
          <img src={rewardIcon} alt="Reward" style={{ width: '23px', height: '23px', objectFit: 'contain' }} />
        ) : (
          rewardIcon
        )}
        <span>+{rewardAmount}</span>
      </span>
    );
  };

  return (
    <div
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.35rem 0.65rem',
        background: 'rgba(0, 0, 0, 0.42)',
        borderRadius: '0.9rem',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        boxShadow: isPressed
          ? '0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.12)'
          : '0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        color: '#ffffff',
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        flex: '0 0 78%',
        width: '78%',
        minWidth: '78%',
        maxWidth: '78%',
        height: '44px',
        scrollSnapAlign: 'start',
        flexShrink: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Left Icon & Text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.78rem',
              lineHeight: 1.15,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', marginTop: '0.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* 3D Action Button */}
      <button
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsBtnPressed(true);
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          setIsBtnPressed(false);
        }}
        onMouseLeave={() => setIsBtnPressed(false)}
        onTouchStart={(e) => {
          e.stopPropagation();
          setIsBtnPressed(true);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          setIsBtnPressed(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        style={{
          padding: '0.22rem 0.55rem',
          borderRadius: '0.55rem',
          background: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
          color: '#ffffff',
          border: '1px solid rgba(167, 243, 208, 0.8)',
          boxShadow: isBtnPressed
            ? '0 1px 0 #012a18, inset 0 2px 4px rgba(0,0,0,0.4)'
            : '0 2px 0 #012a18, 0 3px 8px rgba(0, 230, 118, 0.35), inset 0 1px 1px rgba(255,255,255,0.5)',
          fontSize: '0.74rem',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          margin: 0,
          cursor: 'pointer',
          transform: isBtnPressed ? 'translateY(1px)' : 'translateY(0)',
          transition: 'transform 0.08s ease, box-shadow 0.08s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        {renderReward()}
      </button>
    </div>
  );
};
