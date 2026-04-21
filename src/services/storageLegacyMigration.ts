/**
 * Migrates persisted browser state from the old `foresightmap_*` / `foresight_profileImageUrl_*`
 * keys so returning users keep check-ins, identity, and overrides after the repo rename.
 * Safe to run on every load; idempotent when new keys already hold data.
 */
export function migrateLegacyLocalStorageKeys(): void {
  if (typeof window === "undefined") return;

  const simpleMoves: [string, string][] = [
    ["foresightmap_checkins", "foresightatlas_checkins"],
    ["foresightmap_rsvps", "foresightatlas_rsvps"],
    ["foresightmap_identity", "foresightatlas_identity"],
    ["foresightmap_last_signed_in_name", "foresightatlas_last_signed_in_name"],
    ["foresightmap_return_url", "foresightatlas_return_url"],
  ];

  for (const [oldKey, newKey] of simpleMoves) {
    try {
      const v = localStorage.getItem(oldKey);
      if (v == null) continue;
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, v);
      }
      localStorage.removeItem(oldKey);
    } catch {
      /* ignore quota / private mode */
    }
  }

  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (!k.startsWith("foresightmap_connections_")) continue;
      const newK = k.replace(/^foresightmap_connections_/, "foresightatlas_connections_");
      const v = localStorage.getItem(k);
      if (v == null) continue;
      if (localStorage.getItem(newK) == null) {
        localStorage.setItem(newK, v);
      }
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }

  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (!k.startsWith("foresight_profileImageUrl_")) continue;
      const newK = k.replace(/^foresight_profileImageUrl_/, "foresightatlas_profileImageUrl_");
      const v = localStorage.getItem(k);
      if (v == null) continue;
      if (localStorage.getItem(newK) == null) {
        localStorage.setItem(newK, v);
      }
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
