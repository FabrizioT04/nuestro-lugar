export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-blush-50 ${className}`} aria-hidden />;
}
