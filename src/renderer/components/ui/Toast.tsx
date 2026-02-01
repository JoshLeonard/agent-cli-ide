import React from 'react';
import { useToastStore, type ToastType } from '../../stores/toastStore';
import './Toast.css';

const TOAST_ICONS: Record<ToastType, string> = {
  info: 'i',
  success: '\u2713',
  warning: '!',
  error: '\u2717',
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => dismissToast(toast.id)}
          role="alert"
        >
          <span className="toast-icon">{TOAST_ICONS[toast.type]}</span>
          <span className="toast-message">{toast.message}</span>
          <span className="toast-dismiss">click to dismiss</span>
        </div>
      ))}
    </div>
  );
};
