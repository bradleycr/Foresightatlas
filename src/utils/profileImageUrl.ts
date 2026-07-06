/**
 * Client-side profile photo URL rules — kept in sync with
 * server/realdata-store.js sanitizeProfileImageUrl.
 */

/** Format check before we probe whether the image actually loads. */
export function isAcceptedProfileImageUrl(url: string): boolean {
  const s = url.trim();
  if (!s || !/^https?:\/\//i.test(s) || /@/.test(s)) return false;
  return (
    /foresight\.org/i.test(s) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)
  );
}

/** Probe whether a URL renders as an image in the browser. */
export function probeProfileImageUrl(
  url: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    const img = new Image();
    const finish = (ok: boolean) => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };

    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.referrerPolicy = "no-referrer";
    img.src = url;

    signal?.addEventListener("abort", () => finish(false), { once: true });
  });
}
