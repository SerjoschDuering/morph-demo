export function ShimmerSkeleton() {
  return (
    <div className="flex-1 flex flex-col p-6 gap-4" style={{ background: "var(--bg-panel)" }}>
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="shimmer h-8 w-32" />
        <div className="shimmer h-5 w-20" />
      </div>
      {/* Content area skeleton */}
      <div className="flex gap-4 flex-1">
        <div className="flex flex-col gap-3 flex-1">
          <div className="shimmer h-48 w-full rounded-xl" />
          <div className="flex gap-3">
            <div className="shimmer h-24 flex-1 rounded-xl" />
            <div className="shimmer h-24 flex-1 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-3 w-48">
          <div className="shimmer h-10 w-full" />
          <div className="shimmer h-10 w-full" />
          <div className="shimmer h-10 w-full" />
        </div>
      </div>
      {/* Status */}
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: "var(--accent)" }}
        />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Compiling app...</span>
      </div>
    </div>
  );
}
