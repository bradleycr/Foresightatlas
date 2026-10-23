/**
 * Self-serve GDPR data export (Art. 20 portability-ish).
 *
 * Builds a JSON package from what the signed-in member can already see in
 * the client: their profile, RSVPs, check-ins, and private connection IDs.
 * Passwords / hashes are never included.
 */

import type { Person, TravelWindow } from "../types";
import { getPersonCheckIns } from "./checkin";
import { getConnectionIds } from "./connections";
import { getPersonRSVPs } from "./rsvp";

export interface MemberDataExport {
  exportedAt: string;
  controller: string;
  notice: string;
  profile: Person;
  travelWindows: TravelWindow[];
  rsvps: ReturnType<typeof getPersonRSVPs>;
  checkIns: ReturnType<typeof getPersonCheckIns>;
  connectionTargetPersonIds: string[];
  browserSessionHints: {
    hasLocalSession: boolean;
    note: string;
  };
}

export function buildMemberDataExport(
  person: Person,
  travelWindows: TravelWindow[] = [],
): MemberDataExport {
  const personId = person.id;
  return {
    exportedAt: new Date().toISOString(),
    controller: "Foresight Institute (Foresight Atlas)",
    notice:
      "This file is a copy of personal data associated with your Atlas account as available to you in the app. Password hashes are never included. Request full deletion via Privacy & data if you also want the sheet row removed.",
    profile: { ...person },
    travelWindows: travelWindows.filter((w) => w.personId === personId),
    rsvps: getPersonRSVPs(personId),
    checkIns: getPersonCheckIns(personId),
    connectionTargetPersonIds: getConnectionIds(personId),
    browserSessionHints: {
      hasLocalSession: true,
      note: "Sign-in session and some offline caches live in this browser’s localStorage until you sign out or clear site data.",
    },
  };
}

/** Trigger a browser download of the member’s data package. */
export function downloadMemberDataExport(
  person: Person,
  travelWindows: TravelWindow[] = [],
): void {
  const payload = buildMemberDataExport(person, travelWindows);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = payload.exportedAt.slice(0, 10);
  const safeName = String(person.fullName || "member")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "member";
  const a = document.createElement("a");
  a.href = url;
  a.download = `foresight-atlas-data-${safeName}-${stamp}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
