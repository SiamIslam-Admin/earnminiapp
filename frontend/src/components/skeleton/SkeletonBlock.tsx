import type { FC, CSSProperties } from 'react';

interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
  circle?: boolean;
}

export const SkeletonBlock: FC<SkeletonBlockProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = '8px',
  style,
  className = '',
  circle = false
}) => {
  const finalRadius = circle ? '50%' : borderRadius;

  return (
    <div
      className={`skeleton-glow-box ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof finalRadius === 'number' ? `${finalRadius}px` : finalRadius,
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style
      }}
    />
  );
};
