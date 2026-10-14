/**
 * Self-serve magic link request (claim or password reset).
 */

import { getApiBase } from "./api-base";

export interface AccessRequestResult {
  ok: true;
  mode: "email" | "on_screen" | "server_log";
  message: string;
  claim_link?: string;
  kind?: "claim" | "reset";
  emailed?: boolean;
}

export async function requestAccessMagicLink(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<AccessRequestResult> {
  const res = await fetch(`${getApiBase()}/member-access-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<AccessRequestResult>;
  if (!res.ok) {
    throw new Error(body.error || "Could not request a magic link.");
  }
  return body as AccessRequestResult;
}
