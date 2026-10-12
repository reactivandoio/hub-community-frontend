import { Skeleton } from '@/components/ui/skeleton';

export function EventsTableSkeleton() {
  return (
    <div className="w-full py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="border rounded-md">
        {/* Header */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12 ml-auto" />
        </div>

        {/* Rows */}
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 p-4 border-b last:border-0"
          >
            <div>
              <Skeleton className="h-5 w-full mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-40" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
