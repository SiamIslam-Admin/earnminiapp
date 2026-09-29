import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { HowToPlayModal } from './HowToPlayModal';
import { ClaimBottomSheet } from './ClaimBottomSheet';
import { haptics } from '../../utils/haptics';
import { getInitialRafflesData, fetchRaffleDetails } from '../../services/dataService';

export interface RaffleDetailsProps {
  raffle: any;
  userProfile?: any;
  onBack: () => void;
  onTicketPurchased?: (raffleId: string, newTicketCount: number) => void;
}

export const RaffleDetails: FC<RaffleDetailsProps> = ({ raffle, userProfile, onBack, onTicketPurchased }) => {
  const [prizeTiers, setPrizeTiers] = useState<any[]>(() => raffle?.prizeTiers || raffle?.prize_tiers || getInitialRafflesData()?.prizeTiers || []);
  const [winners, setWinners] = useState<any[]>(() => raffle?.winners || []);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  
  // Real countdown timer
  const computeSecondsRemaining = () => {
    const endStr = raffle?.ends_at || raffle?.endsAt;
    if (!endStr) return 0;
    const diff = Math.floor((new Date(endStr).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(() => computeSecondsRemaining());
  const [userTicketsCount, setUserTicketsCount] = useState<number>(() => raffle?.user_tickets ?? raffle?.userTickets ?? 0);

  // Dynamic price calculation
  const rawPriceUsd = raffle?.ticket_price_usd ?? raffle?.ticketPriceUsd ?? 0.50;
  const rawPriceStars = raffle?.ticket_price_stars ?? raffle?.ticketPriceStars ?? 25;
  const rawPriceGems = raffle?.ticket_gem_price ?? raffle?.ticketPriceGems ?? 0;

  const isUsdtEnabled = raffle?.enable_usd_payment !== false && rawPriceUsd > 0;
  const isStarsEnabled = raffle?.enable_stars_payment !== false && rawPriceStars > 0;
  const isGemsEnabled = raffle?.enable_gems_payment !== false && rawPriceGems > 0;

  const priceParts: string[] = [];
  if (isUsdtEnabled) priceParts.push(`$${rawPriceUsd.toFixed(2)} USDT`);
  if (isStarsEnabled) priceParts.push(`⭐ ${rawPriceStars} Stars`);
  if (isGemsEnabled) priceParts.push(`💎 ${rawPriceGems}`);
  const priceDisplay = priceParts.length > 0 ? priceParts.join(' • ') : '$0.50 USDT';

  const isEnded = raffle?.status === 'ended' || secondsLeft <= 0;

  const formatCountdown = (sec: number) => {
    if (sec <= 0) return 'Ended';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const refreshDetails = () => {
    if (raffle?.id) {
      fetchRaffleDetails(raffle.id).then((details) => {
        if (details) {
          if (details.prizeTiers && details.prizeTiers.length > 0) {
            setPrizeTiers(details.prizeTiers);
          }
          if (details.winners && details.winners.length > 0) {
            setWinners(details.winners);
          }
          if (details.secondsLeft !== undefined) {
            setSecondsLeft(details.secondsLeft);
          }
          if (details.userTickets !== undefined) {
            setUserTicketsCount(details.userTickets);
            onTicketPurchased?.(raffle.id, details.userTickets);
          }
        }
      });
    }
  };

  useEffect(() => {
    refreshDetails();
  }, [raffle?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBack = () => {
    haptics.impact('light');
    onBack();
  };

  const handleOpenClaim = () => {
    if (isEnded) return;
    haptics.impact('medium');
    setShowClaimSheet(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(ellipse at 50% -10%, #057a44 0%, #024e2c 40%, #012a18 75%, #00170d 100%)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 60,
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Vibrant Ambient Glow Orbs */}
      <div
        style={{
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
        }}
      />

      {/* Top Header - Fixed at Top */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem 0.5rem 1.25rem',
          position: 'relative',
          flexShrink: 0,
          zIndex: 15
        }}
      >
        {/* Back Button */}
        <button
          onClick={handleBack}
          style={{
            background: 'rgba(6, 78, 59, 0.6)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '0.8rem',
            padding: '0.4rem 0.8rem',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>‹</span> Back
        </button>

        {/* Asset Balances (Unified Classic Frosted Glass) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* USDT Cashout Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              color: '#ffffff',
              padding: '0.18rem 0.55rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '28px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/SingleCoin_animated.gif" alt="USDT" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.78rem', color: '#fef08a' }}>${(userProfile?.balance_usd || 0).toFixed(2)}</span>
          </div>

          {/* Spin Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.18rem 0.55rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '28px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/ticket_animated.gif" alt="Spin" style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
            <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{userProfile?.spins || 0}</span>
          </div>

          {/* Diamond Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.18rem 0.55rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '28px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/diamond_animated.gif" alt="Diamond" style={{ width: '23px', height: '23px', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }} />
            <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{userProfile?.diamonds || 0}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area - Smoothly Scrollable Viewport with Bottom Clearance */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '0.5rem 1.25rem 13rem 1.25rem',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Title Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fef08a', letterSpacing: '0.5px' }}>
            {raffle.id}
          </div>
          <button
            onClick={() => setShowHowToPlay(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '1rem',
              padding: '0.25rem 0.85rem',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            How to play?
          </button>
        </div>

        {/* Big Prize Highlight Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.9) 0%, rgba(2, 44, 34, 0.95) 100%)',
            border: '1.5px solid rgba(251, 191, 36, 0.5)',
            borderRadius: '1.25rem',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}
        >
          <div>
            <div style={{ color: '#a7f3d0', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              GRAND CASH PRIZE
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fbbf24', fontFamily: 'Georgia, serif', lineHeight: 1.1 }}>
              ${raffle.cash_prize_usd || raffle.cashReward || 100} USDT
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
              Ends in: <span style={{ color: '#fff', fontWeight: 800 }}>{formatCountdown(secondsLeft)}</span>
            </div>

            {/* Clear Active Member Badge */}
            {userTicketsCount > 0 && (
              <div
                style={{
                  marginTop: '0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(5, 150, 105, 0.25) 100%)',
                  border: '1.5px solid #10b981',
                  borderRadius: '12px',
                  padding: '0.35rem 0.75rem',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                }}
              >
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                <span style={{ color: '#a7f3d0', fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                  ACTIVE MEMBER OF RAFFLE • {userTicketsCount} {userTicketsCount === 1 ? 'Ticket' : 'Tickets'}
                </span>
              </div>
            )}
          </div>
          <img src="./assets/coinSack_animated.gif" alt="Grand Prize" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
        </div>

        {/* Drawn Winners Panel (if ended / winners exist) */}
        {winners && winners.length > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.85) 0%, rgba(2, 44, 34, 0.9) 100%)',
              border: '1.5px solid rgba(52, 211, 153, 0.5)',
              borderRadius: '1.25rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ color: '#34d399', fontWeight: 900, fontSize: '0.95rem' }}>
                🏆 Official Winners ({winners.length})
              </div>
              <span style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#a7f3d0', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                DRAW COMPLETE
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {winners.map((w: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.55rem 0.75rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>{w.tier_rank}:</span>
                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}>
                      {w.username ? `@${w.username}` : w.name || 'Lucky Player'}
                    </span>
                  </div>
                  <span style={{ color: w.reward_type === 'diamonds' ? '#38bdf8' : '#34d399', fontWeight: 900, fontSize: '0.88rem' }}>
                    {w.prize}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prize Ladder & Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
            Prize Distribution
          </div>
          {prizeTiers.map((prize: any, idx: number) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0.9rem',
                background: prize.highlight
                  ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.25) 0%, rgba(2, 44, 34, 0.6) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: prize.highlight ? '1px solid rgba(251, 191, 36, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{prize.medal}</span>
                <span style={{ color: '#fff', fontSize: '0.92rem', fontWeight: 800 }}>{prize.rank}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: prize.highlight ? '#fbbf24' : '#ffffff', fontSize: '1.05rem', fontWeight: 900, fontFamily: 'Georgia, serif' }}>
                  {prize.amount}
                </span>
                {prize.icon && (
                  <img src={prize.icon} alt="Diamond" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                )}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.2rem' }}>
                  {prize.multiplier}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Fixed Action Area - Docked & Never Collides with Scroll Area */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, #01170f 92%, rgba(1, 23, 15, 0.85) 98%, transparent 100%)',
          padding: '1rem 1.25rem 1.5rem 1.25rem',
          zIndex: 30,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(52, 211, 153, 0.15)',
          boxShadow: '0 -8px 25px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
              My Tickets: <span style={{ color: '#fbbf24', fontSize: '1.1rem' }}>{userTicketsCount}</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.74rem', fontWeight: 600 }}>
              Price: <span style={{ color: '#a7f3d0' }}>{priceDisplay}</span>
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700 }}>
            {userTicketsCount > 0
              ? `⚡ Win Odds: 1 in ${Math.max(1, Math.round(((raffle.tickets || 100) + userTicketsCount) / userTicketsCount))}`
              : '⚡ Instant Win Odds: 1 in 48'}
          </div>
        </div>

        {/* Claim / Join Button */}
        <button
          onClick={handleOpenClaim}
          disabled={isEnded}
          style={{
            width: '100%',
            background: isEnded
              ? 'rgba(100, 116, 139, 0.4)'
              : 'linear-gradient(180deg, #facc15 0%, #eab308 50%, #ca8a04 100%)',
            border: isEnded ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid rgba(254, 240, 138, 0.7)',
            borderRadius: '0.85rem',
            padding: '0.95rem',
            color: isEnded ? '#94a3b8' : '#1e293b',
            fontSize: '1.15rem',
            fontWeight: 900,
            fontFamily: 'Georgia, serif',
            cursor: isEnded ? 'not-allowed' : 'pointer',
            boxShadow: isEnded ? 'none' : '0 4px 15px rgba(234, 179, 8, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.5)',
            transition: 'all 0.2s ease'
          }}
        >
          {isEnded
            ? '🏆 Raffle Closed • Winners Drawn'
            : userTicketsCount > 0
              ? '➕ Buy More Tickets 🎟️'
              : 'Get Tickets & Enter 🎟'}
        </button>
      </div>

      {/* Modals */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showClaimSheet && (
        <ClaimBottomSheet
          raffle={raffle}
          userProfile={userProfile}
          onClose={() => setShowClaimSheet(false)}
          onSuccess={(addedCount?: number) => {
            const countToAdd = addedCount || 1;
            setUserTicketsCount(prev => {
              const next = prev + countToAdd;
              onTicketPurchased?.(raffle.id, next);
              return next;
            });
            refreshDetails();
          }}
        />
      )}
    </div>
  );
};

export default RaffleDetails;
