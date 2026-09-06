import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminStats, AdminUser, AdminAuditLog } from '../../services/adminApi';
import { useAuth } from '../../contexts/AuthContext';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboardModal({ isOpen, onClose }: AdminDashboardModalProps) {
  const { token, user: currentUser } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Key assignment modal state
  const [selectedUserForKeys, setSelectedUserForKeys] = useState<AdminUser | null>(null);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [deepgramKeyInput, setDeepgramKeyInput] = useState('');
  const [isSubmittingKeys, setIsSubmittingKeys] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'remove_overrides' | 'toggle_mode' | 'assign_keys';
    user: AdminUser;
    extraData?: any;
  } | null>(null);

  // Load Dashboard Data
  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const [statsRes, usersRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getUsers(token, { search: searchQuery }),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users);

      if (activeTab === 'audit') {
        const auditRes = await adminApi.getAuditLogs(token, 50);
        setAuditLogs(auditRes.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery, activeTab]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Handle Assign Keys Submit
  const handleAssignKeysSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForKeys || !token) return;

    if (!groqKeyInput.trim() && !deepgramKeyInput.trim()) {
      setError('Please provide at least one provider API key.');
      return;
    }

    setIsSubmittingKeys(true);
    setError(null);

    try {
      await adminApi.assignProviderOverrides(token, selectedUserForKeys.id, {
        groqApiKey: groqKeyInput.trim() || undefined,
        deepgramApiKey: deepgramKeyInput.trim() || undefined,
      });

      setSuccessMessage(
        `Provider overrides successfully assigned to ${selectedUserForKeys.email}.`
      );
      setSelectedUserForKeys(null);
      setGroqKeyInput('');
      setDeepgramKeyInput('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign provider keys.');
    } finally {
      setIsSubmittingKeys(false);
    }
  };

  // Handle Remove Overrides
  const handleConfirmRemoveOverrides = async (user: AdminUser) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      await adminApi.removeProviderOverrides(token, user.id);
      setSuccessMessage(`Provider overrides removed for ${user.email}. User reset to credits mode.`);
      setConfirmDialog(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove provider overrides.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Toggle Usage Mode
  const handleConfirmToggleMode = async (user: AdminUser) => {
    if (!token) return;
    const newMode = user.usageMode === 'unlimited' ? 'credits' : 'unlimited';
    setIsLoading(true);
    setError(null);

    try {
      await adminApi.updateUsageMode(token, user.id, newMode);
      setSuccessMessage(`Usage mode for ${user.email} updated to '${newMode}'.`);
      setConfirmDialog(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update usage mode.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" data-window-interactive="true" onClick={onClose}>
      <div
        className="admin-modal-container"
        data-window-interactive="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-header-title-area">
            <span className="admin-badge">🛡️ ADMIN CONSOLE</span>
            <h2>Meoow System Administration</h2>
            <p className="admin-subtitle">
              Manage users, assign encrypted provider overrides, and configure Friend Unlimited Mode.
            </p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Global Alerts */}
        {error && (
          <div className="admin-alert error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {successMessage && (
          <div className="admin-alert success">
            <span>✓ {successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)}>✕</button>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{stats.totalUsers}</span>
            </div>
            <div className="admin-stat-card">
              <span className="stat-label">Verified Users</span>
              <span className="stat-value text-emerald">{stats.verifiedUsers}</span>
            </div>
            <div className="admin-stat-card">
              <span className="stat-label">Users With Credits</span>
              <span className="stat-value text-sky">{stats.usersWithCredits}</span>
            </div>
            <div className="admin-stat-card">
              <span className="stat-label">Unlimited Mode</span>
              <span className="stat-value text-purple">{stats.unlimitedUsers}</span>
            </div>
            <div className="admin-stat-card">
              <span className="stat-label">Provider Overrides</span>
              <span className="stat-value text-amber">{stats.usersWithOverrides}</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="admin-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 User Management
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            📋 Audit Trail
          </button>
        </div>

        {/* Tab 1: User Management */}
        {activeTab === 'users' && (
          <div className="admin-tab-content">
            <div className="admin-table-toolbar">
              <div className="admin-search-box">
                <input
                  type="text"
                  placeholder="Search user by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadData();
                  }}
                />
                <button type="button" className="admin-search-btn" onClick={loadData}>
                  Search
                </button>
              </div>
              <button
                type="button"
                className="admin-refresh-btn"
                onClick={loadData}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Credits</th>
                    <th>Usage Mode</th>
                    <th>Groq Provider</th>
                    <th>Deepgram Provider</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-empty-state">
                        {isLoading ? 'Loading users...' : 'No users found.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="user-name-cell">
                            <span className="user-full-name">{u.name}</span>
                            <span className="user-email-text">{u.email}</span>
                            {u.emailVerified ? (
                              <span className="verified-chip">✓ Verified</span>
                            ) : (
                              <span className="unverified-chip">Unverified</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="user-credits-val">⚡ {u.credits}</span>
                        </td>
                        <td>
                          {u.usageMode === 'unlimited' ? (
                            <span className="badge-unlimited">✨ Unlimited</span>
                          ) : (
                            <span className="badge-credits">Credits</span>
                          )}
                        </td>
                        <td>
                          {u.hasGroqOverride ? (
                            <span className="badge-override">🔒 Override</span>
                          ) : (
                            <span className="badge-default">Default</span>
                          )}
                        </td>
                        <td>
                          {u.hasDeepgramOverride ? (
                            <span className="badge-override">🔒 Override</span>
                          ) : (
                            <span className="badge-default">Default</span>
                          )}
                        </td>
                        <td>
                          <span className={`role-chip ${u.role}`}>{u.role}</span>
                        </td>
                        <td>
                          <div className="admin-actions-cell">
                            <button
                              type="button"
                              className="action-btn-primary"
                              title="Assign Groq and Deepgram keys (Friend Mode)"
                              onClick={() => {
                                setSelectedUserForKeys(u);
                                setGroqKeyInput('');
                                setDeepgramKeyInput('');
                              }}
                            >
                              🔑 Assign Keys
                            </button>
                            {(u.hasGroqOverride || u.hasDeepgramOverride) && (
                              <button
                                type="button"
                                className="action-btn-danger"
                                title="Remove overrides and reset to credits mode"
                                onClick={() =>
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Remove Provider Overrides',
                                    message: `Remove all custom provider API keys for ${u.email} and reset account to standard credits mode?`,
                                    actionType: 'remove_overrides',
                                    user: u,
                                  })
                                }
                              >
                                Remove
                              </button>
                            )}
                            <button
                              type="button"
                              className="action-btn-secondary"
                              title="Toggle between credits and unlimited"
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  title: 'Change Usage Mode',
                                  message: `Change usage mode for ${u.email} from '${u.usageMode}' to '${
                                    u.usageMode === 'unlimited' ? 'credits' : 'unlimited'
                                  }'?`,
                                  actionType: 'toggle_mode',
                                  user: u,
                                })
                              }
                            >
                              Mode
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="admin-tab-content">
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Admin</th>
                    <th>Target User</th>
                    <th>Provider</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty-state">
                        {isLoading ? 'Loading audit logs...' : 'No audit records logged yet.'}
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                        <td>
                          <span className="audit-action-chip">{log.action}</span>
                        </td>
                        <td>{log.adminEmail || 'System'}</td>
                        <td>{log.targetEmail || '—'}</td>
                        <td>{log.provider || '—'}</td>
                        <td className="audit-meta-cell">
                          <code>{JSON.stringify(log.metadata)}</code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Assign Provider Keys */}
        {selectedUserForKeys && (
          <div
            className="admin-submodal-overlay"
            onClick={() => setSelectedUserForKeys(null)}
          >
            <div
              className="admin-submodal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="submodal-header">
                <h3>Assign Provider Keys (Friend Mode)</h3>
                <button
                  type="button"
                  className="submodal-close"
                  onClick={() => setSelectedUserForKeys(null)}
                >
                  ✕
                </button>
              </div>
              <p className="submodal-desc">
                Assigning custom Groq and Deepgram keys will route all requests for{' '}
                <strong>{selectedUserForKeys.email}</strong> through their personal provider accounts.
                Assigning both keys automatically enables <strong>Unlimited Mode</strong>.
              </p>

              <form onSubmit={handleAssignKeysSubmit}>
                <div className="admin-form-group">
                  <label htmlFor="groqKey">Groq API Key (gsk_...)</label>
                  <input
                    id="groqKey"
                    type="password"
                    placeholder="Enter Groq API Key"
                    value={groqKeyInput}
                    onChange={(e) => setGroqKeyInput(e.target.value)}
                    autoComplete="off"
                  />
                  <span className="form-hint">
                    {selectedUserForKeys.hasGroqOverride
                      ? '🔒 Current status: Override active. Enter a new key to replace it.'
                      : 'Current status: Using Meoow Default Groq.'}
                  </span>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="dgKey">Deepgram API Key</label>
                  <input
                    id="dgKey"
                    type="password"
                    placeholder="Enter Deepgram API Key"
                    value={deepgramKeyInput}
                    onChange={(e) => setDeepgramKeyInput(e.target.value)}
                    autoComplete="off"
                  />
                  <span className="form-hint">
                    {selectedUserForKeys.hasDeepgramOverride
                      ? '🔒 Current status: Override active. Enter a new key to replace it.'
                      : 'Current status: Using Meoow Default Deepgram.'}
                  </span>
                </div>

                <div className="security-notice-box">
                  🛡️ <strong>Security Guarantee:</strong> Keys are encrypted at rest using AES-256-GCM.
                  Raw keys are never sent to client applications or displayed in dashboards.
                </div>

                <div className="submodal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setSelectedUserForKeys(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={isSubmittingKeys}
                  >
                    {isSubmittingKeys ? 'Encrypting & Saving...' : 'Save & Enable Friend Mode'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Confirmation Dialog */}
        {confirmDialog && (
          <div
            className="admin-submodal-overlay"
            onClick={() => setConfirmDialog(null)}
          >
            <div
              className="admin-submodal-card confirmation"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{confirmDialog.title}</h3>
              <p>{confirmDialog.message}</p>
              <div className="submodal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setConfirmDialog(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-confirm-action"
                  onClick={() => {
                    if (confirmDialog.actionType === 'remove_overrides') {
                      handleConfirmRemoveOverrides(confirmDialog.user);
                    } else if (confirmDialog.actionType === 'toggle_mode') {
                      handleConfirmToggleMode(confirmDialog.user);
                    }
                  }}
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

