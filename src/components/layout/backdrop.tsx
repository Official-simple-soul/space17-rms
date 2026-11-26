/** Soft moving light behind the frosted panels. Decorative only. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob -top-40 -left-32 size-[48rem] [--blob:rgb(232_160_166/0.55)]" />
      <div
        className="aurora-blob top-1/3 -right-40 size-[44rem] [--blob:rgb(242_198_184/0.6)]"
        style={{ animationDelay: "-9s", animationDuration: "32s" }}
      />
      <div
        className="aurora-blob -bottom-48 left-1/4 size-[40rem] [--blob:rgb(201_194_214/0.5)]"
        style={{ animationDelay: "-17s", animationDuration: "38s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(rgb(10_10_10/0.035)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
