import React, { useState, useEffect } from 'react';
import {
  type AdminDiagnosticReport,
  subscribeToDiagnostics,
  closeAdminDiagnostic
} from '../../utils/adminDiagnostics';
import { copyTextSafe } from '../../utils/clipboard';
import { haptics } from '../../utils/haptics';

export const AdminDiagnosticModal: React.FC = () => {
  const [report, setReport] = useState<AdminDiagnosticReport | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToDiagnostics((newReport) => {
      setReport(newReport);
      setShowTechnical(false);
      setCopied(false);
      if (newReport) {
        try {
          haptics.notification('warning');
        } catch (_) {}
      }
    });
    return unsubscribe;
  }, []);

  if (!report) return null;

  const handleCopyTechnical = async () => {
    try {
      haptics.impact('light');
    } catch (_) {}
    const textToCopy = `[Admin Issue Diagnostic]
Action: ${report.actionName}
Issue: ${report.issue}
Cause: ${report.probableCause}
Solutions:
${report.suggestedSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}
Raw Error:
${report.rawError}`;

    await copyTextSafe(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getCategoryBadge = () => {
    switch (report.category) {
      case 'telegram':
        return {
          label: '🤖 Telegram Bot / Channel',
          bg: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.35)'
        };
      case 'blockchain':
        return {
          label: '⛽ Gas & Vault Liquidity',
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.35)'
        };
      case 'database':
        return {
          label: '💾 Duplicate / Database Conflict',
          bg: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: 'rgba(168, 85, 247, 0.35)'
        };
      case 'validation':
        return {
          label: '⏱️ Validation & Timing',
          bg: 'rgba(244, 63, 94, 0.15)',
          color: '#fb7185',
          border: 'rgba(244, 63, 94, 0.35)'
        };
      case 'network':
        return {
          label: '🌐 Network & Session',
          bg: 'rgba(234, 179, 8, 0.15)',
          color: '#fde047',
          border: 'rgba(234, 179, 8, 0.35)'
        };
      default:
        return {
          label: '⚙️ Operation Diagnostic',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: 'rgba(148, 163, 184, 0.35)'
        };
    }
  };

  const badge = getCategoryBadge();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeAdminDiagnostic();
        }
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #111827 0%, #0b0f19 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.15)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '1.1rem 1.25rem 0.85rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span
              style={{
                background: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
                padding: '0.25rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.3px',
                textTransform: 'uppercase'
              }}
            >
              {badge.label}
            </span>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#94a3b8',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
            >
              Action: {report.actionName}
            </span>
          </div>

          <button
            onClick={closeAdminDiagnostic}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 700,
              transition: 'all 0.15s ease'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {/* Issue Title */}
          <div>
            <h3
              style={{
                margin: '0 0 0.4rem',
                color: '#ffffff',
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.3px',
                lineHeight: 1.3
              }}
            >
              {report.title}
            </h3>
            <p
              style={{
                margin: 0,
                color: '#e2e8f0',
                fontSize: '0.92rem',
                lineHeight: 1.5
              }}
            >
              {report.issue}
            </p>
          </div>

          {/* Probable Cause Box */}
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '0.9rem 1rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: '#f87171',
                fontSize: '0.76rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.35rem'
              }}
            >
              <span>🔍</span>
              <span>Probable Root Cause</span>
            </div>
            <div
              style={{
                color: '#cbd5e1',
                fontSize: '0.86rem',
                lineHeight: 1.5
              }}
            >
              {report.probableCause}
            </div>
          </div>

          {/* Actionable Solutions Box */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: '#34d399',
                fontSize: '0.78rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.65rem'
              }}
            >
              <span>🛠️</span>
              <span>How to Resolve This Issue</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {report.suggestedSteps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    color: '#f1f5f9',
                    fontSize: '0.88rem',
                    lineHeight: 1.45
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: '1px'
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Details Accordion */}
          <div
            style={{
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'rgba(0, 0, 0, 0.25)'
            }}
          >
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600
              }}
            >
              <span>{showTechnical ? '▼ Hide Technical Error Details' : '▶ Show Technical Error Details (For Devs)'}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Raw Server Output</span>
            </button>

            {showTechnical && (
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  background: 'rgba(0, 0, 0, 0.45)'
                }}
              >
                <pre
                  style={{
                    margin: '0 0 0.65rem',
                    color: '#f87171',
                    fontSize: '0.74rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    lineHeight: 1.4
                  }}
                >
                  {report.rawError}
                </pre>
                <button
                  onClick={handleCopyTechnical}
                  style={{
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    border: copied ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.15)',
                    color: copied ? '#34d399' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{copied ? '✓' : '📋'}</span>
                  <span>{copied ? 'Diagnostic Details Copied!' : 'Copy Full Diagnostic Details'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem'
          }}
        >
          <button
            onClick={closeAdminDiagnostic}
            style={{
              padding: '0.65rem 1.3rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '9px',
              color: '#ffffff',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              transition: 'transform 0.1s ease'
            }}
          >
            Understood, Close
          </button>
        </div>
      </div>
    </div>
  );
};
