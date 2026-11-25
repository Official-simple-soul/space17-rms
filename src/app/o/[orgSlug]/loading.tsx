export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-9 w-52 rounded bg-neutral-200" />
      <div className="rounded-card h-48 bg-neutral-200" />
    </div>
  );
}
