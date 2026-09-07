import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CopilotConnectionState } from '../types';
import { LANGUAGES } from '../utils/languages';
import { useAuth } from '../contexts/AuthContext';
import { PurchaseCreditsModal } from './PurchaseCreditsModal';
import { AdminDashboardModal } from './admin/AdminDashboardModal';
import logoImg from '../assets/logo.png';

interface HeaderProps {
  onStart?: () => void;
  isShowingSetup?: boolean;
  isStartingSession?: boolean;
  onStartInterview?: () => void;
  onCancelSetup?: () => void;
  isSessionStarted: boolean;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  autoAnswer: boolean;
  onAutoAnswerChange: (enabled: boolean) => void;
  canGenerateAnswer: boolean;
  onGenerateAnswer: () => void;
  copilotConnectionState: CopilotConnectionState;
  pendingCopilotWork: number;
  onReconnectCopilot: () => void;
  onEnd: () => void;
  onAnalyzeScreen: () => void;
  isMicEnabled: boolean;
  onToggleMic: () => void;
}

export default function Header({
  onStart,
  isShowingSetup = false,
  isStartingSession = false,
  onStartInterview,
  onCancelSetup,
  isSessionStarted,
  selectedLanguage,
  onLanguageChange,
  autoAnswer,
  onAutoAnswerChange,
  canGenerateAnswer,
  onGenerateAnswer,
  copilotConnectionState,
  pendingCopilotWork,
  onReconnectCopilot,
  onEnd,
  onAnalyzeScreen,
  isMicEnabled,
  onToggleMic,
}: HeaderProps) {
  const { user, logout } = useAuth();

  // Screen permission
  const [hasScreenPermission, setHasScreenPermission] = useState<boolean | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // UI settings
  const [bgOpacity, setBgOpacity] = useState(() => {
    const stored = localStorage.getItem('meow-bg-opacity');
    return stored ? parseFloat(stored) : 0.5;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [privateMode, setPrivateMode] = useState(() => {
    const stored = localStorage.getItem('meow-private-mode');
    return stored !== null ? stored === 'true' : true;
  });
  const [fontScale, setFontScale] = useState(() => {
    const stored = localStorage.getItem('meow-font-scale');
    return stored ? parseFloat(stored) : 1;
  });
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const sessionStartTime = useRef<number | null>(null);
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac');
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  // Check screen permission on mount
  useEffect(() => {
    window.meow?.checkScreenPermission?.().then(setHasScreenPermission).catch(() => {});
    const cleanup = window.meow?.onScreenPermissionStatus?.((status: boolean) => setHasScreenPermission(status));
    return () => cleanup?.();
  }, []);

  // Apply bg opacity
  useEffect(() => {
    document.documentElement.style.setProperty('--app-bg-opacity', String(bgOpacity));
    localStorage.setItem('meow-bg-opacity', String(bgOpacity));
  }, [bgOpacity]);

  // Apply font scale
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}rem`;
    localStorage.setItem('meow-font-scale', String(fontScale));
  }, [fontScale]);

  // Apply private mode
  useEffect(() => {
    localStorage.setItem('meow-private-mode', String(privateMode));
    window.meow?.setPrivateMode?.(privateMode);
  }, [privateMode]);

  // Close menu on outside click / Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Session duration timer
  useEffect(() => {
    if (isSessionStarted) {
      if (!sessionStartTime.current) sessionStartTime.current = Date.now();
      const timer = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - (sessionStartTime.current || Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else {
      sessionStartTime.current = null;
      setSessionDuration(0);
    }
  }, [isSessionStarted]);

  const requestScreenPermission = async () => {
    setRequestingPermission(true);
    try {
      const granted = await window.meow?.requestScreenPermission?.();
      setHasScreenPermission(granted ?? false);
    } finally {
      setRequestingPermission(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (!isSessionStarted) return null;

    const stateMap: Record<string, { label: string; className: string }> = {
      connected: { label: '● Connected', className: 'connected' },
      joining: { label: 'Connecting...', className: 'joining' },
      reconnecting: { label: '⟳ Reconnecting...', className: 'reconnecting' },
      disconnected: { label: 'Disconnected', className: 'disconnected' },
      error: { label: '✕ Error', className: 'error' },
      idle: { label: 'Ready', className: 'idle' },
    };
    const state = stateMap[copilotConnectionState] || stateMap.idle;

    return (
      <div className={`copilot-connection-indicator ${state.className}`}>
        <span>{state.label}</span>
        {(copilotConnectionState === 'disconnected' || copilotConnectionState === 'error') && (
          <button className="copilot-reconnect-button" onClick={onReconnectCopilot}>Retry</button>
        )}
      </div>
    );
  };

  // Queue indicator
  const renderQueueIndicator = () => {
    if (!isSessionStarted || pendingCopilotWork <= 0) return null;
    return (
      <div className="copilot-queue-indicator">
        <span className="copilot-queue-spinner" />
        <span>{pendingCopilotWork} pending</span>
      </div>
    );
  };

  // Duration indicator
  const renderDurationIndicator = () => {
    if (!isSessionStarted) return null;
    return (
      <div className="session-duration-indicator">
        {formatDuration(sessionDuration)}
      </div>
    );
  };

  // Menu popover
  const renderMenu = () => (
    <div className="app-menu" ref={menuRef} data-window-interactive="true">
      <button
        type="button"
        className="menu-trigger-button"
        aria-label="Open menu"
        aria-expanded={menuOpen}
        title="Settings & Options"
        data-window-interactive="true"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      {menuOpen && (
        <div className="app-menu-popover" role="menu" data-window-interactive="true">
          {/* User info */}
          {user && (
            <div className="app-menu-item" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', paddingBottom: '8px' }} data-window-interactive="true">
              <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>{user.name}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{user.email}</span>
            </div>
          )}

          {/* Private mode toggle */}
          <div className="app-menu-item app-menu-toggle-row" data-window-interactive="true">
            <span className="app-menu-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <div className="app-menu-copy"><span>Private</span></div>
            <label className="private-mode-switch" data-window-interactive="true">
              <input type="checkbox" checked={privateMode} onChange={(e) => setPrivateMode(e.target.checked)} />
              <span />
            </label>
          </div>
          {/* Font controls */}
          <div className="app-menu-item app-menu-font-row" data-window-interactive="true">
            <span className="app-menu-icon" aria-hidden="true">Aa</span>
            <span>Font</span>
            <div className="font-control" data-window-interactive="true">
              <button type="button" aria-label="Decrease font size" onClick={() => setFontScale((v) => Math.max(0.85, v - 0.05))} disabled={fontScale <= 0.85}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
              </button>
              <button type="button" aria-label="Increase font size" onClick={() => setFontScale((v) => Math.min(1.3, v + 0.05))} disabled={fontScale >= 1.3}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </button>
            </div>
          </div>
          {/* Buy Credits Menu Item */}
          {user && (
            <button
              type="button"
              className="app-menu-item"
              role="menuitem"
              data-window-interactive="true"
              onClick={() => {
                setMenuOpen(false);
                setIsPurchaseModalOpen(true);
              }}
            >
              <span className="app-menu-icon" aria-hidden="true" style={{ color: '#38bdf8' }}>⚡</span>
              <span>Buy Credits</span>
            </button>
          )}

          {/* Admin Dashboard Menu Item */}
          {user && user.role === 'admin' && (
            <button
              type="button"
              className="app-menu-item"
              role="menuitem"
              data-window-interactive="true"
              onClick={() => {
                setMenuOpen(false);
                setIsAdminDashboardOpen(true);
              }}
            >
              <span className="app-menu-icon" aria-hidden="true" style={{ color: '#a855f7' }}>🛡️</span>
              <span style={{ color: '#c084fc', fontWeight: 600 }}>Admin Dashboard</span>
            </button>
          )}

          {/* Sign Out */}
          {user && (
            <button type="button" className="app-menu-item" role="menuitem" data-window-interactive="true" onClick={() => logout()}>
              <span className="app-menu-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </span>
              <span>Sign Out</span>
            </button>
          )}
          {/* Quit */}
          <button type="button" className="app-menu-item app-menu-danger" role="menuitem" data-window-interactive="true" onClick={() => window.meow?.quitApp?.()}>
            <span className="app-menu-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </span>
            <span>Quit</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <header className="header" data-window-interactive="true">
      <div className="header-container">
        <div className="header-left">
          <img src={logoImg} alt="Meoow" className="logo" />
          <span className="app-title">Meoow</span>
        </div>
        <div className="header-right">
          {/* Credits Badge & Purchase Trigger */}
          {user && (
            <button
              type="button"
              className="user-credits-badge"
              title="Click to buy more AI credits"
              onClick={() => setIsPurchaseModalOpen(true)}
              data-window-interactive="true"
            >
              <span className="user-credits-icon">⚡</span>
              <span>{user.credits} credits</span>
              <span className="user-buy-credits-btn">+ Buy</span>
            </button>
          )}
          {renderConnectionStatus()}
          {renderDurationIndicator()}
          {renderQueueIndicator()}

          {isSessionStarted && (
            <>
              <label className="auto-answer-toggle" data-window-interactive="true">
                <input type="checkbox" checked={autoAnswer} onChange={(e) => onAutoAnswerChange?.(e.target.checked)} />
                <span>Auto Answer</span>
              </label>
              <select value={selectedLanguage} onChange={(e) => onLanguageChange?.(e.target.value)} className="language-dropdown" data-window-interactive="true">
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </>
          )}

          {isSessionStarted ? (
            <div className="session-controls" data-window-interactive="true">
              <button
                type="button"
                onClick={onToggleMic}
                className={`mic-button ${isMicEnabled ? '' : 'muted'}`}
                title={isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                data-window-interactive="true"
              >
                {isMicEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19v3" /><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /><path d="M16.95 16.95A7 7 0 0 1 5 12v-2" /><path d="M18.89 13.23A7 7 0 0 0 19 12v-2" /><path d="m2 2 20 20" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={onAnalyzeScreen}
                className="analyze-button"
                title="Analyze Screen (Ctrl+Shift+A)"
                data-window-interactive="true"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
                  <path d="M20.054 15.987H3.946" />
                </svg>
                Analyze
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="end-button"
                title="End Interview Session"
                data-window-interactive="true"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                </svg>
                End
              </button>
              {renderMenu()}
            </div>
          ) : hasScreenPermission === null ? (
            <button type="button" disabled className="start-button" data-window-interactive="true">Loading...</button>
          ) : hasScreenPermission ? (
            <div className="pre-session-controls" data-window-interactive="true">
              {isShowingSetup ? (
                <>
                  <button
                    type="submit"
                    form="session-setup-form"
                    onClick={(e) => {
                      const form = document.getElementById('session-setup-form') as HTMLFormElement | null;
                      if (form) {
                        e.preventDefault();
                        form.requestSubmit();
                      }
                    }}
                    className="start-session-button"
                    disabled={isStartingSession}
                    title="Start Live Interview Session"
                    data-window-interactive="true"
                  >
                    {isStartingSession ? 'Starting...' : 'Start Session'}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelSetup || onStart}
                    className="cancel-setup-button"
                    title="Cancel and close setup"
                    data-window-interactive="true"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onStartInterview || onStart}
                  className="start-button"
                  title="Configure and start interview"
                  data-window-interactive="true"
                >
                  Start Interview
                </button>
              )}
              {renderMenu()}
              <button type="button" onClick={() => window.meow?.quitApp?.()} className="close-app-button" title="Quit Application" data-window-interactive="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="pre-session-controls" data-window-interactive="true">
              <button type="button" onClick={requestScreenPermission} disabled={requestingPermission} className="start-button screen-access-button" data-window-interactive="true">
                {requestingPermission ? 'Requesting...' : 'Request Screen Access'}
              </button>
              {renderMenu()}
              <button type="button" onClick={() => window.meow?.quitApp?.()} className="close-app-button" title="Quit Application" data-window-interactive="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="header-controls">
        <label className="opacity-slider-label">
          <span className="opacity-slider-icon">☀</span>
          <input type="range" min={0.1} max={1} step={0.05} value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))} className="opacity-slider" title={`Background opacity: ${Math.round(bgOpacity * 100)}%`} />
          <span className="opacity-slider-value">{Math.round(bgOpacity * 100)}%</span>
        </label>
        <div className="keyboard-shortcuts">
          <p>Show/Hide: <span className="key-badge">{modKey}</span> + <span className="text-badge">shift</span> + <span className="text-badge">H</span></p>
          <p>Move: <span className="key-badge">{altKey}</span> + <span className="key-badge">← ↑ → ↓</span></p>
          {isSessionStarted && (
            <p>Analyze: <span className="key-badge">{modKey}</span> + <span className="text-badge">shift</span> + <span className="text-badge">A</span></p>
          )}
        </div>
      </div>
      <PurchaseCreditsModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
      />
      <AdminDashboardModal
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />
    </header>
  );
}

