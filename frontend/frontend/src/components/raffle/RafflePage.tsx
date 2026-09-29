import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { UserProfile } from '../../types/api';
import { RaffleCard } from './RaffleCard';
import { RaffleDetails } from './RaffleDetails';
import { haptics } from '../../utils/haptics';
import { formatAssetNumber } from '../../utils/format';
import { getInitialRafflesData, fetchRafflesData } from '../../services/dataService';

export interface RafflePageProps {
  onBack: () => void;
  userProfile?: UserProfile;
}

export const RafflePage: FC<RafflePageProps> = ({ onBack, userProfile }) => {
  const initialData = getInitialRafflesData();
  const [rafflesData, setRafflesData] = useState<any>(initialData || { ongoing: [], ended: [], prizeTiers: [] });
  const ONGOING_RAFFLES = rafflesData?.ongoing || [];
  const ENDED_RAFFLES = rafflesData?.ended || [];
  const [selectedRaffle, setSelectedRaffle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(() => initialData === null);

  useEffect(() => {
    fetchRafflesData().then((data) => {
      if (data) setRafflesData(data);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  const handleTicketUpdate = (raffleId: string, newCount: number) => {
    setRafflesData((prev: any) => {
      if (!prev) return prev;
      const updateList = (list: any[]) =>
        (list || []).map((r) =>
          r.id === raffleId || r.id === `#${raffleId}` || `#${r.id}` === raffleId
            ? { ...r, userTickets: newCount, user_tickets: newCount }
            : r
        );
      return {
        ...prev,
        ongoing: updateList(prev.ongoing),
        ended: updateList(prev.ended)
      };
    });
    if (selectedRaffle && (selectedRaffle.id === raffleId || selectedRaffle.id === `#${raffleId}`)) {
      setSelectedRaffle((prev: any) => ({ ...prev, userTickets: newCount, user_tickets: newCount }));
    }
  };

  if (selectedRaffle) {
    return (
      <RaffleDetails 
        raffle={selectedRaffle}
        userProfile={userProfile}
        onBack={() => setSelectedRaffle(null)}
        onTicketPurchased={handleTicketUpdate}
      />
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% -10%, #057a44 0%, #024e2c 40%, #012a18 75%, #00170d 100%)',
      position: 'absolute',
      top: 0,
      left: 0,
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      zIndex: 50 // Ensures it covers the main page completely
    }}>
      {/* Vibrant Ambient Glow Orbs */}
      <div style={{
        position: 'absolute',
        top: '-60px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '320px',
        height: '320px',
        background: 'radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, rgba(251, 191, 36, 0.1) 45%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '-80px',
        width: '280px',
        height: '280px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(251, 191, 36, 0.12) 50%, transparent 75%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{
        position: 'absolute',
        top: '45%',
        left: '-80px',
        width: '240px',
        height: '240px',
        background: 'radial-gradient(circle, rgba(5, 150, 105, 0.25) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Modern Outlined Watermark */}
      <div style={{
        position: 'absolute',
        top: '4%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '7rem',
        fontWeight: 900,
        fontFamily: "'Outfit', 'Inter', sans-serif",
        color: 'transparent',
        WebkitTextStroke: '1.5px rgba(255, 255, 255, 0.08)',
        pointerEvents: 'none',
        zIndex: 0,
        whiteSpace: 'nowrap',
        letterSpacing: '6px',
        textTransform: 'lowercase'
      }}>
        raffle
      </div>
      
      {/* Crisp Dotted Grid */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Floating Translucent Triangles Pattern */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(52, 211, 153, 0.2)" style={{ position: 'absolute', top: '12%', left: '8%', transform: 'rotate(15deg)' }}><polygon points="12,2 22,22 2,22"/></svg>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(251, 191, 36, 0.25)" style={{ position: 'absolute', top: '22%', right: '12%', transform: 'rotate(-30deg)' }}><polygon points="12,2 22,22 2,22"/></svg>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="rgba(255, 255, 255, 0.08)" style={{ position: 'absolute', top: '48%', left: '5%', transform: 'rotate(45deg)' }}><polygon points="12,2 22,22 2,22"/></svg>
      </div>

      {/* Top Header Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 0.9rem 0.4rem 0.9rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 20
        }}
      >
        {/* Back Button */}
        <button
          onClick={() => {
            haptics.impact('light');
            onBack();
          }}
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: 0,
            flexShrink: 0
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {/* Asset Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          {/* USDT Cashout Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              color: '#ffffff',
              padding: '0.15rem 0.45rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.22rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/SingleCoin_animated.gif" alt="USDT" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#fef08a' }}>${(userProfile?.balance_usd ?? 0).toFixed(2)}</span>
          </div>

          {/* Spins */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.15rem 0.45rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/ticket_animated.gif" alt="Spins" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>{formatAssetNumber(userProfile?.spins ?? 0)}</span>
          </div>

          {/* Diamonds */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.15rem 0.5rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/diamond_animated.gif" alt="Diamond" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>{formatAssetNumber(userProfile?.diamonds ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Main Content Scrollable Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 2rem 1rem', position: 'relative', zIndex: 10 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ width: '130px', height: '14px', borderRadius: '4px', background: 'rgba(251,191,36,0.25)', marginBottom: '0.2rem' }} />
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="skeleton-glow-box"
                style={{
                  height: '100px',
                  borderRadius: '1rem',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ width: '110px', height: '13px', borderRadius: '4px', background: 'rgba(255,255,255,0.15)' }} />
                      <div style={{ width: '70px', height: '9px', borderRadius: '4px', background: 'rgba(52,211,153,0.2)' }} />
                    </div>
                  </div>
                  <div style={{ width: '54px', height: '26px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)' }} />
                </div>
                <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="page-reveal-fade">
            {/* ONGOING SECTION */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>ONGOING • {ONGOING_RAFFLES.length}</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(251,191,36,0.3) 0%, transparent 100%)' }} />
            </div>

            {ONGOING_RAFFLES.map((raffle: any) => (
              <RaffleCard 
                key={raffle.id}
                {...raffle}
                endsAt={raffle.ends_at || raffle.endsAt}
                userTickets={raffle.user_tickets ?? raffle.userTickets ?? 0}
                status="ongoing"
                onClickDetails={() => setSelectedRaffle(raffle)}
              />
            ))}

            {/* ENDED SECTION */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', marginTop: '1.5rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800, fontSize: '0.85rem' }}>ENDED • {ENDED_RAFFLES.length}</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, transparent 100%)' }} />
            </div>

            {ENDED_RAFFLES.map((raffle: any) => (
              <RaffleCard 
                key={raffle.id}
                {...raffle}
                endsAt={raffle.ends_at || raffle.endsAt}
                userTickets={raffle.user_tickets ?? raffle.userTickets ?? 0}
                status="ended"
                onClickDetails={() => setSelectedRaffle(raffle)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
