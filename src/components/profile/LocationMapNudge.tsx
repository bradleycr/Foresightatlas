/**
 * Thin map-home reminder when a signed-in member has no city yet.
 */

import { MapPin } from "lucide-react";
import { Button } from "../ui/button";

interface LocationMapNudgeProps {
  onSetLocation: () => void;
  onDismiss: () => void;
}

export function LocationMapNudge({ onSetLocation, onDismiss }: LocationMapNudgeProps) {
  return (
    <div className="border-b border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-sky-600" aria-hidden />
          <p className="text-sm leading-relaxed text-gray-800">
            <span className="font-medium">You&apos;re not on the map yet.</span>{" "}
            Add your city so other fellows can find you.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[40px] px-2 text-sm font-medium text-gray-500 hover:text-gray-800 touch-manipulation"
          >
            Later
          </button>
          <Button size="sm" onClick={onSetLocation} className="min-h-[40px]">
            Set my city
          </Button>
        </div>
      </div>
    </div>
  );
}
