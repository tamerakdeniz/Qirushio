import Image from "next/image";
import Link from "next/link";
import { CircleHelp } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Bilgi Yarışı ana sayfa">
      <Image
        src="/assets/logo.png"
        width={compact ? 38 : 48}
        height={compact ? 38 : 48}
        alt=""
        className="rounded-xl shadow-sm"
      />
      <span className={cn("brand-gradient font-extrabold tracking-tight", compact ? "text-xl" : "text-2xl")}>
        Bilgi Yarışı
      </span>
    </Link>
  );
}

export function AppHeader({
  action,
  compact = false,
}: {
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/50 bg-white/45 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Brand compact={compact} />
        {action ?? (
          <button className="ghost-button !min-h-10 !rounded-full !px-3 text-secondary-deep" type="button">
            <CircleHelp size={20} />
            <span className="hidden sm:inline">Nasıl Oynanır?</span>
          </button>
        )}
      </div>
    </header>
  );
}

