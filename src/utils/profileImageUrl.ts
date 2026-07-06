/**
 * Client-side profile photo URL rules — kept in sync with
 * server/realdata-store.js sanitizeProfileImageUrl.
 */

const PROFILE_IMAGE_CDN =
  /googleusercontent\.com|licdn\.com|gravatar\.com|githubusercontent\.com|cloudinary\.com|wp\.com|amazonaws\.com|twimg\.com|fbcdn\.net|cdn\.discordapp\.com|images\.unsplash\.com|pbs\.twimg\.com/i;

/** Format check before we probe whether the image actually loads. */
export function isAcceptedProfileImageUrl(url: string): boolean {
  const s = url.trim();
  if (!s || !/^https?:\/\//i.test(s) || /@/.test(s)) return false;
  if (/foresight\.org/i.test(s)) return true;
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s)) return true;
  return PROFILE_IMAGE_CDN.test(s);
}

/** Lenient read for URLs already stored before strict validation. */
export function isLenientProfileImageUrl(url: string): boolean {
  const s = url.trim();
  return Boolean(s && /^https?:\/\//i.test(s) && !/@/.test(s) && s.length <= 500);
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
