/**
 * Local development only. A phone on the same network can't reach the local Supabase address, so
 * files go through the app's own address instead. Hosted files always go directly to storage.
 */
export const LOCAL_STORAGE_PATH = "/local-storage";

export function isLocalSupabase(url: string | undefined) {
  return !!url && ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
}
