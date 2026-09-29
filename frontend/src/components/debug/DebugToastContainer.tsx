import React, { useEffect, useState } from 'react';
import { subscribeToToasts } from '../../utils/debugToast';
import type { DebugToast } from '../../utils/debugToast';

export const DebugToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<DebugToast[]>([]);

  useEffect(() => {
    return subscribeToToasts((updated) => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: '92%',
        width: 'auto',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const bg = isSuccess
          ? 'rgba(16, 185, 129, 0.92)'
          : isError
          ? 'rgba(239, 68, 68, 0.92)'
          : 'rgba(59, 130, 246, 0.92)';

        return (
          <div
            key={t.id}
            style={{
              background: bg,
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.3)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'debugSlideIn 0.2s ease-out'
            }}
          >
            <span>{isSuccess ? '🟢' : isError ? '🔴' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
};
