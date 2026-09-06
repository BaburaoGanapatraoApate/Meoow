import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  adminApi,
  AdminStats,
  AdminUser,
  AdminAuditLog,
} from '../services/adminApi';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Shield,
  Users,
  CheckCircle2,
  Sparkles,
  Zap,
  Key,
  Search,
  RefreshCw,
  LogOut,
  AlertTriangle,
  X,
  ExternalLink,
  Trash2,
  Clock,
  ShieldCheck,
  XCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { token, user: currentUser, logout } = useAuth();

  // Navigation & Data Tabs
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_LIMIT = 50;

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Assign Keys Modal State
  const [selectedUserForKeys, setSelectedUserForKeys] = useState<AdminUser | null>(null);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [deepgramKeyInput, setDeepgramKeyInput] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);

  // Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'remove_overrides' | 'toggle_mode';
    user: AdminUser;
  } | null>(null);

  // ── Load Dashboard Data ──
  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const [statsRes, usersRes] = await Promise.all([
        adminApi.getStats(token),
        adminApi.getUsers(token, {
          search: searchQuery,
          limit: PAGE_LIMIT,
          offset: page * PAGE_LIMIT,
        }),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users);
      setTotalUsersCount(usersRes.total);

      if (activeTab === 'audit') {
        const auditRes = await adminApi.getAuditLogs(token, 50);
        setAuditLogs(auditRes.logs);
      }
    } catch (err: any) {
      if (err.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (err.status === 403) {
        setError('Server Authorization Rejected: Administrative privileges required.');
      } else {
        setError(err.message || 'Failed to load administrative data.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, searchQuery, page, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Tab Switch
  const handleTabChange = async (tab: 'users' | 'audit') => {
    setActiveTab(tab);
    if (tab === 'audit' && token) {
      try {
        setIsLoading(true);
        const auditRes = await adminApi.getAuditLogs(token, 50);
        setAuditLogs(auditRes.logs);
      } catch (err: any) {
        setError(err.message || 'Failed to load audit logs.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // ── Handle Assign Keys Submit ──
  const handleAssignKeysSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForKeys || !token) return;

    if (!groqKeyInput.trim() && !deepgramKeyInput.trim()) {
      setError('Please provide at least one provider API key.');
      return;
    }

    setIsActionLoading(true);
    setError(null);

    try {
      await adminApi.assignProviderOverrides(token, selectedUserForKeys.id, {
        groqApiKey: groqKeyInput.trim() || undefined,
        deepgramApiKey: deepgramKeyInput.trim() || undefined,
      });

      setSuccessMessage(`Provider overrides successfully assigned to ${selectedUserForKeys.email}.`);
      setSelectedUserForKeys(null);
      setGroqKeyInput('');
      setDeepgramKeyInput('');
      setShowGroqKey(false);
      setShowDeepgramKey(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign provider keys.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Handle Remove Overrides ──
  const handleConfirmRemoveOverrides = async (user: AdminUser) => {
    if (!token) return;
    setIsActionLoading(true);
    setError(null);

    try {
      await adminApi.removeProviderOverrides(token, user.id);
      setSuccessMessage(`Provider overrides removed for ${user.email}. User reset to standard credits mode.`);
      setConfirmDialog(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove provider overrides.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Handle Toggle Usage Mode ──
  const handleConfirmToggleMode = async (user: AdminUser) => {
    if (!token) return;
    const newMode = user.usageMode === 'unlimited' ? 'credits' : 'unlimited';
    setIsActionLoading(true);
    setError(null);

    try {
      await adminApi.updateUsageMode(token, user.id, newMode);
      setSuccessMessage(`Usage mode for ${user.email} updated to '${newMode}'.`);
      setConfirmDialog(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update usage mode.');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── TOP HEADER ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-brand-purple-50 border border-brand-purple-200 flex items-center justify-center text-brand-purple-600 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-brand-navy-950 tracking-tight">
                Admin Dashboard
              </h1>
              <Badge variant="purple" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Production
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Platform administration, user controls & provider overrides
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>View Website</span>
          </Link>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {currentUser && (
            <div className="flex items-center gap-2 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-brand-navy-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500">{currentUser.email}</p>
              </div>
              <button
                onClick={() => logout()}
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition border border-slate-200/60"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── NOTIFICATIONS & FEEDBACK ── */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-rose-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-600 p-1"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 p-1"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 5 METRIC STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* 1. Total Users */}
        <Card hoverEffect={false} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy-950">
            {stats ? stats.totalUsers.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Platform registered accounts</p>
        </Card>

        {/* 2. Verified Users */}
        <Card hoverEffect={false} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Verified</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy-950">
            {stats ? stats.verifiedUsers.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Completed email OTP verification</p>
        </Card>

        {/* 3. Users With Credits */}
        <Card hoverEffect={false} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Balance</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy-950">
            {stats ? stats.usersWithCredits.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Users with &gt; 0 credits available</p>
        </Card>

        {/* 4. Unlimited Mode */}
        <Card hoverEffect={false} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unlimited Users</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy-950">
            {stats ? stats.unlimitedUsers.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Free unrestricted interview mode</p>
        </Card>

        {/* 5. Provider Overrides */}
        <Card hoverEffect={false} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Custom Keys</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-brand-navy-950">
            {stats ? stats.usersWithOverrides.toLocaleString() : '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Users with Groq/Deepgram overrides</p>
        </Card>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => handleTabChange('users')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-brand-purple-600 text-brand-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {totalUsersCount}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('audit')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-brand-purple-600 text-brand-purple-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Trail</span>
        </button>
      </div>

      {/* ── TAB CONTENT: USERS MANAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search user name or email..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20 focus:border-brand-purple-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {users.length} of {totalUsersCount} users
            </div>
          </div>

          {/* User Table Card */}
          <Card hoverEffect={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Verification</th>
                    <th className="py-3.5 px-4">Credits</th>
                    <th className="py-3.5 px-4">Usage Mode</th>
                    <th className="py-3.5 px-4">Overrides</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-purple-500" />
                        <p className="text-sm font-medium">Loading user accounts...</p>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-base font-bold text-brand-navy-900">No users found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery ? 'Try adjusting your search criteria.' : 'No registered users in the database yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition">
                        {/* User identity */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-brand-navy-950">{user.name || 'Unnamed User'}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                            ID: {user.id}
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              <ShieldCheck className="w-3 h-3" />
                              ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                              USER
                            </span>
                          )}
                        </td>

                        {/* Email Verification */}
                        <td className="py-3.5 px-4">
                          {user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                              <XCircle className="w-3.5 h-3.5" />
                              Unverified
                            </span>
                          )}
                        </td>

                        {/* Credits */}
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-brand-navy-900">
                            {user.credits.toLocaleString()}
                          </span>
                        </td>

                        {/* Usage Mode */}
                        <td className="py-3.5 px-4">
                          {user.usageMode === 'unlimited' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Zap className="w-3 h-3 text-purple-600" />
                              UNLIMITED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              CREDITS
                            </span>
                          )}
                        </td>

                        {/* Provider Overrides */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {user.hasGroqOverride ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Groq Key
                              </span>
                            ) : null}
                            {user.hasDeepgramOverride ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                Deepgram Key
                              </span>
                            ) : null}
                            {!user.hasGroqOverride && !user.hasDeepgramOverride && (
                              <span className="text-xs text-slate-400 font-normal">None</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* Assign Keys */}
                            <button
                              onClick={() => {
                                setSelectedUserForKeys(user);
                                setGroqKeyInput('');
                                setDeepgramKeyInput('');
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg text-brand-purple-700 bg-brand-purple-50 hover:bg-brand-purple-100 border border-brand-purple-200 transition"
                              title="Assign custom Groq/Deepgram API keys"
                            >
                              Assign Keys
                            </button>

                            {/* Toggle Mode */}
                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  isOpen: true,
                                  title: user.usageMode === 'unlimited' ? 'Switch to Credits Mode?' : 'Grant Unlimited Usage Mode?',
                                  message: `Are you sure you want to switch ${user.email} from '${user.usageMode}' to '${user.usageMode === 'unlimited' ? 'credits' : 'unlimited'}'?`,
                                  actionType: 'toggle_mode',
                                  user,
                                });
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition"
                              title="Toggle between credits and unlimited mode"
                            >
                              {user.usageMode === 'unlimited' ? 'Use Credits' : 'Make Unlimited'}
                            </button>

                            {/* Remove Overrides */}
                            {(user.hasGroqOverride || user.hasDeepgramOverride) && (
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Remove Provider Overrides?',
                                    message: `This will delete stored API keys for ${user.email} and reset their account to standard credits mode.`,
                                    actionType: 'remove_overrides',
                                    user,
                                  });
                                }}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Remove all provider overrides"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalUsersCount > PAGE_LIMIT && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Page {page + 1} of {Math.ceil(totalUsersCount / PAGE_LIMIT)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * PAGE_LIMIT >= totalUsersCount}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB CONTENT: AUDIT TRAIL ── */}
      {activeTab === 'audit' && (
        <Card hoverEffect={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Admin</th>
                  <th className="py-3.5 px-4">Target Account</th>
                  <th className="py-3.5 px-4">Details / Metadata</th>
                  <th className="py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {isLoading && auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-purple-500" />
                      <p className="text-sm font-medium">Loading audit history...</p>
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-base font-bold text-brand-navy-900">No audit logs recorded</p>
                      <p className="text-xs text-slate-400 mt-0.5">Admin actions will appear here chronologically.</p>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition">
                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-brand-navy-900 border border-slate-200">
                          {log.action}
                        </span>
                      </td>

                      {/* Admin */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {log.adminEmail || 'System / Bootstrap'}
                      </td>

                      {/* Target User */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {log.targetEmail || 'N/A'}
                      </td>

                      {/* Metadata */}
                      <td className="py-3.5 px-4 text-xs">
                        <code className="bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[11px] text-slate-600 block max-w-sm truncate">
                          {typeof log.metadata === 'object' ? JSON.stringify(log.metadata) : String(log.metadata || '—')}
                        </code>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── ASSIGN PROVIDER KEYS MODAL ── */}
      {selectedUserForKeys && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-purple-50 text-brand-purple-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-brand-navy-950">Assign Provider Keys</h3>
                  <p className="text-xs text-slate-500">Enable custom API key overrides for friend mode</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForKeys(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleAssignKeysSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500">Target User:</span>{' '}
                <span className="font-bold text-brand-navy-900">{selectedUserForKeys.email}</span>
              </div>

              {/* Groq Key Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Groq API Key (Optional)</label>
                <div className="relative">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKeyInput}
                    onChange={(e) => setGroqKeyInput(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full px-3 py-2 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20 focus:border-brand-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Used for AI question answering and streaming inference.</p>
              </div>

              {/* Deepgram Key Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Deepgram API Key (Optional)</label>
                <div className="relative">
                  <input
                    type={showDeepgramKey ? 'text' : 'password'}
                    value={deepgramKeyInput}
                    onChange={(e) => setDeepgramKeyInput(e.target.value)}
                    placeholder="Token..."
                    className="w-full px-3 py-2 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple-500/20 focus:border-brand-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeepgramKey(!showDeepgramKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showDeepgramKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Used for live audio speech-to-text transcription.</p>
              </div>

              {/* Security Banner */}
              <div className="bg-brand-purple-50/70 border border-brand-purple-200/70 rounded-xl p-3 text-[11px] text-brand-purple-800 leading-relaxed">
                <p className="font-bold mb-0.5">🔒 Encryption & Privacy Guarantee</p>
                Keys are transmitted securely over TLS, encrypted with AES-256-GCM at rest, and never exposed back to the browser.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForKeys(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading || (!groqKeyInput.trim() && !deepgramKeyInput.trim())}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-purple-600 hover:bg-brand-purple-700 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Overrides</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOG MODAL ── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-brand-navy-950 mb-1.5">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDialog.actionType === 'remove_overrides') {
                    handleConfirmRemoveOverrides(confirmDialog.user);
                  } else if (confirmDialog.actionType === 'toggle_mode') {
                    handleConfirmToggleMode(confirmDialog.user);
                  }
                }}
                disabled={isActionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-purple-600 hover:bg-brand-purple-700 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm Action</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
