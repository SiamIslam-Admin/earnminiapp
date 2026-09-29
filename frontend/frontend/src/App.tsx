import { useState, useEffect, lazy, Suspense } from 'react';
import './App.css';
import { SpinWheel } from './components/SpinWheel';
import type { SpinSegment } from './components/SpinWheel';
import { RewardCard } from './components/RewardCard';
import { FeatureCard } from './components/FeatureCard';
import { TaskBanner } from './components/TaskBanner';
import { AppLaunchSplash } from './components/skeleton/AppLaunchSplash';
import { requestServerSpin } from './services/spinService';
import { throwConfetti } from './utils/confetti';
import { haptics } from './utils/haptics';
import {
  getInitialWheelSegments,
  getInitialMockTasksBanner,
  getInitialFeatureCards,
  getInitialUserProfile,
  authenticateTelegram,
  fetchUserProfile,
  getInvoiceStatus,
  fetchDailyRewardsData,
  fetchTasksPageData
} from './services/dataService';
import { syncUserBalance } from './utils/syncUser';
import { profileEventBus } from './utils/profileEvents';
import type { UserProfile } from './types/api';
import { DebugToastContainer } from './components/debug/DebugToastContainer';
import { notifyToast } from './utils/debugToast';
import { formatAssetNumber } from './utils/format';
import { UserAvatar } from './components/UserAvatar';

