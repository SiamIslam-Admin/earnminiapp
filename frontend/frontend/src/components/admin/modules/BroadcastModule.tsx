import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminBroadcastJob, CreateBroadcastJobPayload, AdminBroadcastButton } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const BroadcastModule: React.FC = () => {
  const [jobs, setJobs] = useState<AdminBroadcastJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'composer' | 'queue'>('composer');

  // Form State
  const [targetAudience, setTargetAudience] = useState<'all' | 'active_last_7d' | 'inactive_7d' | 'deposited'>('all');
  const [messageText, setMessageText] = useState('🔥 <b>Special Weekend Tournament!</b>\n\nSpin the lucky wheel now and double your chances to win the $500 USDT prize pool!\n\nTap below to play:');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | ''>('');
  const [buttonText, setButtonText] = useState('🎡 Spin & Win Now');
  const [buttonUrl, setButtonUrl] = useState('https://t.me/Gojo_spin_win_bot/spincraft');
  const [isSending, setIsSending] = useState(false);

  const loadJobs = async () => {
    try {
      const res = await adminService.getBroadcastJobs();
      if (res.success && Array.isArray(res.data)) {
        setJobs(res.data);
      } else {
        setJobs([]);
      }
    } catch (err: any) {
      console.warn('Failed to load broadcast jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTestPreview = async () => {
    try {
      haptics.impact('light');
      notifyToast('Sending test message to admin Telegram...', 'info', 2500);

      const buttons: AdminBroadcastButton[][] = buttonText.trim()
        ? [[{ text: buttonText.trim(), url: buttonUrl.trim() || undefined }]]
        : [];

      const res = await adminService.previewBroadcast({
        target_audience: targetAudience,
        message_text: messageText,
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaType || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
      });

      if (res.success) {
        notifyToast('✓ Test message sent to your Telegram bot chat!', 'success', 3500);
      } else {
        notifyToast(`Preview failed: ${res.error || 'Check bot token'}`, 'error', 4000);
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message}`, 'error', 4000);
    }
  };

  const handleLaunchBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) {
      notifyToast('Please enter message text', 'error', 3000);
      return;
    }

    if (!window.confirm(`Launch broadcast campaign to "${targetAudience}" audience? Rate limited at 25 msgs/sec.`)) {
      return;
    }

    setIsSending(true);
    try {
      const buttons: AdminBroadcastButton[][] = buttonText.trim()
        ? [[{ text: buttonText.trim(), url: buttonUrl.trim() || undefined }]]
        : [];

      const payload: CreateBroadcastJobPayload = {
        target_audience: targetAudience,
        message_text: messageText,
        media_url: mediaUrl.trim() || undefined,
        media_type: mediaType || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
      };

      const res = await adminService.createBroadcastJob(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast('🚀 Broadcast job queued successfully!', 'success', 3500);
        setActiveTab('queue');
        loadJobs();
      } else {
        const errMsg = res.error || 'Failed to queue broadcast campaign';
        notifyToast(`Broadcast launch failed: ${errMsg}`, 'error', 4000);
        showAdminDiagnostic(errMsg, 'Launch Broadcast Campaign');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message}`, 'error', 4000);
      showAdminDiagnostic(err, 'Launch Broadcast Campaign');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!window.confirm('Cancel this ongoing broadcast job?')) return;

    try {
      const res = await adminService.cancelBroadcastJob(jobId);
      if (res.success) {
        notifyToast('✓ Broadcast job cancelled', 'success', 2500);
        loadJobs();
      } else {
        const errMsg = res.error || 'Failed to cancel broadcast job';
        notifyToast(`Failed: ${errMsg}`, 'error', 3000);
        showAdminDiagnostic(errMsg, 'Cancel Broadcast Job');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Cancel Broadcast Job');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.25rem', fontWeight: 900, fontFamily: 'Georgia, serif' }}>
            📢 Telegram Broadcast Campaigns
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
            Push rich announcements, tournament alerts, and promotions directly to users with rate-limiting & retry safety.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: '0.75rem' }}>
          <button
            onClick={() => setActiveTab('composer')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: activeTab === 'composer' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            ✍️ Compose
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: activeTab === 'queue' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            📊 Queue ({jobs.filter((j) => j.status === 'in_progress' || j.status === 'pending').length} active)
          </button>
        </div>
      </div>

      {activeTab === 'composer' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
          {/* Form Composer */}
          <form
            onSubmit={handleLaunchBroadcast}
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '1rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                Target Audience
              </label>
              <select
                value={targetAudience}
                onChange={(e: any) => setTargetAudience(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.6rem',
                  color: 'white',
                  fontSize: '0.85rem',
                }}
              >
                <option value="all" style={{ background: '#0f172a' }}>All Registered Users</option>
                <option value="active_last_7d" style={{ background: '#0f172a' }}>Active in Last 7 Days</option>
                <option value="inactive_7d" style={{ background: '#0f172a' }}>Inactive (Re-engagement)</option>
                <option value="deposited" style={{ background: '#0f172a' }}>Deposited Users (VIP)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                Message Text (HTML Formatted) *
              </label>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                required
                placeholder="Supports <b>bold</b>, <i>italic</i>, <a href='...'>links</a>..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.6rem',
                  color: 'white',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Media Image/Video URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/banner.png"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.6rem',
                    color: 'white',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Media Type
                </label>
                <select
                  value={mediaType}
                  onChange={(e: any) => setMediaType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.6rem',
                    color: 'white',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="" style={{ background: '#0f172a' }}>Auto / None</option>
                  <option value="photo" style={{ background: '#0f172a' }}>Photo</option>
                  <option value="video" style={{ background: '#0f172a' }}>Video</option>
                </select>
              </div>
            </div>

            {/* Inline Button */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Button Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. 🎡 Play Now"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.6rem',
                    color: 'white',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.3rem' }}>
                  Button Link / Mini App URL
                </label>
                <input
                  type="url"
                  placeholder="https://t.me/..."
                  value={buttonUrl}
                  onChange={(e) => setButtonUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.6rem',
                    color: 'white',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={handleSendTestPreview}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '0.75rem',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                👁️ Test in Bot
              </button>

              <button
                type="submit"
                disabled={isSending}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                }}
              >
                {isSending ? 'Launching...' : '🚀 Launch Broadcast'}
              </button>
            </div>
          </form>

          {/* Telegram Preview Mockup Card */}
          <div
            style={{
              background: '#17212b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '1.25rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.6rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white' }}>
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.85rem' }}>Spin & Win Official Bot</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>bot • preview</div>
              </div>
            </div>

            {/* Telegram Bubble */}
            <div
              style={{
                background: '#2b5278',
                borderRadius: '0.85rem',
                padding: '0.85rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                lineHeight: 1.45,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {mediaUrl && (
                <div style={{ width: '100%', maxHeight: '160px', overflow: 'hidden', borderRadius: '0.5rem', background: '#000' }}>
                  <img src={mediaUrl} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')} />
                </div>
              )}

              <div
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: messageText || 'Your message preview will appear here...' }}
              />

              {buttonText && (
                <div
                  style={{
                    marginTop: '0.35rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {buttonText} ↗
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Queue & Job History */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
              Loading broadcast jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem' }}>
              No broadcast jobs found.
            </div>
          ) : (
            jobs.map((job) => {
              const percent = job.total_users > 0 ? Math.round((job.sent_count / job.total_users) * 100) : 0;
              const isRunning = job.status === 'in_progress' || job.status === 'pending';

              return (
                <div
                  key={job.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '1rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 900, color: '#ffffff' }}>Job #{job.id}</span>
                      <span
                        style={{
                          background: job.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : isRunning ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: job.status === 'completed' ? '#34d399' : isRunning ? '#60a5fa' : '#f87171',
                          border: '1px solid currentColor',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      >
                        {job.status}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Target: {job.target_audience}</span>
                    </div>

                    {isRunning && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '0.5rem',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel Job 🛑
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '0.5rem', height: '8px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: job.status === 'completed' ? '#10b981' : isRunning ? '#3b82f6' : '#ef4444',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>Sent: <b>{job.sent_count}</b> / {job.total_users} ({percent}%)</span>
                    <span>Failed: <b>{job.failed_count}</b></span>
                    <span>Created: {new Date(job.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
