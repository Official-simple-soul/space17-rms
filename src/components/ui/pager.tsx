import Link from "next/link";
import { buttonStyles } from "./button";
import type { ServerPaging } from "./data-view";

/** Previous and next links for simple server-rendered lists. */
export function Pager({ paging, href }: { paging: ServerPaging; href: (page: number) => string }) {
  const pages = Math.ceil(paging.total / paging.pageSize);
  if (pages <= 1) return null;
  const link = (page: number, label: string) =>
    page >= 1 && page <= pages ? (
      <Link href={href(page)} className={buttonStyles({ variant: "outline", size: "sm" })}>
        {label}
      </Link>
    ) : (
      <span />
    );
  return (
    <nav
      aria-label="Pages"
      className="border-line flex items-center justify-between gap-3 border-t px-5 py-3 text-sm"
    >
      {link(paging.page - 1, "Previous")}
      <span className="text-muted">
        Page {paging.page} of {pages}
      </span>
      {link(paging.page + 1, "Next")}
    </nav>
  );
}
