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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#191c1e]/35 p-3 backdrop-blur-sm sm:items-center">
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
          <button className="ghost-button !min-h-9 !p-2" type="button" onClick={onClose} aria-label="Kapat">
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
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
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

