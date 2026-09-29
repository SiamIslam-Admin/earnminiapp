import type { FC } from 'react';
import { SkeletonBlock } from './SkeletonBlock';

export const RaffleSkeleton: FC = () => {
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

      {/* 2. Top Banner / Featured Raffle Showcase */}
      <div
        className="skeleton-glow-box"
        style={{
          width: '100%',
          height: '160px',
          borderRadius: '1.2rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          marginBottom: '1.2rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SkeletonBlock width={90} height={22} borderRadius={12} />
          <SkeletonBlock width={70} height={20} borderRadius={10} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <SkeletonBlock width={160} height={20} borderRadius={6} />
          <SkeletonBlock width={220} height={12} borderRadius={4} />
        </div>
        <SkeletonBlock width="100%" height={8} borderRadius={4} />
      </div>

      {/* 3. Raffle Cards Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
        <SkeletonBlock width={130} height={18} borderRadius={6} />
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="skeleton-glow-box"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <SkeletonBlock circle width={36} height={36} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <SkeletonBlock width={120} height={14} borderRadius={4} />
                  <SkeletonBlock width={80} height={10} borderRadius={4} />
                </div>
              </div>
              <SkeletonBlock width={60} height={28} borderRadius={8} />
            </div>
            <SkeletonBlock width="100%" height={6} borderRadius={3} />
          </div>
        ))}
      </div>
    </div>
  );
};
