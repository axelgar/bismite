import { TopBar } from "@/components/top-bar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <TopBar>
        <Skeleton className="h-4 w-40" />
      </TopBar>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-48" />
        <Skeleton className="mt-7 h-9 w-72" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[180px] rounded-[12px]" />
          <Skeleton className="h-[180px] rounded-[12px]" />
        </div>
      </main>
    </>
  );
}
