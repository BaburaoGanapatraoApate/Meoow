import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration: number;
}

interface ToastContextType {
  success: (title: string, message?: string, action?: ToastAction) => void;
  info: (title: string, message?: string, action?: ToastAction) => void;
  warning: (title: string, message?: string, action?: ToastAction) => void;
  error: (title: string, message?: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATIONS = {
  success: 4000,
  info: 5000,
  warning: 9000,
  error: 8000,
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string, action?: ToastAction) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const duration = DURATIONS[type];
    
    const newToast: Toast = { id, type, title, message, action, duration };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const success = useCallback((title: string, message?: string, action?: ToastAction) => addToast('success', title, message, action), [addToast]);
  const info = useCallback((title: string, message?: string, action?: ToastAction) => addToast('info', title, message, action), [addToast]);
  const warning = useCallback((title: string, message?: string, action?: ToastAction) => addToast('warning', title, message, action), [addToast]);
  const error = useCallback((title: string, message?: string, action?: ToastAction) => addToast('error', title, message, action), [addToast]);

  return (
    <ToastContext.Provider value={{ success, info, warning, error }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastViewportProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  isSessionActive?: boolean;
}

export const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss, isSessionActive }) => {
  return (
    <div className={`desktop-toast-viewport ${isSessionActive ? 'session-active' : ''}`}>
      {toasts.map(toast => (
        <div key={toast.id} className={`desktop-toast desktop-toast-${toast.type} desktop-toast-in`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {(toast.type === 'warning' || toast.type === 'error') && '!'}
            {toast.type === 'info' && 'i'}
          </div>
          <div className="toast-content">
            <strong>{toast.title}</strong>
            {toast.message && <span>{toast.message}</span>}
            {toast.action && (
              <button onClick={toast.action.onClick}>{toast.action.label}</button>
            )}
          </div>
          <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>X</button>
        </div>
      ))}
    </div>
  );
};
