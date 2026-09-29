import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminSupportFeedback } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

export const SupportModule: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<AdminSupportFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [inspectTicket, setInspectTicket] = useState<AdminSupportFeedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const normalizeItem = (item: any): AdminSupportFeedback => {
    const isResolved =
      item.is_resolved === true ||
      item.isResolved === true ||
      item.status === 'resolved';

    return {
      id: item.id || 0,
      user_id: item.user_id ?? item.userId ?? 0,
      telegram_id: item.telegram_id ?? item.telegramId ?? 0,
      username: item.username || item.userName || item.user_name || 'user',
      email: item.email || '',
      category: item.category || 'general',
      message: item.message || item.description || '',
      screenshot_url: item.screenshot_url || item.screenshotUrl || '',
      created_at: item.created_at || item.createdAt || new Date().toISOString(),
      is_resolved: isResolved,
      resolved_at: item.resolved_at || item.resolvedAt,
      admin_notes: item.admin_notes || item.adminNotes || ''
    };
  };

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSupportFeedback();
      const raw = res?.data;
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object') {
        const potential = (raw as any).feedback || (raw as any).items || (raw as any).data || (raw as any).messages;
        if (Array.isArray(potential)) list = potential;
      }
      setFeedbackList(list.map(normalizeItem));
    } catch (err: any) {
      console.warn('Failed to load feedback:', err);
      notifyToast(`Failed to load feedback: ${err?.message || 'Error'}`, 'error', 3000);
      setFeedbackList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleResolve = async (item: AdminSupportFeedback, notes?: string) => {
    setResolving(true);
    try {
      haptics.notification('success');
      const responseText = (notes || '').trim() || 'Your support request has been investigated and resolved by our team.';
      await adminService.resolveSupportFeedback(item.id, responseText);
      notifyToast('✓ Ticket marked as resolved and user notified via Telegram Bot!', 'success', 3500);
      setInspectTicket(null);
      loadFeedback();
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Resolve Support Ticket & Notify User');
    } finally {
      setResolving(false);
    }
  };

  const filtered = feedbackList.filter((f) => {
    if (filter === 'open') return !f.is_resolved;
    if (filter === 'resolved') return f.is_resolved;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            📩 Support & Feedback Inbox
          </h2>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Click any ticket to read user inquiry, inspect screenshot, and send live Telegram bot reply
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['open', 'resolved', 'all'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              style={{
                background: filter === st ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0, 0, 0, 0.3)',
                color: filter === st ? '#38bdf8' : '#94a3b8',
                border: filter === st ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {st} ({feedbackList.filter(f => st === 'all' ? true : st === 'open' ? !f.is_resolved : f.is_resolved).length})
            </button>
          ))}
        </div>
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="skeleton-glow-box" style={{ width: '100%', height: '220px', borderRadius: '16px' }} />
      ) : filtered.length === 0 ? (
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '2.5rem', borderRadius: '14px', textAlign: 'center', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          No support tickets in this view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                haptics.selection();
                setInspectTicket(item);
                setAdminNotes(item.admin_notes || 'Your support inquiry has been investigated and resolved.');
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: item.is_resolved ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '14px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: item.is_resolved ? 'none' : '0 4px 14px rgba(56, 189, 248, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      background:
                        item.category === 'bug'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : item.category === 'withdrawal'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(56, 189, 248, 0.2)',
                      color:
                        item.category === 'bug'
                          ? '#f87171'
                          : item.category === 'withdrawal'
                          ? '#f59e0b'
                          : '#38bdf8',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}
                  >
                    {item.category}
                  </span>
                  <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.88rem' }}>
                    @{item.username || 'user'} {item.telegram_id ? `(ID: ${item.telegram_id})` : item.user_id ? `(User #${item.user_id})` : ''}
                  </span>
                </div>

                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', lineHeight: 1.45, background: 'rgba(0,0,0,0.25)', padding: '0.65rem', borderRadius: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.message || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <span
                  style={{
                    color: item.is_resolved ? '#34d399' : '#f59e0b',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {item.is_resolved ? '✓ Resolved' : '⏳ Open / Tap to View & Reply'}
                </span>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {item.screenshot_url && (
                    <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600 }}>
                      🖼️ Screenshot
                    </span>
                  )}
                  <span style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700 }}>
                    Open Ticket #{item.id} ↗
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Details & Resolution Modal */}
      {inspectTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setInspectTicket(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              background: '#090d16',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📩</span>
                <div>
                  <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800 }}>
                    Support Ticket #{inspectTicket.id}
                  </h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                    Received {new Date(inspectTicket.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectTicket(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            {/* User Details Box */}
            <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.92rem' }}>
                    @{inspectTicket.username || 'user'}
                  </div>
                  <div style={{ color: '#38bdf8', fontSize: '0.75rem' }}>
                    Telegram ID: <code>{inspectTicket.telegram_id || inspectTicket.user_id || 'N/A'}</code>
                  </div>
                </div>

                {inspectTicket.username && inspectTicket.username !== 'user' && (
                  <a
                    href={`https://t.me/${inspectTicket.username.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38bdf8',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <span>💬 Open DM in Telegram</span>
                  </a>
                )}
              </div>

              {inspectTicket.email && (
                <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  📧 Contact Email: <span style={{ color: '#ffffff' }}>{inspectTicket.email}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#cbd5e1', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Category: {inspectTicket.category}
                </span>
                <span style={{ background: inspectTicket.is_resolved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: inspectTicket.is_resolved ? '#34d399' : '#f59e0b', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                  Status: {inspectTicket.is_resolved ? 'Resolved' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                Player Message:
              </label>
              <div style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '0.9rem', color: '#ffffff', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {inspectTicket.message || 'No description provided.'}
              </div>
            </div>

            {/* Screenshot Preview */}
            {inspectTicket.screenshot_url && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Attached Screenshot:
                </label>
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)', background: '#000000', textAlign: 'center', padding: '0.5rem' }}>
                  <img
                    src={inspectTicket.screenshot_url.startsWith('/uploads/') ? `https://craftspin.duckdns.org${inspectTicket.screenshot_url}` : inspectTicket.screenshot_url}
                    alt="Attached Screenshot"
                    style={{ maxWidth: '100%', maxHeight: '260px', objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: '6px' }}
                  />
                </div>
              </div>
            )}

            {/* Resolution Actions */}
            {!inspectTicket.is_resolved ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <label style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                    💬 Admin Response & Telegram Bot Notification Message:
                  </label>
                  <textarea
                    rows={3}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Type your response to the user. When you click Resolve, this response is sent to their Telegram via bot..."
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      boxSizing: 'border-box',
                      fontSize: '0.85rem',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setInspectTicket(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#94a3b8',
                      borderRadius: '8px',
                      padding: '0.55rem 1rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleResolve(inspectTicket, adminNotes)}
                    disabled={resolving}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {resolving ? 'Sending...' : '✓ Resolve & Send Bot Reply 🚀'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '0.75rem', borderRadius: '8px', color: '#34d399', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700 }}>
                ✓ This inquiry has been resolved. {inspectTicket.admin_notes ? `Response sent: "${inspectTicket.admin_notes}"` : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportModule;
