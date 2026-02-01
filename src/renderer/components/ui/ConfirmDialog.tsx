import React from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const confirmButtonClass =
    variant === 'danger' ? 'modal-btn modal-btn-danger' : 'modal-btn modal-btn-primary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="modal-btn modal-btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={confirmButtonClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5 }}>
        {message}
      </p>
    </Modal>
  );
};
