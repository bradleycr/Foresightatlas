/**
 * Base-path-aware routing for static deployment (e.g. GitHub Pages).
 * Vite sets BASE_URL to e.g. "/" or "/foresightatlas/" so we normalize and use it for all history APIs.
 */

const raw = import.meta.env.BASE_URL ?? "/";
const BASE = raw.endsWith("/") ? raw : raw + "/";

/** Full base path with trailing slash (e.g. "/" or "/foresightatlas/") */
export function getBasePath(): string {
  return BASE;
}

/** Current pathname with base stripped and trailing slash removed (e.g. "" or "berlin") */
export function getPathFromLocation(): string {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (!pathname.startsWith(BASE)) return pathname.replace(/^\/+/, "").replace(/\/+$/, "") || "";
  const afterBase = pathname.slice(BASE.length).replace(/^\/+/, "").replace(/\/+$/, "") || "";
  return afterBase;
}

/** Path suitable for route matching: "/" for root, "/segment" for others */
export function getRoutePath(): string {
  const p = getPathFromLocation();
  return p ? `/${p}` : "/";
}

/** Build full URL path for history (base + logical path) */
export function buildFullPath(logicalPath: string): string {
  const clean = logicalPath.replace(/^\/+/, "");
  return clean ? `${BASE}${clean}` : BASE;
}

/** Restore path stored by 404.html so deep links work after redirect. Returns path to set or null. */
export function consumeRedirectPath(): string | null {
  const keys = ["foresightatlas_redirect", "foresightmap_redirect"] as const;
  try {
    for (const key of keys) {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        for (const k of keys) sessionStorage.removeItem(k);
        return stored;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

