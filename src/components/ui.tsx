"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  closeLabel = "Kapat",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "glass-panel max-h-[92vh] w-full overflow-y-auto p-5 sm:p-7",
          wide ? "max-w-3xl" : "max-w-md",
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="ghost-button !min-h-9 !p-2" type="button" onClick={onClose} aria-label={closeLabel}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-[var(--danger)]">
      {message}
    </p>
  );
}

export function Spinner({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-semibold text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}
