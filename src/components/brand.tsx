import Image from "next/image";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Qirushio home">
      <Image
        src="/assets/logo.png"
        width={compact ? 38 : 48}
        height={compact ? 38 : 48}
        alt=""
        unoptimized
        loading="eager"
        className="rounded-xl shadow-sm"
      />
      <span className={cn("brand-gradient font-extrabold tracking-tight", compact ? "text-xl" : "text-2xl")}>
        Qirushio
      </span>
    </Link>
  );
}

export function AppHeader({
  action,
  compact = false,
  helpLabel = "Nasıl Oynanır?",
}: {
  action?: React.ReactNode;
  compact?: boolean;
  helpLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/55 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Brand compact={compact} />
        {action ?? (
          <button
            aria-label={helpLabel}
            className="ghost-button !min-h-10 !rounded-full !px-3 text-secondary-deep"
            type="button"
          >
            <CircleHelp size={20} />
            <span className="hidden sm:inline">{helpLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}
