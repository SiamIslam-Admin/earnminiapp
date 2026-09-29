import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/adminService';
import type { AdminSubAdmin, CreateSubAdminPayload } from '../../../types/admin';
import { notifyToast } from '../../../utils/debugToast';
import { haptics } from '../../../utils/haptics';
import { showAdminDiagnostic } from '../../../utils/adminDiagnostics';

const AVAILABLE_PERMISSIONS = [
  { id: 'withdrawals_approve', label: 'Approve & Pay Cashouts' },
  { id: 'support', label: 'Support & Tickets Inbox' },
  { id: 'users_view', label: 'View & Search Users' },
  { id: 'users_adjust', label: 'Adjust User Balances & Ban' },
  { id: 'broadcast_create', label: 'Create & Send Broadcasts' },
  { id: 'contests_manage', label: 'Manage Tournaments & Contests' },
  { id: 'tasks_manage', label: 'Manage Tasks & Quests' },
  { id: 'gift_codes_manage', label: 'Generate & Manage Gift Codes' },
  { id: 'settings_edit', label: 'Edit System Settings & Odds' },
];

export const SubAdminsModule: React.FC = () => {
  const [subAdmins, setSubAdmins] = useState<AdminSubAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('support');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['support', 'users_view']);
  const [submitting, setSubmitting] = useState(false);

  const loadSubAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSubAdmins();
      if (res.success && Array.isArray(res.data)) {
        setSubAdmins(res.data);
      } else {
        setSubAdmins([]);
      }
    } catch (err: any) {
      console.warn('Failed to load sub-admins:', err);
      notifyToast(`Failed to load sub-admins: ${err?.message || 'Error'}`, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubAdmins();
  }, []);

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const tgIdNum = parseInt(telegramId.trim(), 10);
    if (isNaN(tgIdNum) || tgIdNum <= 0) {
      notifyToast('Please enter a valid numeric Telegram ID', 'error', 3000);
      return;
    }

    if (selectedPermissions.length === 0) {
      notifyToast('Please select at least one permission', 'info', 3000);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateSubAdminPayload = {
        telegram_id: tgIdNum,
        username: username.trim() || undefined,
        role: role.trim() || 'sub_admin',
        permissions: selectedPermissions,
      };

      const res = await adminService.createSubAdmin(payload);
      if (res.success) {
        haptics.notification('success');
        notifyToast(`✓ Sub-Admin ${tgIdNum} created successfully!`, 'success', 3000);
        setShowAddModal(false);
        setTelegramId('');
        setUsername('');
        loadSubAdmins();
      } else {
        const errMsg = res.error || 'Failed to create sub-admin';
        notifyToast(`Failed: ${errMsg}`, 'error', 4000);
        showAdminDiagnostic(errMsg, 'Create Sub-Admin');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message || 'Failed to create sub-admin'}`, 'error', 4000);
      showAdminDiagnostic(err, 'Create Sub-Admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: AdminSubAdmin) => {
    try {
      const res = await adminService.updateSubAdmin(admin.id, { is_active: !admin.is_active });
      if (res.success) {
        haptics.impact('light');
        notifyToast(`✓ Sub-Admin ${admin.telegram_id} ${!admin.is_active ? 'Activated' : 'Suspended'}`, 'success', 2500);
        loadSubAdmins();
      } else {
        const errMsg = res.error || 'Failed to update sub-admin status';
        notifyToast(`Error: ${errMsg}`, 'error', 3000);
        showAdminDiagnostic(errMsg, 'Update Sub-Admin Status');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Update Sub-Admin Status');
    }
  };

  const handleDelete = async (admin: AdminSubAdmin) => {
    if (!window.confirm(`Are you sure you want to remove Sub-Admin TG#${admin.telegram_id}?`)) return;

    try {
      const res = await adminService.deleteSubAdmin(admin.id);
      if (res.success) {
        haptics.notification('success');
        notifyToast('✓ Sub-Admin removed', 'success', 2500);
        loadSubAdmins();
      } else {
        const errMsg = res.error || 'Failed to remove sub-admin';
        notifyToast(`Error: ${errMsg}`, 'error', 3000);
        showAdminDiagnostic(errMsg, 'Remove Sub-Admin');
      }
    } catch (err: any) {
      notifyToast(`Error: ${err?.message}`, 'error', 3000);
      showAdminDiagnostic(err, 'Remove Sub-Admin');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff', fontSize: '1.25rem', fontWeight: 900, fontFamily: 'Georgia, serif' }}>
            🛡️ Sub-Admins & RBAC Roles
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
            Delegate limited administrative permissions without sharing master private keys or secret credentials.
          </p>
        </div>

        <button
          onClick={() => {
            haptics.impact('light');
            setShowAddModal(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.6rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>➕</span> Add Sub-Admin
        </button>
      </div>

      {/* Sub-Admins Table */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading sub-administrators...</div>
      ) : subAdmins.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '1rem',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: '#94a3b8',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>No Sub-Admins Configured</div>
          <div style={{ fontSize: '0.8rem' }}>Only the main administrator currently has platform access.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {subAdmins.map((admin) => (
            <div
              key={admin.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '1rem',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 900, color: '#ffffff', fontSize: '0.95rem' }}>
                    TG #{admin.telegram_id}
                  </span>
                  {admin.username && (
                    <span style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700 }}>
                      @{admin.username}
                    </span>
                  )}
                  <span
                    style={{
                      background: admin.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: admin.is_active ? '#34d399' : '#f87171',
                      border: `1px solid ${admin.is_active ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {admin.is_active ? 'Active' : 'Suspended'}
                  </span>
                  <span
                    style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#c4b5fd',
                      border: '1px solid rgba(139, 92, 246, 0.4)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    Role: {admin.role}
                  </span>
                </div>

                {/* Permissions Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                  {(admin.permissions || []).map((p) => (
                    <span
                      key={p}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '0.4rem',
                        fontSize: '0.7rem',
                        color: '#e2e8f0',
                      }}
                    >
                      ✓ {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={() => handleToggleActive(admin)}
                  style={{
                    background: admin.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: admin.is_active ? '#fca5a5' : '#86efac',
                    border: `1px solid ${admin.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: '0.6rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {admin.is_active ? 'Suspend' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(admin)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '0.6rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Sub-Admin Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(5px)',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '480px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem', fontWeight: 900 }}>
                ➕ Create Sub-Admin Account
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Telegram User ID *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1928631932"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Telegram Username (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. support_john"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Role Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. support, finance, moderator"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Assigned Permissions
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isSelected = selectedPermissions.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleTogglePermission(perm.id)}
                        style={{
                          padding: '0.45rem 0.6rem',
                          borderRadius: '0.5rem',
                          background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${isSelected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.72rem',
                          color: isSelected ? '#86efac' : '#94a3b8',
                          fontWeight: 700,
                        }}
                      >
                        <span>{isSelected ? '☑' : '☐'}</span>
                        <span>{perm.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '0.65rem',
                    color: '#e2e8f0',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '0.65rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '0.65rem',
                    color: 'white',
                    fontWeight: 900,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {submitting ? 'Saving...' : 'Grant Sub-Admin Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
