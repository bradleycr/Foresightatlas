import React from "react";
import { MapPin, Calendar, UserCircle, Ticket } from "lucide-react";
import { Person, TravelWindow } from "../types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { cn } from "./ui/utils";
import { getRolePillClass } from "../styles/roleColors";
import { getNodeLabel } from "../utils/nodeLabels";
import { getCohortLabel, effectiveIsAlumni } from "../utils/cohortLabel";

/** Compact event reference for "Attending" line on the card. */
export interface AttendingEvent {
  id: string;
  title: string;
  startAt: string;
}

interface FellowCardProps {
  person: Person;
  nextTravel?: TravelWindow;
  /** Events this person is attending (going RSVPs) — shown on the card. */
  attendingEvents?: AttendingEvent[];
  /** Called when the profile icon is clicked — opens the full details modal. */
  onSelect?: () => void;
  /** Optional: when card body is clicked (not "More details"), highlight + scroll only; if not set, card click uses onSelect. */
  onHighlight?: () => void;
  isHighlighted?: boolean;
}

export function FellowCard({
  person,
  nextTravel,
  attendingEvents,
  onSelect,
  onHighlight,
  isHighlighted,
}: FellowCardProps) {
  const handleCardClick = () => (onHighlight ?? onSelect)?.();
  const projectSummary =
    person.shortProjectTagline?.trim() ||
    person.expandedProjectDescription?.trim() ||
    person.affiliationOrInstitution?.trim() ||
    "";
  const nodeLabel = getNodeLabel(person.primaryNode);
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  };

  return (
    <Card
      className={`p-4 cursor-pointer transition-all hover:shadow-lg border ${
        isHighlighted ? "ring-2 ring-teal-500 shadow-lg border-teal-200 bg-app-card-highlight" : "border-gray-100 bg-app-card"
      }`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={onHighlight ? `Select ${person.fullName}` : `View full profile for ${person.fullName}`}
    >
      <div className="space-y-3">
        {/* Header: name/role left, profile action top-right */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-gray-900 font-heading">{person.fullName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                className={cn("text-xs px-3 py-1.5 rounded-full font-medium", getRolePillClass(person.roleType))}
              >
                {person.roleType}
              </span>
              {effectiveIsAlumni(person) && (
                <Badge variant="alumni" className="text-xs">
                  Alumni
                </Badge>
              )}
              <span className="text-sm text-gray-600">
                Cohort {getCohortLabel(person)}
              </span>
            </div>
          </div>
          {onSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="flex-shrink-0 rounded-full p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors touch-manipulation min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
              aria-label={`View full profile for ${person.fullName}`}
            >
              <UserCircle className="size-6 sm:size-5" aria-hidden />
            </button>
          )}
        </div>

        {/* Focus Tags — only when present */}
        {person.focusTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.focusTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Project summary — show only real data we actually have, never placeholders */}
        {projectSummary && (
          <p className="text-sm text-gray-700">
            {projectSummary}
          </p>
        )}

        {/* Affiliation */}
        {(person.affiliationOrInstitution ?? "").trim() && (
          <p className="text-xs text-gray-500">
            {person.affiliationOrInstitution}
          </p>
        )}

        {/* Location and/or Node — one line when we have city/country and/or program node */}
        {(person.currentCity?.trim() ||
          person.currentCountry?.trim() ||
          (!effectiveIsAlumni(person) && nodeLabel)) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="size-4 flex-shrink-0" />
            <span>
              {[
                [person.currentCity?.trim(), person.currentCountry?.trim()]
                  .filter(Boolean)
                  .join(", "),
                !effectiveIsAlumni(person) && nodeLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}

        {/* Next Travel */}
        {nextTravel && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-start gap-2 text-sm">
              <Calendar className="size-4 text-teal-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-900">
                  {nextTravel.city}, {nextTravel.country}
                </p>
                <p className="text-xs text-gray-600">
                  {formatDateRange(nextTravel.startDate, nextTravel.endDate)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Attending — Vision Weekends, workshops, node events */}
        {attendingEvents && attendingEvents.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-start gap-2 text-sm">
              <Ticket className="size-4 text-teal-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-1">Attending</p>
                <p className="text-gray-700">
                  {attendingEvents.length <= 2
                    ? attendingEvents.map((e) => e.title).join(", ")
                    : `${attendingEvents.slice(0, 2).map((e) => e.title).join(", ")} +${attendingEvents.length - 2} more`}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}