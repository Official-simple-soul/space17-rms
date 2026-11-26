import { useCallback, useEffect, useRef, useState } from "react";
import { useUnsavedWarning } from "./use-unsaved-warning";

const DELAY_MS = 1200;
export type SaveResult =
  { ok: true; version: number } | { ok: false; message: string; stale: boolean };
export type SaveStatus = "saved" | "saving" | "failed" | "stale";

/**
 * Saves content shortly after it changes. Saves run one after another, each from the version the
 * previous one produced, so an older save can never overwrite a newer one.
 */
export function useAutosave<T, R extends SaveResult>({
  content,
  version: initialVersion,
  persist,
  onSaved,
  paused = false,
}: {
  content: T;
  version: number | null;
  persist: (content: T, version: number | null) => Promise<R>;
  onSaved?: (result: Extract<R, { ok: true }>, content: T) => void;
  paused?: boolean;
}) {
  const serialised = JSON.stringify(content);
  const [saved, setSaved] = useState(serialised);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [problem, setProblem] = useState("");
  const dirty = serialised !== saved;
  useUnsavedWarning(dirty);

  const latest = useRef(serialised);
  const stored = useRef(serialised);
  const version = useRef(initialVersion);
  const handlers = useRef({ persist, onSaved });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  useEffect(() => {
    latest.current = serialised;
    handlers.current = { persist, onSaved };
  });

  /** `force` saves even when nothing changed, for a first save or to pick up new questions. */
  const save = useCallback((force = false): Promise<boolean> => {
    queue.current = queue.current
      .catch(() => false)
      .then(async () => {
        const next = latest.current;
        if (!force && next === stored.current) return true;
        setStatus("saving");
        try {
          const value = JSON.parse(next) as T;
          const result = await handlers.current.persist(value, version.current);
          if (!result.ok) {
            setProblem(result.message);
            setStatus(result.stale ? "stale" : "failed");
            return false;
          }
          version.current = result.version;
          stored.current = next;
          setSaved(next);
          setProblem("");
          setStatus("saved");
          handlers.current.onSaved?.(result as Extract<R, { ok: true }>, value);
          return true;
        } catch {
          setProblem("Your changes aren't saved yet. Check your connection.");
          setStatus("failed");
          return false;
        }
      });
    return queue.current;
  }, []);

  useEffect(() => {
    if (!dirty || status === "stale" || paused) return;
    const timer = setTimeout(() => void save(), DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, serialised, status, paused, save]);

  return { save, status, dirty, problem, setProblem, version };
}
