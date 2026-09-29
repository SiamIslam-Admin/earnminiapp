import type { FC } from 'react';
import { SkeletonBlock } from './SkeletonBlock';

export const MainSkeleton: FC = () => {
  return (
    <div
      className="page-reveal-fade"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '440px',
        margin: '0 auto',
        height: '100vh',
        maxHeight: '100vh',
        boxSizing: 'border-box',
        padding: '0.4rem 0.75rem 0.5rem 0.75rem',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* 1. TOP HEADER SKELETON */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingBottom: '0.25rem',
          flexShrink: 0
        }}
      >
        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <SkeletonBlock circle width={32} height={32} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <SkeletonBlock width={75} height={13} borderRadius={6} />
            <SkeletonBlock width={45} height={9} borderRadius={4} />
          </div>
        </div>

        {/* 3 Top Asset Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <SkeletonBlock width={52} height={28} borderRadius={16} />
          <SkeletonBlock width={52} height={28} borderRadius={16} />
          <SkeletonBlock width={58} height={28} borderRadius={16} />
        </div>
      </div>

      {/* 2. MAIN CENTER SECTION (Left 4 cards, Wheel wireframe, Right 3 cards) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          flex: 1,
          paddingBottom: '0.25rem'
        }}
      >
        {/* Left Column (4 Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem', flexShrink: 0 }}>
          <SkeletonBlock width={58} height={46} borderRadius={16} />
          <SkeletonBlock width={58} height={46} borderRadius={16} />
          <SkeletonBlock width={58} height={46} borderRadius={16} />
          <SkeletonBlock width={58} height={46} borderRadius={16} />
        </div>

        {/* Center Progress & Wheel Wireframe */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '1 1 auto',
            minWidth: 0,
            padding: '0 0.25rem',
            marginTop: '-32px'
          }}
        >
          {/* Balance Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <SkeletonBlock circle width={30} height={30} />
            <SkeletonBlock width={90} height={26} borderRadius={8} />
          </div>

          {/* Progress Bar Skeleton */}
          <SkeletonBlock
            width="100%"
            height={14}
            borderRadius={10}
            style={{ maxWidth: '250px', marginBottom: '0.4rem' }}
          />

          {/* Helper Text Line */}
          <SkeletonBlock
            width={210}
            height={11}
            borderRadius={6}
            style={{ marginBottom: '1.1rem' }}
          />

          {/* Glowing Wheel Wireframe Container */}
          <div
            style={{
              position: 'relative',
              width: '250px',
              height: '250px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Outer Rim Ring */}
            <SkeletonBlock circle width={250} height={250} />

            {/* Inner Recessed Segment Track */}
            <div
              style={{
                position: 'absolute',
                width: '210px',
                height: '210px',
                borderRadius: '50%',
                border: '1.5px dashed rgba(52, 211, 153, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Segment Item Placeholder Studs */}
              {[0, 60, 120, 180, 240, 300].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x = Math.cos(rad) * 65;
                const y = Math.sin(rad) * 65;
                return (
                  <div
                    key={deg}
                    style={{
                      position: 'absolute',
                      transform: `translate(${x}px, ${y}px)`
                    }}
                  >
                    <SkeletonBlock circle width={28} height={28} />
                  </div>
                );
              })}
            </div>

            {/* Center 3D Spin Button Skeleton */}
            <div style={{ position: 'absolute', zIndex: 10 }}>
              <SkeletonBlock
                circle
                width={74}
                height={74}
                style={{
                  boxShadow: '0 0 20px rgba(52, 211, 153, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.4)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column (3 Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.78rem', flexShrink: 0 }}>
          <SkeletonBlock width={58} height={56} borderRadius={16} />
          <SkeletonBlock width={58} height={56} borderRadius={16} />
          <SkeletonBlock width={58} height={56} borderRadius={16} />
        </div>
      </div>

      {/* 3. TASK BANNER SKELETON CAROUSEL */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '0.25rem 0',
          width: '100%',
          flexShrink: 0,
          justifyContent: 'center'
        }}
      >
        <div
          className="skeleton-glow-box"
          style={{
            minWidth: '85%',
            height: '44px',
            borderRadius: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <SkeletonBlock circle width={22} height={22} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <SkeletonBlock width={110} height={11} borderRadius={4} />
              <SkeletonBlock width={70} height={8} borderRadius={4} />
            </div>
          </div>
          <SkeletonBlock width={54} height={24} borderRadius={8} />
        </div>
      </div>

      {/* 4. UNIFIED BOTTOM INVITE BAR SKELETON */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          flexShrink: 0
        }}
      >
        <div
          className="skeleton-glow-box"
          style={{
            width: '100%',
            maxWidth: '360px',
            height: '44px',
            borderRadius: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.85rem'
          }}
        >
          <SkeletonBlock circle width={30} height={30} />
          <SkeletonBlock width={160} height={14} borderRadius={6} />
          <SkeletonBlock circle width={26} height={26} />
        </div>
      </div>
    </div>
  );
};
