import React from 'react';

export type AdminTab =
  | 'overview'
  | 'wheel'
  | 'daily'
  | 'referrals'
  | 'contests'
  | 'raffles'
  | 'tasks'
  | 'users'
  | 'withdrawals'
  | 'giftcodes'
  | 'sweeps'
  | 'support'
  | 'subadmins'
  | 'broadcast'
  | 'settings';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'wheel', label: 'Wheel RNG', icon: '🎡' },
  { id: 'daily', label: 'Daily Streak', icon: '📅' },
  { id: 'referrals', label: 'Referral Rules', icon: '👥' },
  { id: 'contests', label: 'Contests', icon: '🏆' },
  { id: 'raffles', label: 'Raffles', icon: '🎟️' },
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'withdrawals', label: 'Cashouts', icon: '💸' },
  { id: 'giftcodes', label: 'Gift Codes', icon: '🎁' },
  { id: 'sweeps', label: 'Sweeps', icon: '🔍' },
  { id: 'support', label: 'Support', icon: '📩' },
  { id: 'subadmins', label: 'Sub-Admins', icon: '🛡️' },
  { id: 'broadcast', label: 'Broadcast', icon: '📢' }
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <div
      className="hide-scrollbar"
      style={{
        display: 'flex',
        gap: '0.35rem',
        overflowX: 'auto',
        padding: '0.5rem 1rem',
        background: '#090d16',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxSizing: 'border-box'
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              background: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
              border: isActive
                ? '1px solid #ffffff'
                : '1px solid rgba(255, 255, 255, 0.08)',
              color: isActive ? '#090d16' : '#94a3b8',
              borderRadius: '8px',
              padding: '0.45rem 0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: isActive ? 700 : 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: isActive ? '0 2px 8px rgba(255, 255, 255, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '0.88rem' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
