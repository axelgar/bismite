import Link from "next/link";
import { Logo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";

// Sticky product top bar shared by the dashboard surfaces. Brand + active-org switcher +
// Team link on the left, caller-supplied account controls on the right.
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
        <Link href="/dashboard" className="inline-flex items-center gap-2.5 rounded-md">
          <Logo size={22} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Bismite</span>
        </Link>
        <span className="text-border-soft">/</span>
        <OrgSwitcher />
        <Link
          href="/dashboard/members"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Team
        </Link>
        <Link
          href="/dashboard/account"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Account
        </Link>
        <a
          href="https://bismite.dev/docs.html"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Docs
        </a>
        <div className="ml-auto flex items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
