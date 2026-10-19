/**
 * Focus neighbors — people who share focus areas with a given profile.
 *
 * Ranking prefers more shared tags, then same node, then same city.
 * Used on person profiles as gentle "you might know" suggestions.
 */

import type { Person } from "../types";
import { getPresetFocusTags } from "../data/focusAreas";

export interface FocusNeighbor {
  person: Person;
  sharedTags: string[];
  score: number;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Shared focus labels (prefer original casing from the viewed person). */
function sharedFocusTags(viewerTags: string[], candidateTags: string[]): string[] {
  if (!viewerTags.length || !candidateTags.length) return [];
  const candidateSet = new Set(candidateTags.map(normalizeTag));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of viewerTags) {
    const key = normalizeTag(tag);
    if (!key || seen.has(key) || !candidateSet.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function scoreNeighbor(
  viewer: Person,
  candidate: Person,
  shared: string[],
): number {
  let score = shared.length * 10;
  // Prefer preset overlaps slightly so custom one-offs don't dominate.
  const presetOverlap = getPresetFocusTags(shared).length;
  score += presetOverlap * 2;
  if (
    viewer.primaryNode &&
    viewer.primaryNode !== "Alumni" &&
    viewer.primaryNode === candidate.primaryNode
  ) {
    score += 3;
  }
  if (
    viewer.currentCity &&
    candidate.currentCity &&
    viewer.currentCity.trim().toLowerCase() ===
      candidate.currentCity.trim().toLowerCase()
  ) {
    score += 2;
  }
  return score;
}

/**
 * Rank directory members who share at least one focus tag with `viewer`.
 * Excludes self. Caps at `limit` (default 6).
 */
export function findFocusNeighbors(
  viewer: Person,
  directory: Person[],
  limit = 6,
): FocusNeighbor[] {
  const viewerTags = (viewer.focusTags ?? []).filter(Boolean);
  if (!viewerTags.length || !directory.length) return [];

  const ranked: FocusNeighbor[] = [];
  for (const candidate of directory) {
    if (!candidate?.id || candidate.id === viewer.id) continue;
    const shared = sharedFocusTags(viewerTags, candidate.focusTags ?? []);
    if (shared.length === 0) continue;
    ranked.push({
      person: candidate,
      sharedTags: shared,
      score: scoreNeighbor(viewer, candidate, shared),
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.person.fullName.localeCompare(b.person.fullName);
  });

  return ranked.slice(0, limit);
}
