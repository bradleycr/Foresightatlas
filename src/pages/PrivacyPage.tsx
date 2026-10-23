/**
 * Privacy & data — plain-language notice for Foresight Atlas.
 * Public route; linked from the account menu, claim/join, and profile.
 */

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import { FORESIGHT_ORG_URL } from "../constants/foresight";
import {
  atlasPrivacyMailto,
  atlasProfileRemovalMailto,
} from "../utils/checkInAuth";

const PAGE_BG =
  "linear-gradient(180deg, #f7f6f3 0%, #ffffff 42%, #f3f1ec 100%)";

/** Bump when the notice changes in a material way. */
const LAST_UPDATED = "23 October 2026";

const CONTROLLER_ADDRESS =
  "50 California Street, Suite 1500, San Francisco, CA 94111";

interface PrivacyPageProps {
  onNavigateHome: () => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[13px] font-semibold text-neutral-900">{title}</h2>
      <div className="mt-1.5 space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPage({ onNavigateHome }: PrivacyPageProps) {
  return (
    <div
      className="flex min-h-[100svh] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 sm:min-h-[100dvh] sm:items-center sm:px-5 sm:py-10"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-lg">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-neutral-600 hover:text-[var(--primary)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>

        <div className="mt-6 mb-6 flex items-center gap-3">
          <a
            href={FORESIGHT_ORG_URL}
            target="_blank"
            rel="noreferrer"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <img
              src={foresightIconUrl}
              alt="Foresight Institute"
              className="size-6"
            />
          </a>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Foresight Atlas
            </p>
            <h1 className="font-heading text-xl font-bold text-[var(--primary)]">
              Privacy &amp; data
            </h1>
          </div>
        </div>

        <div className="space-y-5 rounded-[1.5rem] border border-neutral-200/90 bg-white p-5 text-sm leading-relaxed text-neutral-600 shadow-[0_1px_0_rgba(3,2,19,0.04)] sm:p-7">
          <p>
            By creating an account, you consent to sharing your profile with
            other signed-in members of the Foresight community on this atlas —
            for the community, by the community. Much of what’s here mirrors
            what already appears on{" "}
            <a
              href={FORESIGHT_ORG_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-900 underline underline-offset-2 hover:no-underline"
            >
              foresight.org
            </a>
            . We don’t sell your data, and we don’t share it outside this
            community.
          </p>
          <p className="text-xs text-neutral-500">
            Last updated {LAST_UPDATED}. Controller: Foresight Institute,{" "}
            {CONTROLLER_ADDRESS}. Contact:{" "}
            <a
              href={atlasPrivacyMailto()}
              className="font-medium text-neutral-800 underline underline-offset-2 hover:no-underline"
            >
              bradley@foresight.org
            </a>
            .
          </p>

          <Section title="What we store">
            <p>
              Profile fields you add or edit (name, role, location, bio, photo
              link, contact links, and so on), plus RSVPs, check-ins, travel
              windows, and private connection bookmarks. Passwords are hashed —
              never stored in plain text. Roster email stays off the public map.
            </p>
          </Section>

          <Section title="Who can see it">
            <p>
              Signed-in community members. You can set your profile to Private
              anytime to hide your pin and directory card. Connection bookmarks
              are only yours. Staff who run the atlas can access the roster
              sheet as needed to keep the tool working.
            </p>
          </Section>

          <Section title="Where it lives">
            <p>
              A private Google Sheet and the Atlas app on Vercel. Optional
              access emails (if enabled) may use Resend. Your browser keeps a
              local session until you sign out. Foresight is international; our
              processors may handle data in the US under their GDPR terms.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              Edit or hide your profile, download a copy of your data, or email
              us to delete your row. Same inbox for any other privacy request.
            </p>
          </Section>

          <p className="border-t border-neutral-100 pt-4 text-xs text-neutral-500">
            Questions or deletion:{" "}
            <a
              href={atlasProfileRemovalMailto()}
              className="font-medium text-neutral-800 underline underline-offset-2 hover:no-underline"
            >
              bradley@foresight.org
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
