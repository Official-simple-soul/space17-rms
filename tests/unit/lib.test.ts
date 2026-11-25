import { describe, expect, it } from "vitest";
import { failure } from "@/lib/action-state";
import { formatMoney, slugify } from "@/lib/format";
import { safePath } from "@/lib/safe-redirect";

describe("safePath", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\t/evil.test",
    "/.//evil.test",
    "javascript:alert(1)",
    undefined,
  ])("rejects %s", (v) => expect(safePath(v)).toBe("/"));
  it("keeps internal paths", () => expect(safePath("/o/acme?tab=1")).toBe("/o/acme?tab=1"));
});

describe("format", () => {
  it("formats kobo as naira", () =>
    expect(formatMoney(1250000).replace(/\s/g, "")).toBe("₦12,500.00"));
  it("builds valid slugs", () => expect(slugify("  Àcme & Sons Ltd. ")).toBe("acme-sons-ltd"));
});

describe("failure", () => {
  it("hides unknown errors", () =>
    expect(failure({ message: "secret detail" }).message).not.toContain("secret"));
});
