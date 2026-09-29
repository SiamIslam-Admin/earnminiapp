import type { FC } from 'react';
import type { ReadyToClaimItem } from './types';

export interface ReadyToClaimCardProps {
  item: ReadyToClaimItem;
}

export const ReadyToClaimCard: FC<ReadyToClaimCardProps> = ({ item }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.85rem',
        background: 'linear-gradient(90deg, #00994d 0%, #00d66c 50%, #00994d 100%)',
        borderRadius: '0.9rem',
        border: '1px solid rgba(0, 230, 118, 0.65)',
        boxShadow: '0 4px 14px rgba(0, 214, 108, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
        color: 'white',
        fontFamily: 'Outfit, sans-serif',
        gap: '0.75rem'
      }}
    >
      {/* Left Icon & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <img
            src={item.icon || './assets/inviteFeatureCardIcon.png'}
            alt="Invite"
            style={{
              width: '26px',
              height: '26px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.88rem',
            color: '#ffffff',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {item.title}
        </div>
      </div>

      {/* Right Claim Pill Button */}
      <button
        onClick={item.onClaim}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          background: 'linear-gradient(180deg, #00d66c 0%, #009949 100%)',
          border: '1px solid rgba(167, 243, 208, 0.7)',
          borderRadius: '0.65rem',
          padding: '0.35rem 0.85rem',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.85rem',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          transition: 'transform 0.1s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <img
          src="./assets/diamond_animated.gif"
          alt="Diamond"
          style={{ width: '22px', height: '22px', objectFit: 'contain' }}
        />
        <span>+{item.rewardGems}</span>
      </button>
    </div>
  );
};
