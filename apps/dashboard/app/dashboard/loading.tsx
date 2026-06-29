import { TopBar } from "@/components/top-bar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <TopBar>
        <Skeleton className="h-4 w-40" />
      </TopBar>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-[16px]" />
          ))}
        </div>
      </main>
    </>
  );
}
