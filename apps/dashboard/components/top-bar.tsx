import Link from "next/link";
import { Logo } from "@/components/logo";

// Sticky product top bar shared by the dashboard surfaces. Brand on the left (→ projects),
// caller-supplied account/context controls on the right.
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
        <Link href="/dashboard" className="inline-flex items-center gap-2.5 rounded-md">
          <Logo size={22} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Bismite</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
