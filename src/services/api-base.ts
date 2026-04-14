/**
 * Base URL for `/api/*` requests.
 *
 * - Default: same origin as the SPA, respecting Vite `BASE_URL` (subpath deploys).
 * - Override: `VITE_API_ORIGIN` = absolute origin only, e.g. `https://api.partner.com`
 *   → requests go to `https://api.partner.com/api/...`. The partner API must allow CORS
 *   from the static site's origin if it differs. See `src/INTEGRATION.md`.
 */
export function getApiBase(): string {
  const originOverride = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (originOverride) {
    const o = originOverride.replace(/\/$/, "");
    return `${o}/api`;
  }
  const base = import.meta.env.BASE_URL ?? "/";
  const baseNorm = base.endsWith("/") ? base.slice(0, -1) : base;
  return baseNorm ? `${baseNorm}/api` : "/api";
}
