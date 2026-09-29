import type { FC } from 'react';
import { SkeletonBlock } from './SkeletonBlock';

export const WalletSkeleton: FC = () => {
  return (
    <div
      className="page-reveal-fade"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '440px',
        margin: '0 auto',
        height: '100vh',
        boxSizing: 'border-box',
        padding: '0.65rem 0.85rem',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: '1rem',
          flexShrink: 0
        }}
      >
        <SkeletonBlock width={70} height={32} borderRadius={16} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <SkeletonBlock width={52} height={28} borderRadius={16} />
          <SkeletonBlock width={52} height={28} borderRadius={16} />
          <SkeletonBlock width={58} height={28} borderRadius={16} />
        </div>
      </div>

      {/* 2. Available Balance Card */}
      <div
        className="skeleton-glow-box"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <SkeletonBlock circle width={32} height={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <SkeletonBlock width={110} height={13} borderRadius={4} />
            <SkeletonBlock width={80} height={10} borderRadius={4} />
          </div>
        </div>
        <SkeletonBlock width={70} height={24} borderRadius={6} />
      </div>

      {/* 3. Connected Wallet Address Input Box */}
      <div
        className="skeleton-glow-box"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <SkeletonBlock width={130} height={12} borderRadius={4} />
        <SkeletonBlock width="100%" height={38} borderRadius={8} />
      </div>

      {/* 4. Withdrawal Quick Amounts Stepper */}
      <div style={{ marginBottom: '1.2rem' }}>
        <SkeletonBlock width={120} height={13} borderRadius={4} style={{ marginBottom: '0.5rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          <SkeletonBlock height={36} borderRadius={8} />
          <SkeletonBlock height={36} borderRadius={8} />
          <SkeletonBlock height={36} borderRadius={8} />
          <SkeletonBlock height={36} borderRadius={8} />
        </div>
      </div>

      {/* 5. Summary Info Row */}
      <div
        className="skeleton-glow-box"
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '0.85rem',
          marginBottom: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBlock width={80} height={11} borderRadius={4} />
          <SkeletonBlock width={50} height={11} borderRadius={4} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBlock width={95} height={11} borderRadius={4} />
          <SkeletonBlock width={60} height={11} borderRadius={4} />
        </div>
      </div>

      {/* 6. Bottom Submit CTA Button */}
      <SkeletonBlock width="100%" height={46} borderRadius={14} style={{ marginTop: '1rem' }} />
    </div>
  );
};
