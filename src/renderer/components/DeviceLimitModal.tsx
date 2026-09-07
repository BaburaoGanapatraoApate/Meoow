import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { deviceApi, DeviceInfo } from '../services/deviceApi';
import { useToast } from './Toast';

interface DeviceLimitModalProps {
  isOpen: boolean;
  activeDevices: DeviceInfo[];
  maxDevices: number;
  onDeviceReplaced: () => void;
  onLogout: () => void;
}

export function DeviceLimitModal({
  isOpen,
  activeDevices,
  maxDevices,
  onDeviceReplaced,
  onLogout,
}: DeviceLimitModalProps) {
  const { token } = useAuth();
  const toast = useToast();
  const [isReplacing, setIsReplacing] = useState(false);
  const [replacingDeviceId, setReplacingDeviceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReplace = async (targetDevice: DeviceInfo) => {
    if (!token) return;
    setIsReplacing(true);
    setReplacingDeviceId(targetDevice.deviceId);
    setErrorMessage(null);

    try {
      const identity = await window.meow?.getDeviceIdentity?.();
      if (!identity) {
        throw new Error('Unable to retrieve local machine identity.');
      }

      await deviceApi.replaceDevice(token, targetDevice.deviceId, identity);
      toast.success(`Successfully replaced ${targetDevice.deviceName || 'previous device'} with this PC!`);
      onDeviceReplaced();
    } catch (err: any) {
      console.error('[DeviceLimitModal] Replace failed:', err);
      setErrorMessage(err.message || 'Failed to replace device. Please try again.');
    } finally {
      setIsReplacing(false);
      setReplacingDeviceId(null);
    }
  };

  return (
    <div className="purchase-modal-overlay" data-window-interactive="true" style={{ zIndex: 10000 }}>
      <div
        className="purchase-modal-container"
        data-window-interactive="true"
        style={{ maxWidth: 520, width: '92%' }}
      >
        {/* Header */}
        <div className="purchase-modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <div className="purchase-modal-title-group">
            <span
              className="purchase-modal-badge"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              ⚠️ Device Limit
            </span>
            <h2 className="purchase-modal-title" style={{ fontSize: '1.25rem' }}>
              Device Limit Reached
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="purchase-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '1rem' }}>
            Your Meoow account allows a maximum of <strong>{maxDevices} active devices</strong>.
            To authorize and activate this computer, select an existing device below to deactivate and replace.
          </p>

          {errorMessage && (
            <div
              className="purchase-error-banner"
              style={{ marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Active Devices List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {activeDevices.map((device) => {
              const isCurrentReplacing = isReplacing && replacingDeviceId === device.deviceId;
              const formattedDate = device.lastSeenAt
                ? new Date(device.lastSeenAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently active';

              return (
                <div
                  key={device.deviceId || device.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '0.5rem',
                  }}
                  data-window-interactive="true"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.925rem' }}>
                      💻 {device.deviceName || 'Windows PC'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {device.platform} {device.osVersion ? `• ${device.osVersion}` : ''} • Last active: {formattedDate}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleReplace(device)}
                    disabled={isReplacing}
                    style={{
                      background: isCurrentReplacing ? '#64748b' : '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.45rem 0.8rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      cursor: isReplacing ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background 0.2s ease',
                    }}
                    data-window-interactive="true"
                  >
                    {isCurrentReplacing ? 'Replacing...' : 'Deactivate & Replace'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(71, 85, 105, 0.3)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Need help? Contact support@meooow.tech
          </span>
          <button
            type="button"
            onClick={onLogout}
            disabled={isReplacing}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '0.8rem',
              padding: '0.4rem 0.8rem',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
            data-window-interactive="true"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

