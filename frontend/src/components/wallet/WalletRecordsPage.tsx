import { useState } from 'react';
import type { FC } from 'react';
import { haptics } from '../../utils/haptics';

export interface WalletRecordsPageProps {
  onBack: () => void;
}

type FilterTab = 'all' | 'withdrawals' | 'spins' | 'tasks';

interface TransactionRecord {
  id: string;
  title: string;
  category: FilterTab;
  date: string;
  txId: string;
  icon: string;
  isImageIcon?: boolean;
  amount: string;
  isDiamond?: boolean;
  status: 'completed' | 'processing' | 'failed';
  hash?: string;
}

import { getInitialWalletData, fetchWalletRecords } from '../../services/dataService';
import { useEffect } from 'react';

export const WalletRecordsPage: FC<WalletRecordsPageProps> = ({ onBack }) => {
  const [records, setRecords] = useState<TransactionRecord[]>(
    () => ((getInitialWalletData()?.recentTransactions || []) as unknown as TransactionRecord[])
  );
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedRecord, setSelectedRecord] = useState<TransactionRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    fetchWalletRecords(activeTab).then((data) => {
      if (data) setRecords(data as unknown as TransactionRecord[]);
    });
  }, [activeTab]);

  const filteredRecords = records.filter(
    (rec) => activeTab === 'all' || rec.category === activeTab
  );

  const handleCopyHash = (hash: string) => {
    haptics.selection();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% -10%, #057a44 0%, #024e2c 40%, #012a18 75%, #00170d 100%)',
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'auto',
        zIndex: 60,
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Background Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: '6%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '240px',
          background: 'radial-gradient(circle, rgba(0, 230, 118, 0.28) 0%, rgba(5, 122, 68, 0.12) 50%, rgba(0,0,0,0) 75%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1rem 0.75rem 1rem',
          position: 'relative',
          zIndex: 10
        }}
      >
        <button
          onClick={() => {
            haptics.impact('light');
            onBack();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '20px',
            padding: '0.35rem 0.85rem',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          ‹ Back
        </button>

        <h2
          style={{
            margin: 0,
            color: '#ffffff',
            fontSize: '1.2rem',
            fontWeight: 800,
            fontFamily: 'Georgia, serif'
          }}
        >
          Transaction History
        </h2>

        {/* Balance pill */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            padding: '0.2rem 0.65rem',
            color: '#fbbf24',
            fontWeight: 800,
            fontSize: '0.85rem'
          }}
        >
          $0.56
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          padding: '0.5rem 1.25rem 2.5rem 1.25rem',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* 1. Summary Stats Card */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.9rem 1.2rem',
            background: 'linear-gradient(135deg, rgba(3, 102, 57, 0.7) 0%, rgba(2, 44, 34, 0.85) 100%)',
            borderRadius: '1rem',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
          }}
        >
          {/* Total Earned */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Total Earned</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#facc15', fontFamily: 'Georgia, serif' }}>
              $0.56
            </span>
          </div>

          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Withdrawn */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Withdrawn</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
              $0.00
            </span>
          </div>

          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Gems Earned */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Total Gems</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <img src="./assets/diamond_animated.gif" alt="Diamond" style={{ width: '23px', height: '23px', objectFit: 'contain' }} />
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', fontFamily: 'Georgia, serif' }}>
                760
              </span>
            </div>
          </div>
        </div>

        {/* 2. Filter Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem'
          }}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'withdrawals', label: 'Withdrawals' },
              { key: 'spins', label: 'Spins & Daily' },
              { key: 'tasks', label: 'Tasks & Team' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                haptics.selection();
                setActiveTab(tab.key);
              }}
              style={{
                background:
                  activeTab === tab.key
                    ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                    : 'rgba(0, 0, 0, 0.25)',
                color: activeTab === tab.key ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                border:
                  activeTab === tab.key
                    ? '1px solid rgba(167, 243, 208, 0.6)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '1.25rem',
                padding: '0.4rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 3. Transaction Records List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => {
                  haptics.impact('light');
                  setSelectedRecord(record);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                  cursor: 'pointer'
                }}
              >
                {/* Left: Icon & Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  {record.isImageIcon ? (
                    <img
                      src={record.icon}
                      alt={record.title}
                      style={{
                        width: '36px',
                        height: '36px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}
                    >
                      {record.icon}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        color: '#ffffff',
                        fontFamily: 'Georgia, serif'
                      }}
                    >
                      {record.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.15rem' }}>
                      {record.date} • {record.txId} ↗
                    </span>
                  </div>
                </div>

                {/* Right: Amount & Status Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {record.isDiamond && (
                      <img
                        src="./assets/diamond_animated.gif"
                        alt="Diamond"
                        style={{ width: '23px', height: '23px', objectFit: 'contain' }}
                      />
                    )}
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: '1.05rem',
                        fontFamily: 'Georgia, serif',
                        color: record.amount.startsWith('+') ? '#4ade80' : '#facc15'
                      }}
                    >
                      {record.amount}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      background:
                        record.status === 'completed'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : record.status === 'processing'
                          ? 'rgba(250, 204, 21, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                      color:
                        record.status === 'completed'
                          ? '#4ade80'
                          : record.status === 'processing'
                          ? '#facc15'
                          : '#f87171',
                      border:
                        record.status === 'completed'
                          ? '1px solid rgba(34, 197, 94, 0.4)'
                          : record.status === 'processing'
                          ? '1px solid rgba(250, 204, 21, 0.4)'
                          : '1px solid rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {record.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.9rem',
                fontFamily: 'Georgia, serif',
                background: 'rgba(0,0,0,0.15)',
                borderRadius: '1rem'
              }}
            >
              No transaction records found in this category
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.25rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '360px',
              background: 'linear-gradient(180deg, #064e3b 0%, #022c22 100%)',
              border: '1px solid rgba(52, 211, 153, 0.5)',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontFamily: 'Georgia, serif' }}>
                Transaction Receipt
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '0.75rem', padding: '0.9rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>AMOUNT</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#facc15', fontFamily: 'Georgia, serif', margin: '0.2rem 0 0.6rem 0' }}>
                {selectedRecord.amount}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.3rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Status</span>
                <span style={{ color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>{selectedRecord.status}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.3rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Reference ID</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>{selectedRecord.txId}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.3rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Timestamp</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedRecord.date}</span>
              </div>
            </div>

            {selectedRecord.hash && (
              <button
                onClick={() => handleCopyHash(selectedRecord.hash!)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                  border: '1px solid #6ee7b7',
                  borderRadius: '0.75rem',
                  padding: '0.7rem',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginBottom: '0.5rem'
                }}
              >
                {copiedHash ? 'Hash Copied! ✓' : `Copy Hash (${selectedRecord.hash}) 📋`}
              </button>
            )}

            <button
              onClick={() => {
                // @ts-ignore
                window.Telegram?.WebApp?.openLink?.('https://tonviewer.com') ||
                  window.open('https://tonviewer.com', '_blank');
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                padding: '0.6rem',
                color: '#a7f3d0',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              View on Tonviewer ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
