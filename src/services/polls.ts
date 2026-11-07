/**
 * Polls API client.
 *
 * Admin calls need a directory session. Voting is anonymous: we send a stable
 * per-device voter key so one phone = one ballot. Directory identity is never
 * attached to a vote.
 */

import { getApiBase } from "./api-base";
import { publishDataChanged } from "./sync";
import type { PollAdmin, PollPublic, PollsAdminPayload } from "../types/polls";

const VOTER_STORAGE_KEY = "foresightatlas_poll_voter";

export function getPollVoterKey(): string {
  try {
    const existing = localStorage.getItem(VOTER_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `voter-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(VOTER_STORAGE_KEY, next);
    return next;
  } catch {
    return `voter-${Date.now()}`;
  }
}

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
}

export async function fetchAdminPolls(token: string): Promise<PollsAdminPayload> {
  const res = await fetch(`${getApiBase()}/polls?admin=1`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not load polls."));
  return res.json() as Promise<PollsAdminPayload>;
}

export async function fetchPublicPoll(
  slug: string,
  token?: string | null,
): Promise<PollPublic> {
  const voterKey = encodeURIComponent(getPollVoterKey());
  const res = await fetch(`${getApiBase()}/polls?slug=${encodeURIComponent(slug)}&voterKey=${voterKey}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "This poll is not available."));
  const body = (await res.json()) as { poll: PollPublic };
  return body.poll;
}

export async function createPoll(
  token: string,
  input: {
    question: string;
    options: string[];
    eventId?: string;
    eventTitle?: string;
  },
): Promise<PollAdmin> {
  const res = await fetch(`${getApiBase()}/polls`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ action: "create", ...input }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not create poll."));
  const body = (await res.json()) as { poll: PollAdmin };
  publishDataChanged("polls");
  return body.poll;
}

export async function updatePoll(
  token: string,
  input: {
    slug: string;
    question?: string;
    options?: string[];
    /** Append one project while draft or live (stable option ids). */
    addOption?: string | { label: string; people?: string; url?: string };
    /** Drop one project while the poll is still a draft. */
    removeOptionId?: string;
    eventId?: string;
    eventTitle?: string;
    status?: "draft" | "live" | "closed";
    /** When going live, close every other live poll first. */
    closeOtherLive?: boolean;
    /** Drop the slate and return the poll to a draft. Old ballots no longer match. */
    reset?: boolean;
    /** Start a 60 second clock. Voting closes when it hits zero. */
    finalMinute?: boolean;
  },
): Promise<PollAdmin> {
  const res = await fetch(`${getApiBase()}/polls`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ action: "update", ...input }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not update poll."));
  const body = (await res.json()) as { poll: PollAdmin };
  publishDataChanged("polls");
  return body.poll;
}

export async function voteOnPoll(
  slug: string,
  optionId: string,
  secondOptionId: string,
  token?: string | null,
): Promise<PollPublic> {
  const res = await fetch(`${getApiBase()}/polls`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      action: "vote",
      slug,
      optionId,
      secondOptionId,
      voterKey: getPollVoterKey(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not record your vote."));
  const body = (await res.json()) as { poll: PollPublic };
  publishDataChanged("polls");
  return body.poll;
}

/** A pitcher adds their own project while submissions are open. */
export async function addProjectToPoll(
  slug: string,
  input: { label: string; people: string; url?: string },
): Promise<PollPublic> {
  const res = await fetch(`${getApiBase()}/polls`, {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({
      action: "addProject",
      slug,
      ...input,
      voterKey: getPollVoterKey(),
    }),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not add that project."));
  const body = (await res.json()) as { poll: PollPublic };
  publishDataChanged("polls");
  return body.poll;
}
