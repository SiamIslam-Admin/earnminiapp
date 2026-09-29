import type { FC } from 'react';
import { SkeletonBlock } from './SkeletonBlock';

export const TasksSkeleton: FC = () => {
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

      {/* 2. Tasks Page Title Banner */}
      <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <SkeletonBlock width={140} height={24} borderRadius={8} />
        <SkeletonBlock width={220} height={12} borderRadius={6} />
      </div>

      {/* 3. Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem', flexShrink: 0 }}>
        <SkeletonBlock width={80} height={34} borderRadius={20} />
        <SkeletonBlock width={95} height={34} borderRadius={20} />
        <SkeletonBlock width={85} height={34} borderRadius={20} />
      </div>

      {/* 4. Task Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
        {[1, 2, 3, 4, 5].map((idx) => (
          <div
            key={idx}
            className="skeleton-glow-box"
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            {/* Left Thumbnail & Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <SkeletonBlock circle width={38} height={38} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <SkeletonBlock width={130} height={13} borderRadius={6} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <SkeletonBlock circle width={14} height={14} />
                  <SkeletonBlock width={55} height={11} borderRadius={4} />
                </div>
              </div>
            </div>

            {/* Right Action Button */}
            <SkeletonBlock width={64} height={32} borderRadius={10} />
          </div>
        ))}
      </div>
    </div>
  );
};
