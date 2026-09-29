import React, { useState } from 'react';

export interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: number | string;
  border?: string;
  boxShadow?: string;
  fontSize?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// Telegram-style rich vibrant avatar gradients
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #10b981 0%, #047857 100%)', // Emerald
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // Purple
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Pink
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
  'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)', // Cyan
  'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', // Indigo
];

function getGradientForName(name: string): string {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitial(name?: string): string {
  if (!name) return '👤';
  const trimmed = name.trim();
  if (!trimmed) return '👤';
  // If starts with emoji or special character
  const firstChar = Array.from(trimmed)[0];
  return firstChar.toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  name = 'Player',
  size = 34,
  border = '1.5px solid #00e676',
  boxShadow = '0 2px 8px rgba(0, 230, 118, 0.4)',
  fontSize,
  style,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const dimension = typeof size === 'number' ? `${size}px` : size;
  const numericSize = typeof size === 'number' ? size : parseInt(size, 10) || 34;
  const calculatedFontSize = fontSize || `${Math.max(11, Math.floor(numericSize * 0.44))}px`;

  const hasValidPhoto = photoUrl && (photoUrl.startsWith('http') || photoUrl.startsWith('/') || photoUrl.startsWith('data:'));
  const showImage = hasValidPhoto && !imgError;

  if (showImage) {
    return (
      <img
        src={photoUrl!}
        alt={name}
        onError={() => setImgError(true)}
        onClick={onClick}
        style={{
          width: dimension,
          height: dimension,
          borderRadius: '50%',
          border,
          boxShadow,
          objectFit: 'cover',
          display: 'block',
          boxSizing: 'border-box',
          cursor: onClick ? 'pointer' : 'default',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  const gradient = getGradientForName(name);
  const initial = getInitial(name);

  return (
    <div
      onClick={onClick}
      style={{
        width: dimension,
        height: dimension,
        borderRadius: '50%',
        background: gradient,
        border,
        boxShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        color: '#ffffff',
        fontSize: calculatedFontSize,
        fontFamily: 'Outfit, sans-serif',
        userSelect: 'none',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