// Lazy-loaded modals & secondary pages for ultra-fast initial boot
const DailyRewardsModal = lazy(() => import('./components/DailyRewardsModal').then(m => ({ default: m.DailyRewardsModal })));
const GiftCodeModal = lazy(() => import('./components/GiftCodeModal').then(m => ({ default: m.GiftCodeModal })));
const TeamModal = lazy(() => import('./components/TeamModal').then(m => ({ default: m.TeamModal })));
const ContestLeaderboardModal = lazy(() => import('./components/ContestLeaderboardModal').then(m => ({ default: m.ContestLeaderboardModal })));
const OutOfSpinsModal = lazy(() => import('./components/OutOfSpinsModal').then(m => ({ default: m.OutOfSpinsModal })));
const OfficialChannelModal = lazy(() => import('./components/OfficialChannelModal').then(m => ({ default: m.OfficialChannelModal })));
const RafflePage = lazy(() => import('./components/raffle/RafflePage').then(m => ({ default: m.RafflePage })));
const TasksPage = lazy(() => import('./components/tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const WalletPage = lazy(() => import('./components/wallet/WalletPage').then(m => ({ default: m.WalletPage })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAuthModal = lazy(() => import('./components/admin/AdminAuthModal').then(m => ({ default: m.AdminAuthModal })));
const CryptoDepositInvoiceModal = lazy(() => import('./components/raffle/CryptoDepositInvoiceModal').then(m => ({ default: m.CryptoDepositInvoiceModal })));
import adminService from './services/adminService';

const WHEEL_SEGMENTS = getInitialWheelSegments();
const FEATURE_CARDS = getInitialFeatureCards();
const LEFT_CARDS = FEATURE_CARDS.left as Array<{
  title: string;
  icon: string;
  variant: 'emerald' | 'colorful' | 'gold';
  badge?: string;
  badgeColor?: 'gold' | 'red' | 'emerald';
}>;
const RIGHT_CARDS = FEATURE_CARDS.right as Array<{
  title: string;
  icon: string;
  variant: 'emerald' | 'colorful' | 'gold';
  badge?: string;
  badgeColor?: 'gold' | 'red' | 'emerald';
}>;

function App() {
  const [viewMode, setViewMode] = useState<'app' | 'admin'>('app');
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<'main' | 'raffle' | 'tasks' | 'wallet'>('main');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [canClaimDaily, setCanClaimDaily] = useState<boolean>(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showContestModal, setShowContestModal] = useState(false);
  const [showOutOfSpinsModal, setShowOutOfSpinsModal] = useState(false);
  const [showOfficialChannelModal, setShowOfficialChannelModal] = useState(false);
  const [activeTasksCount, setActiveTasksCount] = useState<number>(0);
  const [activePendingInvoice, setActivePendingInvoice] = useState<any>(null);
  const [showPendingInvoiceModal, setShowPendingInvoiceModal] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [lastServerSpin, setLastServerSpin] = useState<any>(null);
  const [winningReward, setWinningReward] = useState<{
    name: string;
    amount: string;
    image: string;
    value: string;
  } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getInitialUserProfile());
  const [bannerTasks, setBannerTasks] = useState<any[]>(() => getInitialMockTasksBanner());

  const navigateTo = (page: 'main' | 'raffle' | 'tasks' | 'wallet') => {
    haptics.impact('light');
    setCurrentPage(page);
  };

  // Responsive Wheel Sizing for Mobile Viewports
  const [wheelSize, setWheelSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w < 360) return 220;
      if (w < 390) return 235;
      if (w < 430) return 245;
      if (w < 600) return 260;
      return 280;
    }
    return 240;
  });

  useEffect(() => {
    let resizeTimer: any;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = window.innerWidth;
        if (w < 360) setWheelSize(220);
        else if (w < 390) setWheelSize(235);
        else if (w < 430) setWheelSize(245);
        else if (w < 600) setWheelSize(260);
        else setWheelSize(280);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Global Real-Time Asset Profile Event Bus Subscriber
  useEffect(() => {
    const unsubscribeFull = profileEventBus.subscribe((fullProfile) => {
      setUserProfile((prev) => ({
        ...prev,
        ...fullProfile,
        goal_left: Math.max(0, (fullProfile.goal_usd ?? prev.goal_usd ?? 1.0) - (fullProfile.balance_usd ?? prev.balance_usd ?? 0))
      }));
    });

    const unsubscribePartial = profileEventBus.subscribePartial((partial) => {
      setUserProfile((prev) => {
        const newDiamonds = partial.diamonds !== undefined
          ? partial.diamonds
          : (partial.reward_diamonds || partial.rewardGems || 0)
            ? prev.diamonds + (partial.reward_diamonds || partial.rewardGems || 0)
            : prev.diamonds;

        const newSpins = partial.spins !== undefined
          ? partial.spins
          : (partial.reward_spins || 0)
            ? prev.spins + (partial.reward_spins || 0)
            : prev.spins;

        const newBalance = partial.balance_usd !== undefined
          ? partial.balance_usd
          : (partial.reward_usd || 0)
            ? Number((prev.balance_usd + (partial.reward_usd || 0)).toFixed(4))
            : prev.balance_usd;

        const goalUsd = partial.goal_usd ?? prev.goal_usd ?? 1.0;

        return {
          ...prev,
          ...partial,
          diamonds: newDiamonds,
          spins: newSpins,
          balance_usd: newBalance,
          goal_left: Math.max(0, goalUsd - newBalance)
        };
      });
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUserProfile().catch(() => {});
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubscribeFull();
      unsubscribePartial();
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  // Telegram Authentication & Startup Boot Handshake
  useEffect(() => {
    let popupTimer: any = null;

    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg?.ready) {
      tg.ready();
      tg.expand?.();
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash);

    const initData = tg?.initData || '';
    const startParam =
      tg?.initDataUnsafe?.start_param ||
      searchParams.get('tgWebAppStartParam') ||
      searchParams.get('startapp') ||
      searchParams.get('start_param') ||
      hashParams.get('tgWebAppStartParam') ||
      '';

    const isDirectAdminLink = startParam.toLowerCase() === 'admin' || startParam.toLowerCase() === 'admin_panel';

    if (startParam && isDirectAdminLink) {
      notifyToast('🛡️ Direct Admin Access Request Detected', 'info', 3500);
    }

    const initApp = async () => {
      try {
        // 1. Authenticate with server to store valid auth_token in localStorage and identify user
        const res = await authenticateTelegram(initData, isDirectAdminLink ? '' : startParam);
        
        let authedUser: UserProfile | undefined = res.user;
        if (res.user) {
          setUserProfile(res.user);
          const isUserAdmin = res.user.is_admin === true || (res.user as any).isAdmin === true;

          // Clear any stored admin token if the currently authenticated user is not an admin
          if (!isUserAdmin) {
            adminService.logout();
          } else if (isDirectAdminLink) {
            // Direct Admin Panel link (?startapp=admin) accessed by authorized admin account
            if (adminService.isAuthenticated()) {
              setViewMode('admin');
              notifyToast('👑 Admin Console Activated', 'success', 3000);
            } else {
              setShowAdminAuthModal(true);
            }
          }
        }

        // 2. Fetch active dynamic tasks ONLY after authenticateTelegram resolves and stores a valid auth_token
        try {
          const tasksData = await fetchTasksPageData();
          if (tasksData && tasksData.tasks) {
            // Calculate active unclaimed tasks count
            const active = tasksData.tasks.filter((t: any) => t.status !== 'claimed' && t.status !== 'completed');
            setActiveTasksCount(active.length);

            if (tasksData.tasks.length > 0) {
              const candidatePool = active.length > 0 ? active : tasksData.tasks;

              // Pick up to 3 random or latest active tasks
              const shuffled = [...candidatePool].sort(() => 0.5 - Math.random());
              const selected = shuffled.slice(0, 3);

              const mapped = selected.map((t: any) => {
                const rewardDiamonds = t.reward_diamonds ?? t.reward_gems ?? t.rewardGems ?? 0;
                const rewardSpins = t.reward_spins ?? t.rewardSpins ?? 0;
                const rewardAmount = rewardDiamonds > 0 ? rewardDiamonds : (rewardSpins > 0 ? rewardSpins : 50);
                const rewardIcon = rewardSpins > 0 ? './assets/ticket_animated.gif' : './assets/diamond_animated.gif';

                let icon = '🎯';
                if (t.task_type === 'telegram_join' || t.taskType === 'telegram_join' || t.category === 'socials') {
                  icon = '📣';
                } else if (t.task_type === 'ad_reward' || t.taskType === 'ad_reward') {
                  icon = '📺';
                } else if (t.category === 'daily') {
                  icon = '📅';
                } else if (t.task_type === 'spin_count') {
                  icon = '🎡';
                } else if (t.task_type === 'invite_friends') {
                  icon = '👥';
                }

                let subtitle = 'Complete task & earn';
                if (t.category === 'socials') subtitle = 'Join & stay updated';
                else if (t.task_type === 'ad_reward' || t.taskType === 'ad_reward') subtitle = 'Watch quick ad to earn';
                else if (t.category === 'daily') subtitle = 'Daily active quest';
                else if (t.progress && t.progress.total > 1) subtitle = `Progress: ${t.progress.current}/${t.progress.total}`;

                return {
                  id: t.id,
                  title: t.title,
                  subtitle: subtitle,
                  icon: icon,
                  rewardAmount: rewardAmount,
                  rewardIcon: rewardIcon
                };
              });

              if (mapped.length > 0) {
                setBannerTasks(mapped);
              }
            }
          }
        } catch (tasksErr) {
          console.warn('Tasks banner data fetch error:', tasksErr);
        }

        // 3. Daily Streak Reward Status & 10s auto-popup check ONLY after auth is established
        try {
          const dailyData = await fetchDailyRewardsData(true);
          if (dailyData) {
            const canClaim = !dailyData.canClaimToday;
            setCanClaimDaily(canClaim);

            if (canClaim) {
              const currentUserId = authedUser?.telegram_id || authedUser?.id || 'guest';
              const serverDate = dailyData.serverDate || new Date().toISOString().slice(0, 10);
              const storageKey = `daily_popup_shown_${currentUserId}_${serverDate}`;
              const hasShownToday = localStorage.getItem(storageKey) === 'true';

              if (!hasShownToday) {
                // Mark popup as presented for today so subsequent opens/reloads do NOT pop up
                localStorage.setItem(storageKey, 'true');

                // Auto-popup after 10 seconds only on first open of the day
                popupTimer = setTimeout(() => {
                  setShowDailyRewards(true);
                }, 10000);
              }
            }
          }
        } catch (dailyErr) {
          console.warn('Daily rewards status check error:', dailyErr);
        }
      } catch (authErr) {
        console.error('Startup auth handshake error:', authErr);
      }
    };

    initApp();

    return () => {
      if (popupTimer) clearTimeout(popupTimer);
    };
  }, []);

  // Interrupted Session Recovery for Active BEP-20 USDT Deposits
  useEffect(() => {
    const checkActiveInvoice = async () => {
      const cached = localStorage.getItem('active_crypto_invoice');
      if (!cached) return;
      try {
        const parsed = JSON.parse(cached);
        const invoiceId = parsed.invoiceId || parsed.invoice_id;
        if (!invoiceId) {
          localStorage.removeItem('active_crypto_invoice');
          return;
        }

        // Expired locally check
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          localStorage.removeItem('active_crypto_invoice');
          return;
        }

        // Query backend status
        const res = await getInvoiceStatus(invoiceId);
        if (res?.status === 'paid' || res?.status === 'completed' || res?.data?.status === 'paid') {
          localStorage.removeItem('active_crypto_invoice');
          if (res.userBalance || res.data?.userBalance || res.data?.user) {
            syncUserBalance(res.data || res);
          }
          haptics.notification('success');
          haptics.playWinSound();
          throwConfetti();
          notifyToast(
            `🎉 Deposit Confirmed! ${res.ticketsAwarded || res.ticket_count ? `+${res.ticketsAwarded || res.ticket_count} Raffle Tickets Added!` : 'Balance Updated!'}`,
            'success',
            5000
          );
        } else if (res?.status === 'pending' || res?.data?.status === 'pending') {
          setActivePendingInvoice(parsed);
        } else {
          localStorage.removeItem('active_crypto_invoice');
        }
      } catch (e) {
        console.warn('Failed to recover active invoice:', e);
      }
    };

    checkActiveInvoice();
  }, []);

    const handleSpinEnd = (winner: SpinSegment, serverResult?: any) => {
      // Prioritize live reward data returned by server API
      const spinRes = serverResult || lastServerSpin;
      const serverReward = spinRes?.reward;
      const rewardName = serverReward?.label || winner.label || 'Reward';
      const rewardImage = serverReward?.image || winner.image || './assets/diamond_animated.gif';
      
      let rewardAmount = serverReward?.amount;
      if (!rewardAmount) {
        if (winner.value === 'coins') rewardAmount = '+$0.20 USDT';
        else if (winner.value === 'jackpot') rewardAmount = '$10.00 Jackpot';
        else if (winner.value === 'tickets' || winner.value === 'spins') rewardAmount = '+1 Free Spin';
        else rewardAmount = '+80 💎';
      }

      setRewardText(rewardName);
      setWinningReward({
        name: rewardName,
        amount: rewardAmount,
        image: rewardImage,
        value: serverReward?.value || winner.value
      });

      setShowRewardModal(true);
      haptics.notification('success');
      haptics.playWinSound();

      if (winner.value !== '0' && winner.label !== 'Empty') {
        throwConfetti();
      }

      // Update user balances from server balance or optimistic calculation
      if (spinRes?.userBalance) {
        const ub = spinRes.userBalance;
        setUserProfile((prev) => ({
          ...prev,
          spins: ub.spins ?? prev.spins,
          diamonds: ub.diamonds ?? prev.diamonds,
          balance_usd: ub.balance_usd ?? prev.balance_usd,
          energy: ub.energy ?? prev.energy,
          goal_left: ub.goal_left ?? Math.max(0, (prev.goal_usd || 1.0) - (ub.balance_usd ?? prev.balance_usd))
        }));
      } else {
        setUserProfile((prev) => {
          const isCoin = winner.value === 'coins';
          const isGem = winner.value === 'gem';
          const isJackpot = winner.value === 'jackpot';
          const isTicket = winner.value === 'tickets' || winner.value === 'spins';
          const newBal = isCoin ? prev.balance_usd + 0.2 : isJackpot ? 1.0 : prev.balance_usd;
          return {
            ...prev,
            spins: Math.max(0, prev.spins - (isTicket ? 0 : 1)),
            diamonds: isGem ? prev.diamonds + 80 : prev.diamonds,
            balance_usd: newBal,
            goal_left: Math.max(0, (prev.goal_usd || 1.0) - newBal)
          };
        });
      }
    };

    const handleCollect = () => {
      haptics.impact('medium');
      setShowRewardModal(false);
    };

    const handleOutOfSpins = () => {
      const userId = userProfile.telegram_id || userProfile.id;
      const isClaimedLocally = typeof window !== 'undefined' && userId ? localStorage.getItem(`channel_reward_claimed_${userId}`) === 'true' : false;
      const hasClaimed = Boolean(userProfile.has_claimed_channel_reward || isClaimedLocally);

      if (!hasClaimed) {
        setShowOfficialChannelModal(true);
      } else {
        setShowOutOfSpinsModal(true);
      }
    };

    const progressPercent = Math.min(
      100,
      Math.max(0, Math.round((userProfile.balance_usd / (userProfile.goal_usd || 1.0)) * 100))
    );

    if (viewMode === 'admin') {
      return (
        <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#090d16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>Loading Admin Console...</div>}>
          <AdminDashboard
            onBackToApp={() => {
              haptics.impact('light');
              setViewMode('app');
            }}
            onLogout={() => {
              setViewMode('app');
            }}
          />
        </Suspense>
      );
    }

    return (
      <>
        {/* Floating Debug Toast Container */}
        <DebugToastContainer />

        {/* 1. INITIAL APP LAUNCH SPLASH (1.8s) */}
        {isInitialLoading && (
          <AppLaunchSplash onLoaded={() => setIsInitialLoading(false)} duration={1800} />
        )}

        <div className="layout-container" style={{ height: '100dvh', overflow: 'hidden', padding: '0.25rem 0.5rem 0.5rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0', justifyContent: 'center' }}>
      {/* Active Crypto Deposit Session Banner */}
      {activePendingInvoice && (
        <div
          onClick={() => {
            haptics.impact('light');
            setShowPendingInvoiceModal(true);
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
            color: '#060a12',
            padding: '0.35rem 0.85rem',
            borderRadius: '10px',
            marginBottom: '0.3rem',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.76rem',
            fontWeight: 800,
            cursor: 'pointer',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.95rem' }}>⚡</span>
            <span>Deposit of ${(activePendingInvoice.amount_usd || 2.5).toFixed(2)} USDT in progress...</span>
          </div>
          <span style={{
            background: '#060a12',
            color: '#fbbf24',
            padding: '0.15rem 0.5rem',
            borderRadius: '6px',
            fontSize: '0.68rem',
            fontWeight: 900
          }}>
            View QR 🔍
          </span>
        </div>
      )}

      {/* Top Navigation / Resource Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 0.85rem 0.35rem 0.85rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 20
        }}
      >
        {/* User Info (Left) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flexShrink: 1 }}>
          <div
            onClick={() => {
              haptics.impact('light');
            }}
            style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}
          >
            <UserAvatar
              photoUrl={userProfile.photo_url}
              name={userProfile.first_name || userProfile.username || 'Player'}
              size={34}
              border="1.5px solid #00e676"
              boxShadow="0 2px 8px rgba(0, 230, 118, 0.4)"
            />
            {/* Level badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                background: '#f59e0b',
                color: '#1e293b',
                fontSize: '8px',
                fontWeight: 900,
                padding: '0.5px 3px',
                borderRadius: '5px',
                border: '1px solid #ffffff'
              }}
            >
              LV{userProfile.level || 1}
            </div>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '85px' }}
          >
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userProfile.first_name || 'Player'}
            </span>
            <span style={{ color: '#a7f3d0', fontSize: '0.65rem', fontWeight: 600 }}>
              ID: {userProfile.telegram_id || userProfile.id}
            </span>
          </div>

          {/* Admin Mode Switcher Button (Strictly visible ONLY when current authenticated account is an admin) */}
          {userProfile.is_admin === true && (
            <button
              onClick={() => {
                haptics.impact('medium');
                if (adminService.isAuthenticated()) {
                  setViewMode('admin');
                } else {
                  setShowAdminAuthModal(true);
                }
              }}
              title="Admin Panel"
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.15) 100%)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(56, 189, 248, 0.6)',
                color: '#38bdf8',
                borderRadius: '12px',
                padding: '0.15rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                height: '24px',
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>⚙️</span>
              <span style={{ fontSize: '0.65rem' }}>Admin</span>
            </button>
          )}
        </div>

        {/* Asset Balances (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {/* USDT Cashout Balance */}
          <div
            onClick={() => navigateTo('wallet')}
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              color: '#ffffff',
              padding: '0.14rem 0.45rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.22rem',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box',
              flexShrink: 0,
              cursor: 'pointer'
            }}
          >
            <img src="./assets/SingleCoin_animated.gif" alt="USDT" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.74rem', color: '#fef08a' }}>${(userProfile.balance_usd || 0).toFixed(2)}</span>
          </div>

          {/* Spin Balance */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.14rem 0.42rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box',
              flexShrink: 0
            }}
          >
            <img src="./assets/ticket_animated.gif" alt="Spins" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.74rem' }}>{formatAssetNumber(userProfile.spins)}</span>
          </div>

          {/* Diamond Balance (+ Deposit Badge) */}
          <div
            onClick={() => navigateTo('tasks')}
            style={{
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.42)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#ffffff',
              padding: '0.14rem 0.55rem 0.14rem 0.38rem',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
              height: '26px',
              boxSizing: 'border-box',
              flexShrink: 0,
              transition: 'transform 0.1s ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <img src="./assets/diamond_animated.gif" alt="Diamond" style={{ width: '19px', height: '19px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: '0.74rem' }}>{formatAssetNumber(userProfile.diamonds)}</span>

            {/* Glowing plus badge */}
            <div
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
                color: 'white',
                fontSize: '9px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(0, 230, 118, 0.9)',
                border: '1px solid #ffffff'
              }}
            >
              +
            </div>
          </div>
        </div>
      </div>

      {/* Main Single-Screen Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flex: 1, paddingBottom: '0.25rem' }}>

        {/* Left Column (4 Cards Vertical) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem', flexShrink: 0, justifyContent: 'center' }}>
          {LEFT_CARDS.map(card => (
            <FeatureCard
              key={card.title}
              {...card}
              onClick={
                card.title === 'Raffle'
                  ? () => navigateTo('raffle')
                  : card.title === 'Contest'
                    ? () => setShowContestModal(true)
                    : card.title === 'Gift'
                      ? () => setShowGiftModal(true)
                      : card.title === 'Team'
                        ? () => setShowTeamModal(true)
                        : undefined
              }
            />
          ))}
        </div>

        {/* Center Wheel & Progress Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: '1 1 auto', minWidth: 0, padding: '0 0.25rem', marginTop: '-24px' }}>
          {/* Refined Compact $1 Cashout Goal Scoring Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              marginBottom: '0.45rem',
              transform: 'translateY(-6px)'
            }}
          >
            {/* Balance Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
              <img
                src="./assets/icon-gold.png"
                alt="Coin"
                style={{
                  width: '22px',
                  height: '22px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 5px rgba(250, 204, 21, 0.5))'
                }}
              />
              <span
                style={{
                  color: '#FFE81A',
                  fontWeight: 900,
                  fontSize: '1.35rem',
                  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif',
                  letterSpacing: '0.02em',
                  textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 0 10px rgba(254, 240, 138, 0.4)'
                }}
              >
                ${userProfile.balance_usd.toFixed(2)}
              </span>
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                  marginLeft: '1px'
                }}
              >
                / $1.00
              </span>
            </div>

            {/* Compact Liquid Gold Milestone Progress Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: '200px',
                height: '8px',
                background: 'rgba(0, 0, 0, 0.45)',
                borderRadius: '8px',
                position: 'relative',
                marginBottom: '0.25rem',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)'
              }}
            >
              {/* Shimmering Fill */}
              <div
                className="liquid-gold-shimmer"
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: '6px',
                  position: 'relative',
                  boxShadow: '0 0 8px rgba(250, 204, 21, 0.6)'
                }}
              >
                {/* Glowing Particle Tip */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '10px',
                    height: '10px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px 3px rgba(254, 240, 138, 0.9), 0 0 3px #fbbf24',
                    zIndex: 2
                  }}
                />
              </div>

              {/* $1 Goal Milestone Pin */}
              <div
                style={{
                  position: 'absolute',
                  right: '0px',
                  top: '-15px',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  color: '#fef08a',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '0.03em',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9)'
                }}
              >
                $1 GOAL 🏁
              </div>
            </div>

            {/* Helper Subtitle */}
            <div
              style={{
                color: '#d1fae5',
                fontSize: '0.72rem',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 600,
                opacity: 0.92,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                textAlign: 'center'
              }}
            >
              Only <span style={{ color: '#fbbf24', fontWeight: 800 }}>${Math.max(0, (userProfile.goal_usd || 1.0) - userProfile.balance_usd).toFixed(2)}</span> left to cash out $1 instant USDT!
            </div>
          </div>

          <SpinWheel
            segments={WHEEL_SEGMENTS}
            spins={userProfile.spins}
            diamonds={userProfile.diamonds}
            onOutOfSpins={handleOutOfSpins}
            onSpinRequest={async () => {
              if (userProfile.spins <= 0 && userProfile.diamonds < 1000) {
                handleOutOfSpins();
                haptics.notification('warning');
                throw new Error('Insufficient spins and diamonds');
              }

              const method = userProfile.spins > 0 ? 'spins' : 'diamonds';
              if (method === 'diamonds') {
                notifyToast('💎 Used 1,000 Diamonds for 1 Spin!', 'info', 3000);
                setUserProfile((prev) => ({
                  ...prev,
                  diamonds: Math.max(0, prev.diamonds - 1000)
                }));
              }

              const serverResult = await requestServerSpin(WHEEL_SEGMENTS, method);
              setLastServerSpin(serverResult);
              return serverResult;
            }}
            onSpinEnd={handleSpinEnd}
            theme="emerald"
            size={wheelSize}
          />
        </div>

        {/* Right Column (3 Cards Vertical) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.78rem', justifyContent: 'center', flexShrink: 0 }}>
          {RIGHT_CARDS.map(card => {
            const isSignIn = card.title === 'Sign In' || card.title.toLowerCase().includes('sign in') || card.title.toLowerCase().includes('daily');
            const isSpins = card.title === '+ Spins' || card.title.includes('Spins');

            let effectiveBadge: string | undefined = card.badge;
            let effectiveBadgeColor: 'gold' | 'red' | 'emerald' | undefined = card.badgeColor;

            if (isSignIn) {
              effectiveBadge = canClaimDaily ? '1' : undefined;
              effectiveBadgeColor = 'red';
            } else if (isSpins) {
              effectiveBadge = activeTasksCount > 0 ? String(activeTasksCount) : undefined;
              effectiveBadgeColor = 'emerald';
            }

            return (
              <FeatureCard
                key={card.title}
                {...card}
                badge={effectiveBadge}
                badgeColor={effectiveBadgeColor}
                onClick={
                  card.title === '+ Spins'
                    ? () => navigateTo('tasks')
                    : isSignIn
                      ? () => setShowDailyRewards(true)
                      : card.title === 'Wallet'
                        ? () => navigateTo('wallet')
                        : undefined
                }
              />
            );
          })}
        </div>

      </div>

      {/* Task Banner Peek-a-boo Carousel */}
      <div
        className="hide-scrollbar"
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          gap: '0.55rem',
          padding: '0.25rem 0.35rem',
          scrollPadding: '0 0.35rem',
          width: '100%',
          flexShrink: 0,
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box'
        }}>
        {bannerTasks.map((task: any, i: number) => (
          <TaskBanner key={task.id || i} {...task} onClick={() => navigateTo('tasks')} />
        ))}
      </div>

      {/* Unified Bottom Invite CTA Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        flexShrink: 0
      }}>
        <div
          onClick={() => {
            haptics.impact('light');
            setShowTeamModal(true);
          }}
          style={{
            width: '100%',
            maxWidth: '360px',
            height: '44px',
            background: 'linear-gradient(135deg, rgba(6, 125, 78, 0.72) 0%, rgba(1, 45, 28, 0.92) 100%)',
            border: '1px solid rgba(0, 230, 118, 0.55)',
            borderRadius: '1.25rem',
            padding: '0 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.65rem',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxSizing: 'border-box',
            transition: 'transform 0.1s ease'
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onTouchStart={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onTouchEnd={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {/* Left: Ticket GIF */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img
              src="./assets/ticket_animated.gif"
              alt="Spin Ticket"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}
            />
          </div>

          {/* Center: CTA Text */}
          <div style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif', fontSize: '0.85rem', color: '#ffffff', textAlign: 'center', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Invite Friends &amp; Earn Free Spins
          </div>

          {/* Right: Sleek Forward Arrow Badge */}
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #00e676 0%, #00a854 100%)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0, 230, 118, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Reward Modal */}
      {showRewardModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <RewardCard
            rewardName={winningReward?.name || 'Congratulations!'}
            rewardAmount={winningReward?.amount || rewardText || '+80 💎'}
            rewardImage={winningReward?.image || './assets/diamond_animated.gif'}
            onCollect={handleCollect}
          />
        </div>
      )}

      <Suspense fallback={null}>
        {/* Daily Rewards Modal (10s Pop-up) */}
        {showDailyRewards && (
          <DailyRewardsModal
            onClose={() => setShowDailyRewards(false)}
            onClaimSuccess={(gems) => {
              setCanClaimDaily(false);
              setUserProfile((prev) => ({
                ...prev,
                diamonds: prev.diamonds + (gems || 80)
              }));
            }}
          />
        )}

        {/* Gift Code Modal */}
        {showGiftModal && (
          <GiftCodeModal
            onClose={() => setShowGiftModal(false)}
            onClaimSuccess={(reward) => {
              setUserProfile((prev) => ({
                ...prev,
                diamonds: prev.diamonds + (reward.diamonds || 0),
                spins: prev.spins + (reward.spins || 0),
                balance_usd: prev.balance_usd + (reward.balance_usd || 0)
              }));
            }}
          />
        )}

        {/* Team Modal */}
        {showTeamModal && (
          <TeamModal onClose={() => setShowTeamModal(false)} />
        )}

        {/* Contest Leaderboard Modal */}
        {showContestModal && (
          <ContestLeaderboardModal
            onClose={() => setShowContestModal(false)}
            onInvite={() => {
              setShowContestModal(false);
              setShowTeamModal(true);
            }}
          />
        )}

        {/* Out of Spins Modal */}
        {showOutOfSpinsModal && (
          <OutOfSpinsModal
            diamonds={userProfile.diamonds}
            onClose={() => setShowOutOfSpinsModal(false)}
            onInvite={() => {
              setShowOutOfSpinsModal(false);
              setShowTeamModal(true);
            }}
            onTasks={() => {
              setShowOutOfSpinsModal(false);
              navigateTo('tasks');
            }}
          />
        )}

        {/* Official Channel Gatekeeper Modal */}
        {showOfficialChannelModal && (
          <OfficialChannelModal
            isOpen={showOfficialChannelModal}
            userProfile={userProfile}
            onClose={() => setShowOfficialChannelModal(false)}
            onClaimSuccess={(rewards) => {
              setShowOfficialChannelModal(false);
              // Authoritative backend sync
              fetchUserProfile().catch(() => {});
              setUserProfile((prev) => {
                if (rewards.user) {
                  return {
                    ...prev,
                    ...rewards.user,
                    has_claimed_channel_reward: true
                  };
                }
                return {
                  ...prev,
                  spins: prev.spins + (rewards.spins || 3),
                  diamonds: prev.diamonds + (rewards.diamonds || 500),
                  has_claimed_channel_reward: true
                };
              });
            }}
          />
        )}

        {/* Raffle Page Overlay */}
        {currentPage === 'raffle' && (
          <RafflePage
            userProfile={userProfile}
            onBack={() => {
              navigateTo('main');
              fetchUserProfile().catch(() => {});
            }}
          />
        )}

        {/* Tasks Page Overlay */}
        {currentPage === 'tasks' && (
          <TasksPage
            userProfile={userProfile}
            onBack={() => {
              navigateTo('main');
              fetchUserProfile().catch(() => {});
              fetchTasksPageData().then((data) => {
                if (data && data.tasks) {
                  const active = data.tasks.filter((t: any) => t.status !== 'claimed' && t.status !== 'completed');
                  setActiveTasksCount(active.length);
                }
              }).catch(() => {});
            }}
            onUpdateProfile={(updated) => {
              setUserProfile((prev) => ({ ...prev, ...updated }));
              fetchTasksPageData().then((data) => {
                if (data && data.tasks) {
                  const active = data.tasks.filter((t: any) => t.status !== 'claimed' && t.status !== 'completed');
                  setActiveTasksCount(active.length);
                }
              }).catch(() => {});
            }}
          />
        )}

        {/* Wallet Page Overlay */}
        {currentPage === 'wallet' && (
          <WalletPage
            userProfile={userProfile}
            onBack={() => {
              navigateTo('main');
              fetchUserProfile().catch(() => {});
            }}
          />
        )}

        {/* Admin Secret Passphrase Gate Modal */}
        {showAdminAuthModal && (
          <AdminAuthModal
            isOpen={showAdminAuthModal}
            onClose={() => setShowAdminAuthModal(false)}
            onSuccess={() => {
              setShowAdminAuthModal(false);
              setViewMode('admin');
            }}
          />
        )}

        {/* Active Crypto Deposit Recovery Modal */}
        {showPendingInvoiceModal && activePendingInvoice && (
          <CryptoDepositInvoiceModal
            invoice={{
              invoice_id: activePendingInvoice.invoiceId || activePendingInvoice.invoice_id,
              deposit_address: activePendingInvoice.deposit_address,
              amount_usd: activePendingInvoice.amount_usd,
              amount_usdt: String(activePendingInvoice.amount_usd),
              expires_at: activePendingInvoice.expiresAt
            } as any}
            amountUsd={activePendingInvoice.amount_usd}
            ticketCount={activePendingInvoice.ticket_count || 5}
            raffleId={activePendingInvoice.raffle_id}
            onClose={() => setShowPendingInvoiceModal(false)}
            onSuccess={() => {
              setShowPendingInvoiceModal(false);
              setActivePendingInvoice(null);
              fetchUserProfile().catch(() => {});
            }}
          />
        )}
      </Suspense>
    </div>
  </>
  );
}

export default App;
