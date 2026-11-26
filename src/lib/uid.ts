/** A random id for the browser. `crypto.randomUUID` is missing on plain http addresses. */
export function uid() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
