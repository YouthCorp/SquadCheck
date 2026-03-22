export default function WatchlistLoading() {
  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="h-7 w-40 bg-muted rounded animate-pulse mb-6" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
