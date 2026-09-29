import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { TaskItem, ReadyToClaimItem } from './types';
import type { UserProfile } from '../../types/api';
import { ReadyToClaimCard } from './ReadyToClaimCard';
import { TaskCard } from './TaskCard';
import { TelegramJoinModal } from './TelegramJoinModal';
import { haptics } from '../../utils/haptics';
import { throwConfetti } from '../../utils/confetti';
import { formatAssetNumber } from '../../utils/format';
import { notifyToast } from '../../utils/debugToast';
import {
  getInitialTasksPageData,
  fetchTasksPageData,
  startTask,
  verifyTask,
  claimTaskReward
} from '../../services/dataService';
import { showRewardedAd } from '../../services/adController';

export interface TasksPageProps {
  onBack: () => void;
  userProfile?: UserProfile;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
}

type TaskCategory = 'all' | 'special' | 'daily' | 'socials';

export const TasksPage: FC<TasksPageProps> = ({ onBack, userProfile, onUpdateProfile }) => {
  const initialData = getInitialTasksPageData();
  const [activeCategory, setActiveCategory] = useState<TaskCategory>('all');
  const [readyItem, setReadyItem] = useState<ReadyToClaimItem | null>(
    (initialData?.readyToClaim as ReadyToClaimItem) || null
  );
  const [tasks, setTasks] = useState<TaskItem[]>((initialData?.tasks || []) as unknown as TaskItem[]);
  const [isLoading, setIsLoading] = useState(() => initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [isClaimingReady, setIsClaimingReady] = useState(false);
  const [selectedJoinTask, setSelectedJoinTask] = useState<TaskItem | null>(null);

  const loadTasks = () => {
    setIsLoading(true);
    setError(null);
    fetchTasksPageData()
      .then((data) => {
        if (data) {
          if (data.readyToClaim !== undefined) {
            setReadyItem((data.readyToClaim as unknown as ReadyToClaimItem) || null);
          }
          if (data.tasks) {
            setTasks(data.tasks as unknown as TaskItem[]);
          }
        } else {
          setError('Failed to load tasks from server.');
        }
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load tasks.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleClaimReady = async () => {
    if (!readyItem || isClaimingReady) return;
    setIsClaimingReady(true);
    try {
      const diamondsReward = readyItem.rewardGems || 80;
      haptics.notification('success');
      haptics.playWinSound();
      throwConfetti();
      notifyToast(`🎁 Claimed Day Reward (+${diamondsReward} 💎)!`, 'success', 3000);
      onUpdateProfile?.({
        diamonds: (userProfile?.diamonds ?? 0) + diamondsReward
      });
      setReadyItem(null);
    } finally {
      setIsClaimingReady(false);
    }
  };

  const handleTaskClaim = async (taskId: string) => {
    if (verifyingTaskId) return;
    setVerifyingTaskId(taskId);

    try {
      const res = await claimTaskReward(taskId);
      if (res.success) {
        haptics.notification('success');
        haptics.playWinSound();
        throwConfetti();

        const task = tasks.find(t => t.id === taskId);
        const rewardGems = res.reward_diamonds ?? task?.rewardGems ?? task?.reward_gems ?? 50;
        const rewardSpins = res.reward_spins ?? task?.rewardSpins ?? task?.reward_spins ?? 0;
        const spinText = rewardSpins > 0 ? ` & +${rewardSpins} Spin${rewardSpins > 1 ? 's' : ''}` : '';
        notifyToast(`🎉 Verified & Claimed +${rewardGems} 💎${spinText}!`, 'success', 3500);

        // Remove claimed task from list
        setTasks(prev => prev.filter(t => t.id !== taskId));

        // Update profile with server response
        if (res.user) {
          onUpdateProfile?.(res.user);
        } else {
          onUpdateProfile?.({
            diamonds: (userProfile?.diamonds ?? 0) + rewardGems,
            spins: (userProfile?.spins ?? 0) + rewardSpins
          });
        }
      } else {
        haptics.notification('warning');
        notifyToast(res.message || '⚠️ Please complete the task requirement before claiming.', 'error', 4000);
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`⚠️ Verification failed: ${err?.message || 'Server error'}`, 'error', 3500);
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // Type 3: Open Telegram Join Modal
  const handleOpenTelegramModal = (task: TaskItem) => {
    setSelectedJoinTask(task);
  };

  // Type 3: Confirm Join Channel & Open Telegram
  const handleConfirmJoin = async (task: TaskItem) => {
    try {
      startTask(task.id);
    } catch {}

    const channelHandle = task.channelId || task.channel_id || (task.actionUrl?.includes('t.me/') ? task.actionUrl.split('t.me/')[1] : 'SpinCraftCommunity');
    const cleanHandle = channelHandle.replace('@', '');
    const targetUrl = task.actionUrl || task.action_url || `https://t.me/${cleanHandle}`;

    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.openTelegramLink === 'function') {
      tg.openTelegramLink(targetUrl);
    } else if (tg && typeof tg.openLink === 'function') {
      tg.openLink(targetUrl);
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    // Update local task state to 'verifying'
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: 'verifying' } : t)));
    setSelectedJoinTask(null);
    notifyToast('📢 Channel opened! Return and tap Check / Verify 🔍 to claim.', 'info', 4000);
  };

  // Type 3: Verify Telegram Channel Join
  const handleVerifyTelegram = async (task: TaskItem) => {
    if (verifyingTaskId) return;
    setVerifyingTaskId(task.id);

    try {
      const res = await verifyTask(task.id);
      if (res.success) {
        haptics.notification('success');
        haptics.playWinSound();
        throwConfetti();

        const rewardGems = res.reward_diamonds ?? task.rewardGems ?? task.reward_gems ?? 500;
        const rewardSpins = res.reward_spins ?? task.rewardSpins ?? task.reward_spins ?? 0;
        const spinText = rewardSpins > 0 ? ` and +${rewardSpins} Spin${rewardSpins > 1 ? 's' : ''}` : '';
        notifyToast(`Verified! +${rewardGems} 💎${spinText} added! 🎉`, 'success', 4000);

        setTasks(prev => prev.filter(t => t.id !== task.id));

        if (res.user) {
          onUpdateProfile?.(res.user);
        } else {
          onUpdateProfile?.({
            diamonds: (userProfile?.diamonds ?? 0) + rewardGems,
            spins: (userProfile?.spins ?? 0) + rewardSpins
          });
        }
      } else {
        haptics.notification('warning');
        notifyToast('⚠️ Please join the channel first before claiming!', 'error', 4000);
        // Offer modal again
        setSelectedJoinTask(task);
      }
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Verification failed: ${err?.message || 'Server error'}`, 'error', 3500);
    } finally {
      setVerifyingTaskId(null);
    }
  };

  // Type 4: Watch Rewarded Ad Task
  const handleWatchAdTask = async (task: TaskItem) => {
    if (verifyingTaskId) return;
    setVerifyingTaskId(task.id);
    haptics.impact('heavy');

    const adResult = await showRewardedAd();
    if (!adResult.success) {
      setVerifyingTaskId(null);
      notifyToast(`⚠️ ${adResult.error || 'Please finish watching the full ad to claim your reward!'}`, 'info', 4000);
      return;
    }

    haptics.notification('success');
    haptics.playWinSound();
    throwConfetti();

    try {
      const res = await claimTaskReward(task.id);
      if (res.success) {
        const rewardGems = res.reward_diamonds ?? task.rewardGems ?? task.reward_gems ?? 100;
        const rewardSpins = res.reward_spins ?? task.rewardSpins ?? task.reward_spins ?? 1;
        const spinText = rewardSpins > 0 ? ` and +${rewardSpins} Spin${rewardSpins > 1 ? 's' : ''}` : '';
        notifyToast(`🎬 Ad Verified! Claimed +${rewardGems} 💎${spinText}!`, 'success', 4000);

        // Remove claimed task from list
        setTasks(prev => prev.filter(t => t.id !== task.id));

        if (res.user) {
          onUpdateProfile?.(res.user);
        } else {
          onUpdateProfile?.({
            diamonds: (userProfile?.diamonds ?? 0) + rewardGems,
            spins: (userProfile?.spins ?? 0) + rewardSpins
          });
        }
      } else {
        notifyToast(res.message || '⚠️ Could not claim ad reward.', 'error', 3500);
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message || 'Server error'}`, 'error', 3500);
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const isTaskReadyToClaim = (t: TaskItem): boolean => {
    const cur = t.progress?.current ?? 0;
    const tot = t.progress?.total ?? t.targetCount ?? t.target_count ?? 1;
    if (tot > 1 && cur >= tot) return true;
    if (t.status === 'ready' || (t.status === 'verifying' && (!t.verificationSeconds || t.verificationSeconds <= 0))) return true;
    return false;
  };

  const filteredTasks = tasks
    .filter(t => {
      if (activeCategory === 'all') return true;
      return t.category === activeCategory;
    })
    .sort((a, b) => {
      const aReady = isTaskReadyToClaim(a);
      const bReady = isTaskReadyToClaim(b);
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return 0;
    });

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
        zIndex: 50,
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      {/* Background Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
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

      {/* Top Header Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 0.9rem 0.4rem 0.9rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 20
        }}
      >
        {/* Back Button */}
        <button
          onClick={() => {
            haptics.impact('light');
            onBack();
          }}
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: 0,
            flexShrink: 0
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        {/* Asset Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          {/* USDT Cashout Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              color: '#ffffff',
              padding: '0.15rem 0.45rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.22rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/SingleCoin_animated.gif" alt="USDT" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#fef08a' }}>${(userProfile?.balance_usd ?? 0).toFixed(2)}</span>
          </div>

          {/* Spins */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.15rem 0.45rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/ticket_animated.gif" alt="Spins" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>{formatAssetNumber(userProfile?.spins ?? 0)}</span>
          </div>

          {/* Diamonds */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.15rem 0.5rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box'
            }}
          >
            <img src="./assets/diamond_animated.gif" alt="Diamond" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>{formatAssetNumber(userProfile?.diamonds ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div
        style={{
          flex: 1,
          padding: '0.35rem 0.9rem 2rem 0.9rem',
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* Section 1: Ready To Claim */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.45rem'
            }}
          >
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0
              }}
            >
              Ready To Claim
            </h2>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#34d399'
              }}
            >
              {readyItem ? '1 AVAILABLE 💎' : '0 AVAILABLE'}
            </span>
          </div>

          {readyItem ? (
            <ReadyToClaimCard
              item={{
                ...readyItem,
                onClaim: handleClaimReady
              }}
            />
          ) : (
            <div
              style={{
                padding: '0.8rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.82rem',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              All available rewards claimed! Complete tasks below for more.
            </div>
          )}
        </div>

        {/* Section 2: Category Filter Tabs */}
        <div>
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem'
            }}
          >
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'special', label: '🔥 Special' },
              { id: 'daily', label: '🎁 Daily' },
              { id: 'socials', label: '📣 Socials' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  haptics.selection();
                  setActiveCategory(tab.id as TaskCategory);
                }}
                style={{
                  background:
                    activeCategory === tab.id
                      ? 'linear-gradient(180deg, #00e676 0%, #00a854 100%)'
                      : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border:
                    activeCategory === tab.id
                      ? '1px solid #86efac'
                      : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow:
                    activeCategory === tab.id
                      ? '0 2px 10px rgba(0, 230, 118, 0.45)'
                      : 'none',
                  transition: 'all 0.12s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
            {isLoading ? (
              [1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className="skeleton-glow-box"
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '62px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div
                        style={{
                          width: '130px',
                          height: '13px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.15)'
                        }}
                      />
                      <div
                        style={{
                          width: '60px',
                          height: '10px',
                          borderRadius: '4px',
                          background: 'rgba(52, 211, 153, 0.25)'
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      width: '64px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.15)'
                    }}
                  />
                </div>
              ))
            ) : error ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#f87171',
                  fontSize: '0.88rem',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}
              >
                <span>⚠️ {error}</span>
                <button
                  onClick={loadTasks}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    borderRadius: '0.5rem',
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  🔄 Retry Loading Tasks
                </button>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="page-reveal-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isVerifying={verifyingTaskId === task.id}
                    onClaim={() => handleTaskClaim(task.id)}
                    onOpenTelegramModal={handleOpenTelegramModal}
                    onVerifyTelegram={handleVerifyTelegram}
                    onWatchAd={handleWatchAdTask}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '1.25rem',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.85rem',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '10px'
                }}
              >
                No tasks in this category.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Step Telegram Channel Join Modal */}
      <TelegramJoinModal
        task={selectedJoinTask}
        isOpen={!!selectedJoinTask}
        onClose={() => setSelectedJoinTask(null)}
        onConfirmJoin={handleConfirmJoin}
      />
    </div>
  );
};
