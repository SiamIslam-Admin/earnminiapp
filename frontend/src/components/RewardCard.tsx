import { useState, type FC } from 'react';

export interface RewardCardProps {
  rewardText?: string;
  rewardName?: string;
  rewardAmount?: string;
  rewardImage?: string;
  onCollect?: () => void;
}

export const RewardCard: FC<RewardCardProps> = ({
  rewardText,
  rewardName = 'Congratulations',
  rewardAmount = '+80 💎',
  rewardImage = './assets/diamond_animated.gif',
  onCollect
}) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <div 
      className="reward-card page-reveal-fade"
      style={{
        position: 'relative',
        background: 'linear-gradient(160deg, rgba(6, 78, 59, 0.88) 0%, rgba(2, 44, 34, 0.96) 100%)',
        borderRadius: '24px',
        padding: '2.2rem 1.8rem',
        width: '100%',
        maxWidth: '350px',
        border: '1px solid rgba(52, 211, 153, 0.5)',
        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 20px 45px rgba(0, 0, 0, 0.65)',
        color: 'white',
        textAlign: 'center',
        margin: '0 auto',
        overflow: 'hidden',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Glowing orb behind icon */}
      <div style={{
        position: 'absolute', 
        top: '10px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        width: '180px', 
        height: '180px', 
        background: 'radial-gradient(circle, rgba(52, 211, 153, 0.35) 0%, rgba(0,0,0,0) 70%)', 
        borderRadius: '50%', 
        pointerEvents: 'none'
      }}></div>
      
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Animated Reward GIF Icon */}
        <div style={{
          width: '96px',
          height: '96px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.65rem',
          filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))'
        }}>
          <img
            src={rewardImage}
            alt={rewardName}
            style={{
              width: '88px',
              height: '88px',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Subtitle / Reward Name */}
        <div style={{
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontSize: '0.82rem',
          fontWeight: 800,
          color: '#6ee7b7',
          marginBottom: '0.35rem',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)'
        }}>
          {rewardName}
        </div>

        {/* Amount Won */}
        <h2 style={{
          margin: 0,
          marginBottom: '1.4rem', 
          fontFamily: 'Georgia, serif', 
          fontSize: '2.25rem', 
          fontWeight: 900, 
          background: 'linear-gradient(to bottom, #fef08a, #facc15 60%, #b45309 100%)', 
          WebkitBackgroundClip: 'text', 
          color: 'transparent', 
          lineHeight: 1.1,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)'
        }}>
          {rewardAmount || rewardText}
        </h2>
        
        {/* Collect Button */}
        <button 
          onClick={onCollect}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          style={{
            width: '100%',
            padding: '0.8rem 1.5rem',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: '1px solid rgba(167, 243, 208, 0.8)',
            boxShadow: isPressed 
              ? '0 0px 0 #047857, inset 0 2px 4px rgba(0,0,0,0.3)' 
              : '0 4px 0 #047857, 0 8px 16px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255,255,255,0.4)',
            fontSize: '1.05rem',
            fontWeight: 900,
            fontFamily: 'Georgia, serif',
            letterSpacing: '0.03em',
            cursor: 'pointer',
            transition: 'transform 0.1s, box-shadow 0.1s',
            transform: isPressed ? 'translateY(3px)' : 'translateY(0)'
          }}
        >
          Collect Reward 🎁
        </button>
      </div>
    </div>
  );
};
