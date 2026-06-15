/**
 * Skeleton component for loading states.
 * Provides a pulsed gray block to simulate content.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function StaffSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white/50">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ModuleSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white/50">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PermissionSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between p-3 rounded-lg bg-gray-50/50">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
