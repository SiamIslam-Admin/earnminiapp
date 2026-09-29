import React, { useEffect, useState } from 'react';
import { createCryptoInvoice, getInvoiceStatus } from '../../services/dataService';
import type { CryptoInvoiceData } from '../../types/api';
import { notifyToast } from '../../utils/debugToast';
import { copyTextSafe } from '../../utils/clipboard';
import { haptics } from '../../utils/haptics';
import { throwConfetti } from '../../utils/confetti';

interface CryptoDepositInvoiceModalProps {
  invoice?: CryptoInvoiceData | null;
  amountUsd?: number;
  raffleId?: string;
  raffleTitle?: string;
  ticketCount?: number;
  onClose: () => void;
  onSuccess: (data?: any) => void;
}

export const CryptoDepositInvoiceModal: React.FC<CryptoDepositInvoiceModalProps> = ({
  invoice: initialInvoice,
  amountUsd = 2.50,
  raffleId,
  raffleTitle,
  ticketCount = 5,
  onClose,
  onSuccess
}) => {
  const [invoice, setInvoice] = useState<CryptoInvoiceData | null>(initialInvoice || null);
  const [loading, setLoading] = useState(!initialInvoice);
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15 * 60); // 15:00 Countdown

  // Initialize or fetch invoice
  useEffect(() => {
    if (initialInvoice) {
      setInvoice(initialInvoice);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const initInvoice = async () => {
      setLoading(true);
      try {
        const res = await createCryptoInvoice(amountUsd, 'raffle_tickets', raffleId, ticketCount);
        if (isMounted) {
          if (res.success && res.data) {
            setInvoice(res.data);
          } else {
            notifyToast(`Failed to generate deposit invoice: ${res.message || 'Error'}`, 'error', 4000);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          notifyToast(`Error: ${err?.message || 'Invoice failed'}`, 'error', 3500);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initInvoice();
    return () => {
      isMounted = false;
    };
  }, [initialInvoice, amountUsd, raffleId, ticketCount]);

  // 15-Minute Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. High-Frequency Poller (Every 3 seconds)
  useEffect(() => {
    const invId = invoice?.invoice_id || (invoice as any)?.id;
    if (!invId || isPaid || secondsLeft <= 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await getInvoiceStatus(invId);
        if (res?.status === 'paid' || res?.status === 'completed' || res?.data?.status === 'paid') {
          setIsPaid(true);
          clearInterval(pollInterval);
          try {
            localStorage.removeItem('active_crypto_invoice');
          } catch {}
          haptics.notification('success');
          haptics.playWinSound();
          throwConfetti();
          notifyToast(`🎉 Payment Confirmed! ${ticketCount} Raffle Tickets Added!`, 'success', 5000);
          onSuccess(res);
          setTimeout(onClose, 2000);
        }
      } catch (err) {
        console.warn('Invoice poll error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [invoice?.invoice_id, (invoice as any)?.id, isPaid, secondsLeft, ticketCount, onSuccess, onClose]);

  const handleCopyAddress = () => {
    const addr = invoice?.deposit_address || (invoice as any)?.address;
    if (!addr) return;
    copyTextSafe(addr);
    setCopied(true);
    haptics.notification('success');
    notifyToast('📋 Copied BEP-20 USDT Deposit Address!', 'success', 2500);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const depositAddr = invoice?.deposit_address || (invoice as any)?.address || '';
  const finalAmount = invoice?.amount_usd ?? amountUsd;

  // Construct standard QR code image URL
  const qrUrl = depositAddr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        `ethereum:${depositAddr}@56?value=${finalAmount}`
      )}`
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: 'linear-gradient(180deg, #09131e 0%, #03080f 100%)',
          border: '1.5px solid rgba(251, 191, 36, 0.4)',
          borderRadius: '24px',
          padding: '1.5rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(251, 191, 36, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          position: 'relative'
        }}
      >
        {/* Header & Network Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            background: 'rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            padding: '0.2rem 0.65rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 800
          }}>
            BNB Smart Chain (BEP-20)
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.78rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              color: secondsLeft < 120 ? '#f87171' : '#94a3b8',
              animation: secondsLeft < 120 ? 'pulse 1s infinite' : 'none'
            }}>
              ⏳ {formatTimer(secondsLeft)}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                color: '#cbd5e1',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontSize: '1.25rem', fontWeight: 800 }}>
            Send USDT (BEP-20)
          </h3>
          <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fbbf24' }}>
            ${finalAmount.toFixed(2)} USDT
          </p>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            🎟️ {ticketCount}x Tickets {raffleTitle ? `• ${raffleTitle}` : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div className="skeleton-glow-box" style={{ width: '160px', height: '160px', borderRadius: '16px' }} />
            <span style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700 }}>
              Generating secure on-chain deposit address...
            </span>
          </div>
        ) : !invoice ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
            Failed to generate crypto invoice. Please try again.
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  background: '#ffffff',
                  padding: '0.6rem',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                }}
              >
                <img
                  src={qrUrl}
                  alt="USDT Deposit QR"
                  style={{ width: '150px', height: '150px', display: 'block' }}
                />
              </div>
            </div>

            {/* Deposit Address Box */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '0.75rem',
                textAlign: 'left'
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'block', marginBottom: '0.2rem' }}>
                Deposit Address (BEP-20 only):
              </span>
              <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontFamily: 'monospace', wordBreak: 'break-all', display: 'block' }}>
                {depositAddr}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleCopyAddress}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  background: copied ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#060a12',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(251, 191, 36, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {copied ? '✅ Address Copied!' : '📋 Copy Address'}
              </button>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Close (Payment will process in background)
              </button>
            </div>

            {/* Pulsating Indicator */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isPaid ? '#10b981' : '#fbbf24',
                  boxShadow: isPaid ? '0 0 10px #10b981' : '0 0 10px #fbbf24',
                  animation: 'pulse 1.5s infinite'
                }}
              />
              <span style={{ color: isPaid ? '#34d399' : '#cbd5e1', fontSize: '0.72rem', fontWeight: 600 }}>
                {isPaid ? 'Payment Confirmed! Finalizing...' : 'Awaiting on-chain transaction (Auto-detects ⚡)'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
