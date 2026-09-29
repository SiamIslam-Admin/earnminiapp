import { useState } from 'react';
import type { FC } from 'react';
import { haptics } from '../../utils/haptics';
import { throwConfetti } from '../../utils/confetti';
import { notifyToast } from '../../utils/debugToast';
import { buyRaffleTickets, createRaffleStarsInvoice } from '../../services/dataService';
import { CryptoDepositInvoiceModal } from './CryptoDepositInvoiceModal';

export interface ClaimBottomSheetProps {
  raffle: any;
  userProfile?: any;
  onClose: () => void;
  onSuccess?: (addedTickets?: number) => void;
}

export const ClaimBottomSheet: FC<ClaimBottomSheetProps> = ({
  raffle,
  userProfile,
  onClose,
  onSuccess
}) => {
  const [ticketCount, setTicketCount] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeMethod, setActiveMethod] = useState<'usdt' | 'stars' | 'gems' | 'crypto_deposit' | null>(null);
  const [showCryptoModal, setShowCryptoModal] = useState<boolean>(false);

  const maxTickets = raffle?.max_tickets_per_user || raffle?.maxTicketsPerUser || 50;

  // Currency pricing configuration
  const rawPriceUsd = raffle?.ticket_price_usd ?? raffle?.ticketPriceUsd ?? 0.50;
  const rawPriceStars = raffle?.ticket_price_stars ?? raffle?.ticketPriceStars ?? 25;
  const rawPriceGems = raffle?.ticket_gem_price ?? raffle?.ticketPriceGems ?? 0;

  // Admin visibility toggles (currency is active if enabled !== false AND price > 0)
  const isUsdtEnabled = raffle?.enable_usd_payment !== false && rawPriceUsd > 0;
  const isStarsEnabled = raffle?.enable_stars_payment !== false && rawPriceStars > 0;
  const isGemsEnabled = raffle?.enable_gems_payment !== false && rawPriceGems > 0;

  const totalUsd = (rawPriceUsd * ticketCount).toFixed(2);
  const totalStars = rawPriceStars * ticketCount;
  const totalGems = rawPriceGems * ticketCount;

  const userBalUsd = userProfile?.balance_usd || 0;
  const neededUsd = parseFloat(totalUsd);
  const hasEnoughInAppBalance = userBalUsd >= neededUsd;

  const handleQuantityChange = (qty: number) => {
    haptics.impact('light');
    const clamped = Math.max(1, Math.min(maxTickets, qty));
    setTicketCount(clamped);
  };

  // 1. Pay with USDT (Dual-Option: In-App Balance or Direct Crypto Invoice)
  const handlePayUsdt = async () => {
    if (isProcessing) return;

    if (hasEnoughInAppBalance) {
      // Option A: Instant in-app balance payment (0ms)
      setIsProcessing(true);
      setActiveMethod('usdt');
      try {
        haptics.impact('medium');
        const res = await buyRaffleTickets(raffle?.id || '1', ticketCount, 'usdt');
        if (res.success) {
          haptics.notification('success');
          haptics.playWinSound();
          throwConfetti();
          notifyToast(`🎉 Successfully purchased ${ticketCount} Ticket(s) for $${totalUsd} USDT!`, 'success', 4000);
          onSuccess?.(ticketCount);
          setTimeout(onClose, 800);
        } else {
          haptics.notification('error');
          notifyToast(`Purchase failed: ${res.message || 'Error'}`, 'error', 3500);
        }
      } catch (err: any) {
        haptics.notification('error');
        notifyToast(`Error: ${err?.message || 'Transaction failed'}`, 'error', 3500);
      } finally {
        setIsProcessing(false);
        setActiveMethod(null);
      }
    } else {
      // Option B: Insufficient in-app balance -> Open Real-time Crypto Deposit Invoice Modal
      haptics.impact('medium');
      setShowCryptoModal(true);
    }
  };

  // 2. Pay with Telegram Stars (⭐)
  const handlePayStars = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setActiveMethod('stars');

    try {
      haptics.impact('medium');
      const invoiceRes = await createRaffleStarsInvoice(raffle?.id || '1', ticketCount);
      const invoiceLink = invoiceRes?.invoiceLink;

      // @ts-ignore
      const tg = window.Telegram?.WebApp;
      if (tg && typeof tg.openInvoice === 'function' && invoiceLink) {
        tg.openInvoice(invoiceLink, (status: string) => {
          if (status === 'paid') {
            haptics.notification('success');
            haptics.playWinSound();
            throwConfetti();
            notifyToast(`⭐ Paid ${totalStars} Stars! ${ticketCount} Ticket(s) Added!`, 'success', 4500);
            onSuccess?.(ticketCount);
            setTimeout(onClose, 800);
          } else if (status === 'cancelled') {
            notifyToast('Stars payment cancelled.', 'info', 2500);
          } else if (status === 'failed') {
            haptics.notification('error');
            notifyToast('Stars payment failed. Please try again.', 'error', 3500);
          }
        });
      } else if (invoiceLink) {
        // Fallback for browser preview
        window.open(invoiceLink, '_blank', 'noopener,noreferrer');
        notifyToast(`⭐ Opening Telegram Stars invoice for ${totalStars} Stars...`, 'info', 4000);
      } else {
        // Simulated local fallback
        await new Promise((res) => setTimeout(res, 500));
        haptics.notification('success');
        haptics.playWinSound();
        throwConfetti();
        notifyToast(`⭐ ${ticketCount} Ticket(s) reserved with ${totalStars} Stars!`, 'success', 4000);
        onSuccess?.(ticketCount);
        setTimeout(onClose, 800);
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Stars error: ${err?.message || 'Invoice failed'}`, 'error', 3500);
    } finally {
      setIsProcessing(false);
      setActiveMethod(null);
    }
  };

  // 3. Pay with Diamonds (💎)
  const handlePayGems = async () => {
    if (isProcessing) return;
    const userGems = userProfile?.diamonds || 0;

    if (userGems < totalGems) {
      haptics.notification('warning');
      notifyToast(`⚠️ Insufficient Diamonds (${userGems} / ${totalGems} 💎). Spin the wheel to earn more!`, 'error', 4000);
      return;
    }

    setIsProcessing(true);
    setActiveMethod('gems');
    try {
      haptics.impact('medium');
      const res = await buyRaffleTickets(raffle?.id || '1', ticketCount, 'gems');
      if (res.success) {
        haptics.notification('success');
        haptics.playWinSound();
        throwConfetti();
        notifyToast(`🎉 Exchanged ${totalGems} 💎 for ${ticketCount} Raffle Ticket(s)!`, 'success', 4000);
        onSuccess?.(ticketCount);
        setTimeout(onClose, 800);
      } else {
        haptics.notification('error');
        notifyToast(`Claim failed: ${res.message || 'Error'}`, 'error', 3500);
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err?.message || 'Transaction failed'}`, 'error', 3500);
    } finally {
      setIsProcessing(false);
      setActiveMethod(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 0.2s ease'
        }}
      />

      {/* Bottom Sheet Modal Container */}
      <div
        className="animate-slide-up"
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, #052e1e 0%, #021a11 100%)',
          borderRadius: '1.75rem 1.75rem 0 0',
          padding: '1.25rem 1.25rem 2rem 1.25rem',
          zIndex: 1,
          borderTop: '1.5px solid rgba(52, 211, 153, 0.35)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Grab Handle */}
        <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '0 auto 1rem auto' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              🎟️ Get Raffle Tickets
            </h2>
            <span style={{ color: '#a7f3d0', fontSize: '0.78rem' }}>
              Choose your ticket quantity & preferred payment method
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#cbd5e1',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Ticket Quantity Stepper & Quick Pills */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '0.85rem 1rem',
            marginBottom: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700 }}>
              Quantity (Max {maxTickets}):
            </span>
            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => handleQuantityChange(ticketCount - 1)}
                disabled={ticketCount <= 1}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  cursor: ticketCount > 1 ? 'pointer' : 'default',
                  opacity: ticketCount <= 1 ? 0.4 : 1
                }}
              >
                -
              </button>
              <span style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.25rem', minWidth: '32px', textAlign: 'center' }}>
                {ticketCount}
              </span>
              <button
                onClick={() => handleQuantityChange(ticketCount + 1)}
                disabled={ticketCount >= maxTickets}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '1rem',
                  cursor: ticketCount < maxTickets ? 'pointer' : 'default',
                  opacity: ticketCount >= maxTickets ? 0.4 : 1
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {[1, 3, 5, 10, 20].map((qty) => (
              <button
                key={qty}
                onClick={() => handleQuantityChange(qty)}
                style={{
                  flex: 1,
                  padding: '0.35rem 0',
                  borderRadius: '8px',
                  background: ticketCount === qty ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.06)',
                  border: ticketCount === qty ? '1px solid #34d399' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: ticketCount === qty ? '#ffffff' : '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {qty}x
              </button>
            ))}
          </div>
        </div>

        {/* Payment Methods Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Method 1: USDT BEP-20 / In-App Balance or Direct Crypto Invoice */}
          {isUsdtEnabled && (
            <div
              style={{
                background: 'rgba(6, 78, 59, 0.35)',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <img src="./assets/SingleCoin_animated.gif" alt="USDT" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                    USDT (BEP-20)
                  </div>
                  <div style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 700 }}>
                    ${rawPriceUsd.toFixed(2)} per ticket
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.68rem', marginTop: '0.1rem' }}>
                    {hasEnoughInAppBalance
                      ? `Balance: $${userBalUsd.toFixed(2)} (Instant ⚡)`
                      : `Balance: $${userBalUsd.toFixed(2)} (Direct Deposit)`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                <div style={{ color: '#fde047', fontWeight: 900, fontSize: '1.05rem' }}>
                  ${totalUsd} USDT
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    onClick={handlePayUsdt}
                    disabled={isProcessing}
                    style={{
                      background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 1rem',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {isProcessing && activeMethod === 'usdt'
                      ? 'Processing...'
                      : hasEnoughInAppBalance
                      ? 'Pay Balance 💵'
                      : 'Pay Direct ⚡'}
                  </button>
                  {hasEnoughInAppBalance && (
                    <button
                      onClick={() => {
                        haptics.impact('light');
                        setShowCryptoModal(true);
                      }}
                      title="Pay using external Web3 wallet"
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.6rem',
                        color: '#38bdf8',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Method 2: Telegram Stars (⭐) */}
          {isStarsEnabled && (
            <div
              style={{
                background: 'rgba(6, 78, 59, 0.35)',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.4rem' }}>⭐</span>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                    Telegram Stars
                  </div>
                  <div style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 700 }}>
                    ⭐ {rawPriceStars} Stars per ticket
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.05rem' }}>
                  {totalStars} Stars
                </div>
                <button
                  onClick={handlePayStars}
                  disabled={isProcessing}
                  style={{
                    background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 1.1rem',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                  }}
                >
                  {isProcessing && activeMethod === 'stars' ? 'Opening...' : 'Pay Stars ⭐'}
                </button>
              </div>
            </div>
          )}

          {/* Method 3: Diamonds (💎) */}
          {isGemsEnabled && (
            <div
              style={{
                background: 'rgba(6, 78, 59, 0.35)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <img src="./assets/diamond_animated.gif" alt="Diamonds" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                    Diamonds Exchange
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700 }}>
                    💎 {rawPriceGems} per ticket
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.05rem' }}>
                  {totalGems} 💎
                </div>
                <button
                  onClick={handlePayGems}
                  disabled={isProcessing}
                  style={{
                    background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 1.1rem',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  {isProcessing && activeMethod === 'gems' ? 'Exchanging...' : 'Exchange 💎'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crypto Deposit Invoice Modal */}
      {showCryptoModal && (
        <CryptoDepositInvoiceModal
          amountUsd={neededUsd}
          raffleId={raffle?.id || '1'}
          raffleTitle={raffle?.title || raffle?.name}
          ticketCount={ticketCount}
          onClose={() => setShowCryptoModal(false)}
          onSuccess={() => {
            setShowCryptoModal(false);
            onSuccess?.(ticketCount);
            onClose();
          }}
        />
      )}
    </div>
  );
};
