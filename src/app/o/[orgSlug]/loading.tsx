export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="skeleton h-9 w-52 rounded-lg" />
      <div className="rounded-card skeleton h-48" />
    </div>
  );
}
