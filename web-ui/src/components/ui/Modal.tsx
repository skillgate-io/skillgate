/* Modal dialog using native <dialog> for accessibility. */
'use client';

import React from 'react';
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        handleClose();
      }
    },
    [handleClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 z-50 m-auto max-w-lg rounded-xl border border-white/10',
        'bg-[#0c1119] p-0 text-surface-100 shadow-2xl',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        'open:animate-in open:fade-in open:zoom-in-95',
        className,
      )}
      aria-labelledby="modal-title"
    >
      <div className="p-6">
        <h2
          id="modal-title"
          className="mb-4 text-lg font-semibold text-white"
        >
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
