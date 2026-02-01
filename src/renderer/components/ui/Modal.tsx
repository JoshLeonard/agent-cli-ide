import React, { useEffect, useRef, useCallback } from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  children,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Handle click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Focus management and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Save the currently focused element
      previousActiveElement.current = document.activeElement;

      // Add escape key listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal
      modalRef.current?.focus();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);

        // Restore focus to the previously focused element
        if (previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <h3 id="modal-title" className="modal-title">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
              >
                &times;
              </button>
            )}
          </div>
        )}
        <div className="modal-content">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
