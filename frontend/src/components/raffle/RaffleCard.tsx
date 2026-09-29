import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { haptics } from '../../utils/haptics';

export interface RaffleCardProps {
  status: 'ongoing' | 'ended';
  id: string;
  cashReward: number;
  coinRewardStr: string;
  participants: number;
  tickets: number;
  totalTickets?: number;
  userTickets?: number;
  endsAt?: string;
  ends_at?: string;
  onClickDetails?: () => void;
}

export const RaffleCard: FC<RaffleCardProps> = ({
  status,
  id,
  cashReward,
  coinRewardStr,
  participants,
  tickets,
  totalTickets = 10000,
  userTickets = 0,
  endsAt,
  ends_at,
  onClickDetails
}) => {
  const isOngoing = status === 'ongoing';
  const [isPressed, setIsPressed] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!isOngoing) return;
    const targetTime = endsAt || ends_at ? new Date(endsAt || ends_at!).getTime() : null;

    const updateTimer = () => {
      if (!targetTime) {
        setCountdown('Ongoing');
        return;
      }
      const now = Date.now();
      const diff = Math.floor((targetTime - now) / 1000);
      if (diff <= 0) {
        setCountdown('Ended');
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 0) {
        setCountdown(`${d}d ${h < 10 ? '0' : ''}${h}h`);
      } else if (h > 0) {
        setCountdown(`${h < 10 ? '0' : ''}${h}h ${m < 10 ? '0' : ''}${m}m`);
      } else {
        setCountdown(`${m < 10 ? '0' : ''}${m}m ${s < 10 ? '0' : ''}${s}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOngoing, endsAt, ends_at]);

  const percentage = Math.min(100, Math.round((tickets / totalTickets) * 100));

  const handleClick = () => {
    haptics.impact('light');
    haptics.playClickSound();
    if (onClickDetails) onClickDetails();
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
        background: isOngoing
          ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.6) 0%, rgba(2, 44, 34, 0.85) 100%)'
          : 'rgba(30, 41, 59, 0.4)',
        border: isOngoing ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid rgba(255,255,255,0.15)',
        boxShadow: isOngoing
          ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px rgba(251, 191, 36, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
          : '0 4px 10px rgba(0, 0, 0, 0.2)',
        borderRadius: '1.25rem',
        padding: '1.2rem',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '1rem',
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* 777 Ticket Watermarks */}
      {isOngoing && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '-10px',
              fontSize: '4.5rem',
              fontWeight: 900,
              color: 'rgba(251, 191, 36, 0.05)',
              transform: 'rotate(-25deg)',
              pointerEvents: 'none',
              letterSpacing: '-2px'
            }}
          >
            777
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '-10px',
              fontSize: '4.5rem',
              fontWeight: 900,
              color: 'rgba(251, 191, 36, 0.05)',
              transform: 'rotate(25deg)',
              pointerEvents: 'none',
              letterSpacing: '-2px'
            }}
          >
            777
          </div>
        </>
      )}

      {/* Top Row: Status Badge, Timer & ID */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          position: 'relative',
          zIndex: 2
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              background: isOngoing
                ? 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)'
                : 'rgba(255,255,255,0.15)',
              border: isOngoing ? '1px solid #fde68a' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '1rem',
              padding: '0.2rem 0.65rem',
              fontSize: '0.68rem',
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {status}
          </div>

          {isOngoing && (
            <div
              style={{
                fontSize: '0.72rem',
                color: '#fef08a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <span>⏳</span> {countdown}
            </div>
          )}

          {userTickets > 0 && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.25)',
                border: '1px solid #10b981',
                borderRadius: '1rem',
                padding: '0.15rem 0.55rem',
                fontSize: '0.68rem',
                fontWeight: 900,
                color: '#6ee7b7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <span>✓</span> {userTickets} 🎟️
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 800,
            color: isOngoing ? '#fef08a' : 'rgba(255,255,255,0.6)',
            letterSpacing: '0.5px'
          }}
        >
          {id}
        </div>
      </div>

      {/* Middle: Total Jackpot Reward */}
      <div style={{ marginBottom: '1rem', position: 'relative', zIndex: 2 }}>
        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            color: isOngoing ? '#a7f3d0' : 'rgba(255,255,255,0.5)',
            letterSpacing: '0.05em',
            marginBottom: '0.25rem'
          }}
        >
          TOTAL REWARD POOL
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '1.75rem',
            fontWeight: 900,
            fontFamily: 'Georgia, serif'
          }}
        >
          <span style={{ color: isOngoing ? '#fbbf24' : '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            ${cashReward}
          </span>
          <span style={{ color: isOngoing ? '#ffffff' : 'rgba(255,255,255,0.7)', fontSize: '1.25rem' }}>
            + {coinRewardStr}
          </span>
          <img
            src="./assets/diamond_animated.gif"
            alt="Diamond"
            style={{ width: '30px', height: '30px', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Ticket Progress Meter */}
      {isOngoing && (
        <div style={{ marginBottom: '1.1rem', position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 700,
              marginBottom: '0.35rem'
            }}
          >
            <span>Tickets Sold: {tickets.toLocaleString()} / {totalTickets.toLocaleString()}</span>
            <span style={{ color: '#fbbf24' }}>{percentage}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div
              style={{
                width: `${percentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981 0%, #fbbf24 100%)',
                borderRadius: '6px'
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Row: Stats & Action Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2
        }}
      >
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>PARTICIPANTS</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>{participants.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>TICKETS</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>{tickets.toLocaleString()}</div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{
            background: isOngoing
              ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)'
              : 'rgba(255,255,255,0.1)',
            color: '#ffffff',
            border: isOngoing ? '1px solid #6ee7b7' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '0.75rem',
            padding: '0.5rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: isOngoing ? '0 4px 10px rgba(16, 185, 129, 0.4)' : 'none'
          }}
        >
          {isOngoing ? (userTickets > 0 ? 'My Tickets ➔' : 'Join & Details ➔') : 'View Results'}
        </button>
      </div>
    </div>
  );
};
