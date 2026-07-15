import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
