import type { FC } from 'react';

export interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100vh',
      background: 'rgba(2, 44, 34, 0.95)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Georgia, serif',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem 1rem',
        position: 'relative',
        flexShrink: 0
      }}>
        <h2 style={{ 
          fontSize: '1.4rem', 
          fontWeight: 800,
          margin: 0,
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          How to Play
        </h2>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8
          }}
        >
          ✕
        </button>
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 1.25rem 2rem 1.25rem'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem',
          paddingBottom: '2rem' 
        }}>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>1. Overview</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              Each raffle issue is an independent event with its own reward tiers, schedule, and participation window. Reward amounts and timing shown on this page apply to this issue only.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>2. How to claim</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              While the raffle is ongoing, tap Claim and pick an available method: free, watch ads, spend Gems, or pay with Telegram Stars. Each method issues raffle tickets according to how that option is configured on the page.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>3. Participation limits</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              Each join method has its own usage limit for this issue. An option may be unavailable if you are outside the participation window, have used up your quota, Gems or Stars balance is insufficient, the method is not configured for this issue, or the app does not support that method yet.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>4. Community reminder</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              Some free join options may remind you to stay in the official community. This is a client-side notice to help you understand eligibility — joining itself is not blocked by the server for missing community membership. If you leave before draw time, tickets from that option may not be eligible to win.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>5. Stars payment</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              Stars join first prepares a payment link, opens the Telegram invoice for you to pay, then waits for the order to be fulfilled before tickets are credited. If you cancel, payment fails, the link is unavailable, or the order expires, no tickets are issued; you can try again when the option is still available.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>6. My tickets</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px' }}>
              After a successful join, a popup shows the ticket numbers you just received. All tickets for this issue are listed under My Tickets, with status waiting for draw, not winning, or winning tier after results are published.
            </p>
          </section>

          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem' }}>7. Draw and results</h3>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px', marginBottom: '1rem' }}>
              The draw runs at the scheduled time after participation ends. Winning numbers are grouped by prize tier; you can expand a tier to see the full list. Only tickets that meet eligibility rules for their join method can win.
            </p>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.2px', fontStyle: 'italic' }}>
              If this text differs from an official notice, follow the official notice and platform rules.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};
