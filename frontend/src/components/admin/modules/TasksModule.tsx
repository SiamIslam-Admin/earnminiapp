import React, { useEffect, useState, useRef } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminTask, AdminTaskType, ConnectedTelegramChat } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

// Smart Icon Renderer (Prevents raw path strings from ever rendering on screen)
export const TaskIconRenderer: React.FC<{ icon?: string; size?: number; style?: React.CSSProperties }> = ({
  icon = '🎯',
  size = 28,
  style
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [icon]);

  const isImage =
    !hasError &&
    typeof icon === 'string' &&
    (icon.startsWith('http://') ||
      icon.startsWith('https://') ||
      icon.startsWith('/uploads/') ||
      icon.endsWith('.png') ||
      icon.endsWith('.jpg') ||
      icon.endsWith('.jpeg') ||
      icon.endsWith('.svg') ||
      icon.endsWith('.gif') ||
      icon.endsWith('.webp'));

  if (isImage) {
    const src = icon.startsWith('/uploads/') ? `https://craftspin.duckdns.org${icon}` : icon;
    return (
      <img
        src={src}
        alt="Task Icon"
        onError={() => setHasError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          borderRadius: '7px',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
          ...style
        }}
      />
    );
  }

  return (
    <span
      style={{
        fontSize: `${Math.max(14, size - 4)}px`,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      {icon || '🎯'}
    </span>
  );
};

const ICON_PRESETS = [
  { label: 'Telegram', value: '📢', emoji: '📢' },
  { label: 'AdsGram', value: '🎬', emoji: '🎬' },
  { label: 'YouTube', value: '🎥', emoji: '🎥' },
  { label: 'X / Twitter', value: '🐦', emoji: '🐦' },
  { label: 'Lucky Wheel', value: '🎡', emoji: '🎡' },
  { label: 'Diamonds', value: '💎', emoji: '💎' },
  { label: 'Friends / Gift', value: '👥', emoji: '👥' },
  { label: 'Trophy / Level', value: '🏆', emoji: '🏆' },
  { label: 'Daily Reward', value: '🎁', emoji: '🎁' },
  { label: 'Website / Link', value: '🔗', emoji: '🔗' }
];

export const TasksModule: React.FC = () => {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [chats, setChats] = useState<ConnectedTelegramChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'chats'>('tasks');

  // Task Creation Modal Form States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskType, setTaskType] = useState<AdminTaskType>('telegram_channel');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'social' | 'daily' | 'partner' | 'special'>('social');
  const [icon, setIcon] = useState('📢');
  const [rewardDiamonds, setRewardDiamonds] = useState('500');
  const [rewardSpins, setRewardSpins] = useState('2');
  const [targetCount, setTargetCount] = useState('5');
  const [actionUrl, setActionUrl] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');
  const [customChannelId, setCustomChannelId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live Channel Verification State
  const [verifyingChannel, setVerifyingChannel] = useState(false);
  const [channelVerifyResult, setChannelVerifyResult] = useState<{
    verified: boolean;
    title?: string;
    username?: string;
    invite_link?: string;
    error?: string;
  } | null>(null);

  // File Upload State
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat Link Modal
  const [showChatModal, setShowChatModal] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [linkingChat, setLinkingChat] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([adminService.getTasks(), adminService.getConnectedChats()]);
      const rawTasks = tRes.data;
      let taskList: AdminTask[] = [];
      if (Array.isArray(rawTasks)) {
        taskList = rawTasks;
      } else if (rawTasks && typeof rawTasks === 'object') {
        const potential = (rawTasks as any).tasks || (rawTasks as any).items || (rawTasks as any).data || [];
        if (Array.isArray(potential)) taskList = potential;
      }
      setTasks(taskList);

      const rawChats = cRes.data;
      let chatList: ConnectedTelegramChat[] = [];
      if (Array.isArray(rawChats)) {
        chatList = rawChats;
      } else if (rawChats && typeof rawChats === 'object') {
        const potential = (rawChats as any).chats || (rawChats as any).connected_chats || (rawChats as any).data || [];
        if (Array.isArray(potential)) chatList = potential;
      }
      setChats(chatList);
    } catch (err: any) {
      console.warn('Failed to load tasks/chats:', err);
      notifyToast(`Failed to load: ${err.message}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTaskTypeChange = (newType: AdminTaskType) => {
    setTaskType(newType);
    setChannelVerifyResult(null);
    if (newType === 'watch_ad') {
      setIcon('🎬');
      setCategory('daily');
      setActionUrl('');
    } else if (newType === 'telegram_channel') {
      setIcon('📢');
      setCategory('social');
      setActionUrl('');
    } else if (newType === 'invite_count') {
      setIcon('👥');
      setCategory('special');
      setActionUrl('');
    } else if (newType === 'spin_count') {
      setIcon('🎡');
      setCategory('daily');
      setActionUrl('');
    } else if (newType === 'level_reach') {
      setIcon('🏆');
      setCategory('special');
      setActionUrl('');
    } else {
      setIcon('🔗');
      setCategory('social');
      if (!actionUrl) setActionUrl('https://');
    }
  };

  // Live Test / Verify Telegram Channel
  const handleVerifyChannelLive = async (targetId?: string) => {
    const channelToTest = targetId || (selectedChatId === 'custom' ? customChannelId.trim() : (selectedChatId || customChannelId.trim()));
    if (!channelToTest) {
      notifyToast('Please enter a Channel @username or Chat ID to test', 'info', 2500);
      return;
    }

    setVerifyingChannel(true);
    setChannelVerifyResult(null);
    try {
      const res = await adminService.verifyAndConnectChannel(channelToTest);
      if (res.success && res.data) {
        setChannelVerifyResult({
          verified: true,
          title: res.data.title || 'Official Channel',
          username: res.data.username || channelToTest,
          invite_link: res.data.invite_link
        });
        haptics.notification('success');
        notifyToast('✓ Bot is verified as Administrator in this channel!', 'success', 3500);
      } else {
        setChannelVerifyResult({
          verified: false,
          error: res.error || 'Bot is not an administrator in this channel'
        });
        haptics.notification('warning');
        const errMsg = res.error || '⚠️ Bot not detected as admin. Please add bot as admin to channel.';
        notifyToast(errMsg, 'error', 4000);
        showAdminDiagnostic(errMsg, 'Verify Telegram Channel');
      }
    } catch (err: any) {
      setChannelVerifyResult({
        verified: false,
        error: err.message || 'Connection error'
      });
      notifyToast(`Verification failed: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Verify Telegram Channel');
    } finally {
      setVerifyingChannel(false);
    }
  };

  // Handle Direct Icon File Upload to VPS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notifyToast('Please select a valid image file (PNG, JPG, SVG, WebP)', 'info', 3000);
      return;
    }

    setUploadingIcon(true);
    try {
      const res = await adminService.uploadImage(file);
      if (res.success && res.data?.url) {
        setIcon(res.data.url);
        haptics.notification('success');
        notifyToast('📁 Icon uploaded and hosted on server successfully!', 'success', 3000);
      } else {
        notifyToast(res.error || 'Failed to upload image', 'error', 3000);
        showAdminDiagnostic(res.error || 'Failed to upload image', 'Upload Task Icon');
      }
    } catch (err: any) {
      notifyToast(`Upload error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Upload Task Icon');
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notifyToast('Task title is required', 'info', 2500);
      return;
    }

    if (taskType === 'external_link' && (!actionUrl.trim() || actionUrl.trim() === 'https://')) {
      notifyToast('Redirect URL is required for External Link tasks', 'info', 3000);
      return;
    }

    setSubmitting(true);
    try {
      let resolvedChannelId = '';
      let resolvedActionUrl = actionUrl.trim();

      if (taskType === 'telegram_channel') {
        resolvedChannelId = selectedChatId === 'custom' ? customChannelId.trim() : (selectedChatId || customChannelId.trim());
        if (channelVerifyResult?.invite_link) {
          resolvedActionUrl = channelVerifyResult.invite_link;
        } else if (!resolvedActionUrl && resolvedChannelId) {
          const clean = resolvedChannelId.replace('@', '');
          if (!clean.startsWith('-100')) {
            resolvedActionUrl = `https://t.me/${clean}`;
          }
        }
      } else if (taskType !== 'external_link') {
        resolvedActionUrl = '';
      }

      await adminService.createTask({
        title: title.trim(),
        task_type: taskType,
        category,
        icon: icon.trim() || '🎯',
        icon_url: icon.trim() || '🎯',
        reward_diamonds: parseInt(rewardDiamonds, 10) || 0,
        reward_spins: parseInt(rewardSpins, 10) || 0,
        target_count: ['invite_count', 'spin_count', 'level_reach'].includes(taskType) ? (parseInt(targetCount, 10) || 1) : 1,
        action_url: resolvedActionUrl,
        telegram_chat_id: resolvedChannelId || undefined,
        channel_id: resolvedChannelId || undefined,
        is_active: true
      });

      haptics.notification('success');
      notifyToast('📋 Quest Task created successfully!', 'success', 3500);
      setShowTaskModal(false);
      setTitle('');
      setActionUrl('');
      setSelectedChatId('');
      setCustomChannelId('');
      setChannelVerifyResult(null);
      loadData();
    } catch (err: any) {
      haptics.notification('error');
      notifyToast(`Error: ${err.message}`, 'error', 3500);
      showAdminDiagnostic(err, 'Create Quest Task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (id: number) => {
    try {
      haptics.impact('medium');
      await adminService.deleteTask(id);
      notifyToast('Task removed', 'info', 2500);
      loadData();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Delete Quest Task');
    }
  };

  const handleLinkChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatId.trim()) return;
    setLinkingChat(true);
    try {
      haptics.notification('success');
      await adminService.linkConnectedChat(newChatId.trim());
      notifyToast('📢 Channel linked to bot!', 'success', 3000);
      setShowChatModal(false);
      setNewChatId('');
      loadData();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Link Telegram Channel');
    } finally {
      setLinkingChat(false);
    }
  };

  const handleUnlinkChat = async (id: number) => {
    try {
      haptics.impact('medium');
      await adminService.unlinkConnectedChat(id);
      notifyToast('Channel unlinked', 'info', 2500);
      loadData();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Unlink Telegram Channel');
    }
  };

  const getTaskTypeBadge = (type?: AdminTaskType) => {
    switch (type) {
      case 'watch_ad':
      case 'ad_view':
        return { label: '🎬 AdsGram Rewarded Ad', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' };
      case 'telegram_channel':
        return { label: '📢 Telegram Channel', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
      case 'invite_count':
        return { label: '👥 Invite Milestone', color: '#a7f3d0', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'spin_count':
        return { label: '🎡 Spin Milestone', color: '#fde047', bg: 'rgba(250, 204, 21, 0.15)' };
      case 'level_reach':
        return { label: '🏆 Level Milestone', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' };
      default:
        return { label: '🔗 External Link', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header & Subtabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            📋 Quests, Tasks & Channels
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Configure 100% dynamic quest requirements, media icons, and rewards
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '0.2rem', display: 'flex', gap: '0.2rem' }}>
            <button
              onClick={() => setActiveSubTab('tasks')}
              style={{
                background: activeSubTab === 'tasks' ? 'rgba(56, 189, 248, 0.25)' : 'none',
                color: activeSubTab === 'tasks' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveSubTab('chats')}
              style={{
                background: activeSubTab === 'chats' ? 'rgba(56, 189, 248, 0.25)' : 'none',
                color: activeSubTab === 'chats' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Bot Channels ({chats.length})
            </button>
          </div>

          {activeSubTab === 'tasks' ? (
            <button
              onClick={() => {
                setShowTaskModal(true);
                setChannelVerifyResult(null);
              }}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span>➕</span>
              <span>Create Task</span>
            </button>
          ) : (
            <button
              onClick={() => setShowChatModal(true)}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>📢</span>
              <span>Link Channel</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtab 1: Tasks List */}
      {activeSubTab === 'tasks' && (
        loading ? (
          <div className="skeleton-glow-box" style={{ width: '100%', height: '220px', borderRadius: '16px' }} />
        ) : tasks.length === 0 ? (
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '2.5rem', borderRadius: '14px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            No tasks found. Click "Create Task" above to publish your first quest.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Task Details</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Rewards</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Requirements / Target</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Completions</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const typeBadge = getTaskTypeBadge(t.task_type);
                  const dia = t.reward_diamonds ?? (t.reward_type === 'diamonds' ? t.reward_amount : 0) ?? 0;
                  const spn = t.reward_spins ?? (t.reward_type === 'spins' ? t.reward_amount : 0) ?? 0;

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#f1f5f9' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: 'rgba(0, 0, 0, 0.4)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <TaskIconRenderer icon={t.icon || t.icon_url || (t as any).iconUrl} size={26} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{t.title}</div>
                            <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'capitalize' }}>Category: {t.category}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ background: typeBadge.bg, color: typeBadge.color, padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                          {typeBadge.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {dia > 0 && <span style={{ color: '#fde047', fontWeight: 800 }}>+{dia} 💎</span>}
                          {spn > 0 && <span style={{ color: '#67e8f9', fontWeight: 800 }}>+{spn} 🎡</span>}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                        {t.task_type === 'telegram_channel' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.9rem' }}>📢</span>
                            <code style={{ color: '#38bdf8' }}>{t.channel_id || t.telegram_chat_id || '@channel'}</code>
                          </div>
                        ) : t.task_type === 'watch_ad' || t.task_type === 'ad_view' ? (
                          <span style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700 }}>🎬 In-App Video Ad</span>
                        ) : ['invite_count', 'spin_count', 'level_reach'].includes(t.task_type || '') ? (
                          <span style={{ fontWeight: 700, color: '#a7f3d0' }}>Target: {t.target_count || 1}</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ color: '#fb923c', fontSize: '0.75rem', fontWeight: 700 }}>⏱ 15s Timer</span>
                            {t.action_url && (
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.action_url}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                        {t.completion_count || 0} claims
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Subtab 2: Connected Telegram Chats */}
      {activeSubTab === 'chats' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {chats.map((c) => (
            <div
              key={c.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.95rem', fontWeight: 700 }}>
                  {c.title}
                </h4>
                <span style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginTop: '0.2rem' }}>
                  {c.username} (ID: {c.chat_id})
                </span>
                <span style={{ color: '#34d399', fontSize: '0.72rem', fontWeight: 600 }}>
                  ✓ Bot Admin Verified
                </span>
              </div>

              <button
                onClick={() => handleUnlinkChat(c.id)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '8px',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowTaskModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#090d16',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800 }}>
                Create New Quest Task
              </h3>
              <button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* 1. Task Type Selector */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                  1. Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e: any) => handleTaskTypeChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontWeight: 700
                  }}
                >
                  <option value="telegram_channel">📢 Type 1: Join Telegram Channel / Group (Bot Auto-Verify)</option>
                  <option value="watch_ad">🎬 Type 2: Watch Rewarded Ad (AdsGram In-App Video)</option>
                  <option value="external_link">🔗 Type 3: External Link / Partner Visit (15s Countdown)</option>
                  <option value="invite_count">👥 Type 4: Invite Friends Milestone</option>
                  <option value="spin_count">🎡 Type 4: Wheel Spins Milestone</option>
                  <option value="level_reach">🏆 Type 4: Level Reach Milestone</option>
                </select>
              </div>

              {/* 2. Title & Category */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                  2. Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Subscribe to Official Telegram Channel"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Category Tab
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                >
                  <option value="social">Socials</option>
                  <option value="daily">Daily</option>
                  <option value="special">Special</option>
                  <option value="partner">Partner</option>
                </select>
              </div>

              {/* 3. DYNAMIC REQUIREMENTS (Conditional per Task Type) */}

              {/* Type 1: Telegram Channel with Live Bot Verification */}
              {taskType === 'telegram_channel' && (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>
                      📢 Connect Telegram Channel / Group
                    </label>
                    <button
                      type="button"
                      onClick={() => handleVerifyChannelLive()}
                      disabled={verifyingChannel}
                      style={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        border: '1px solid #38bdf8',
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        color: '#38bdf8',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {verifyingChannel ? 'Testing...' : '🔍 Test Bot Connection'}
                    </button>
                  </div>

                  <select
                    value={selectedChatId}
                    onChange={(e) => {
                      setSelectedChatId(e.target.value);
                      setChannelVerifyResult(null);
                      if (e.target.value && e.target.value !== 'custom') {
                        handleVerifyChannelLive(e.target.value);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">-- Select Linked Channel or Input Custom --</option>
                    {chats.map((c) => (
                      <option key={c.id} value={c.chat_id}>
                        {c.title} ({c.username})
                      </option>
                    ))}
                    <option value="custom">✏️ Enter Custom @Username / Chat ID</option>
                  </select>

                  {(selectedChatId === 'custom' || chats.length === 0) && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        value={customChannelId}
                        onChange={(e) => {
                          setCustomChannelId(e.target.value);
                          setChannelVerifyResult(null);
                        }}
                        placeholder="e.g. @SpinCraftNews or -100192847192"
                        style={{
                          flex: 1,
                          padding: '0.65rem',
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyChannelLive(customChannelId.trim())}
                        disabled={verifyingChannel || !customChannelId.trim()}
                        style={{
                          background: 'rgba(56, 189, 248, 0.25)',
                          border: '1px solid #38bdf8',
                          borderRadius: '8px',
                          padding: '0 0.75rem',
                          color: '#38bdf8',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        {verifyingChannel ? '...' : 'Verify'}
                      </button>
                    </div>
                  )}

                  {/* Live Bot Verification Feedback */}
                  {channelVerifyResult && (
                    <div
                      style={{
                        background: channelVerifyResult.verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: channelVerifyResult.verified ? '1px solid #10b981' : '1px solid #ef4444',
                        borderRadius: '8px',
                        padding: '0.5rem 0.65rem',
                        fontSize: '0.74rem'
                      }}
                    >
                      {channelVerifyResult.verified ? (
                        <div style={{ color: '#6ee7b7', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontWeight: 800 }}>✓ Live Verified: "{channelVerifyResult.title}" ({channelVerifyResult.username})</span>
                          <span style={{ color: '#a7f3d0', fontSize: '0.7rem' }}>🛡️ Bot is Administrator in channel | Link: {channelVerifyResult.invite_link || 'Auto-derived'}</span>
                        </div>
                      ) : (
                        <div style={{ color: '#fca5a5' }}>
                          <span style={{ fontWeight: 800 }}>⚠️ Bot Admin Required:</span> {channelVerifyResult.error || 'Please add the bot as an Administrator to this channel/group.'}
                        </div>
                      )}
                    </div>
                  )}

                  <span style={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.35 }}>
                    💡 When the user taps Join, the Telegram channel opens automatically. The bot checks membership directly upon verification. No external redirect link needed.
                  </span>
                </div>
              )}

              {/* Type 2: Watch Rewarded Ad */}
              {taskType === 'watch_ad' && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>🎬</span>
                  <div>
                    <div style={{ color: '#f59e0b', fontSize: '0.82rem', fontWeight: 800 }}>
                      AdsGram In-App Video Ad
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                      Plays directly inside the mini app via AdsGram SDK. Users are rewarded upon video completion. No redirect link required.
                    </div>
                  </div>
                </div>
              )}

              {/* Type 3: External Link / Partner Visit */}
              {taskType === 'external_link' && (
                <div
                  style={{
                    background: 'rgba(251, 146, 60, 0.08)',
                    border: '1px solid rgba(251, 146, 60, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <label style={{ color: '#fb923c', fontSize: '0.78rem', display: 'block', fontWeight: 700 }}>
                    🔗 Action / Redirect URL (Required)
                  </label>
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://youtube.com/... or https://x.com/..."
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(251, 146, 60, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    ⏱ Opening this link starts a 15-second countdown timer before unlocking claim.
                  </span>
                </div>
              )}

              {/* Type 4: In-App Milestone Targets */}
              {['invite_count', 'spin_count', 'level_reach'].includes(taskType) && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <label style={{ color: '#a7f3d0', fontSize: '0.78rem', display: 'block', fontWeight: 700 }}>
                    🎯 Milestone Target Count ({taskType === 'invite_count' ? 'Invited Friends' : taskType === 'spin_count' ? 'Wheel Spins' : 'User Level'})
                  </label>
                  <input
                    type="number"
                    value={targetCount}
                    onChange={(e) => setTargetCount(e.target.value)}
                    placeholder="5"
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    🎮 Verified automatically in real-time by game progression. No external link required.
                  </span>
                </div>
              )}

              {/* 4. Task Icon (Direct File Upload / Public URL / Universal Emojis) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700 }}>
                    4. Task Icon (Public URL, Upload, or Emoji)
                  </label>
                  {/* Live Visual Preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.5)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Preview:</span>
                    <TaskIconRenderer icon={icon || '🎯'} size={22} />
                  </div>
                </div>

                {/* 1-Click Universal Emoji Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {ICON_PRESETS.map((p) => {
                    const isSelected = icon === p.value;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setIcon(p.value)}
                        style={{
                          background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '0.25rem 0.45rem',
                          color: isSelected ? '#38bdf8' : '#cbd5e1',
                          fontSize: '0.72rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 800 : 500
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Public URL Input & Upload Button */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="Paste Public Image URL (https://...) or Emoji"
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box',
                      fontSize: '0.8rem'
                    }}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingIcon}
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 0.85rem',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.76rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>📁</span>
                    <span>{uploadingIcon ? 'Uploading...' : 'Upload Image'}</span>
                  </button>
                </div>
              </div>

              {/* 5. Rewards (Diamonds & Spins) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: '#fde047', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                    💎 Reward Diamonds
                  </label>
                  <input
                    type="number"
                    value={rewardDiamonds}
                    onChange={(e) => setRewardDiamonds(e.target.value)}
                    placeholder="500"
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(250, 204, 21, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ color: '#67e8f9', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem', fontWeight: 700 }}>
                    🎡 Reward Free Spins
                  </label>
                  <input
                    type="number"
                    value={rewardSpins}
                    onChange={(e) => setRewardSpins(e.target.value)}
                    placeholder="2"
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  style={{
                    padding: '0.55rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.55rem 1.25rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {submitting ? 'Creating...' : 'Publish Quest Task 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Bot Channel Modal */}
      {showChatModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowChatModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#090d16',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#ffffff', fontWeight: 800 }}>Link Telegram Channel</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.45, marginTop: 0 }}>
              Make sure your Telegram bot is added as an <b>Admin</b> to the channel/group before linking.
            </p>

            <form onSubmit={handleLinkChat} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>
                  Channel Username or ID
                </label>
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="e.g. @SpinCraftCommunity or -100192847192"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowChatModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingChat}
                  style={{
                    padding: '0.5rem 1.2rem',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {linkingChat ? 'Linking...' : 'Link Channel 📢'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksModule;
