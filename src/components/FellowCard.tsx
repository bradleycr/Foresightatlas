import React from "react";
import { MapPin, Calendar, ChevronRight } from "lucide-react";
import { Person, TravelWindow } from "../types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { cn } from "./ui/utils";
import { getRolePillClass } from "../styles/roleColors";
import { getNodeLabel } from "../utils/nodeLabels";
import { getCohortLabel } from "../utils/cohortLabel";

interface FellowCardProps {
  person: Person;
  nextTravel?: TravelWindow;
  /** Called when "More details" is clicked — opens the full details modal. */
  onSelect?: () => void;
  /** Optional: when card body is clicked (not "More details"), highlight + scroll only; if not set, card click uses onSelect. */
  onHighlight?: () => void;
  isHighlighted?: boolean;
}

export function FellowCard({
  person,
  nextTravel,
  onSelect,
  onHighlight,
  isHighlighted,
}: FellowCardProps) {
  const handleCardClick = () => (onHighlight ?? onSelect)?.();
  const projectTagline = person.shortProjectTagline?.trim();
  const projectFallback = person.isAlumni
    ? "Alumni profile — project details forthcoming."
    : "Project details coming soon.";
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
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-gray-900 font-heading">{person.fullName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                className={cn("text-xs px-3 py-1.5 rounded-full font-medium", getRolePillClass(person.roleType))}
              >
                {person.roleType}
              </span>
              {person.isAlumni && (
                <Badge variant="secondary" className="text-xs">
                  Alumni
                </Badge>
              )}
              <span className="text-sm text-gray-600">
                Cohort {getCohortLabel(person)}
              </span>
            </div>
          </div>
        </div>

        {/* Focus Tags */}
        <div className="flex flex-wrap gap-1">
          {person.focusTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Project Tagline */}
        <p className={`text-sm ${projectTagline ? "text-gray-700" : "text-gray-500 italic"}`}>
          {projectTagline || projectFallback}
        </p>

        {/* Affiliation */}
        {(person.affiliationOrInstitution ?? "").trim() && (
          <p className="text-xs text-gray-500">
            {person.affiliationOrInstitution}
          </p>
        )}

        {/* Node — only for current (alumni are not part of a node) */}
        {!person.isAlumni && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="size-4" />
            <span>{nodeLabel}</span>
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

        {/* More details — clear call-to-action */}
        <div className="pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-md px-2 py-1 -ml-1 transition-colors"
            aria-label={`More details about ${person.fullName}`}
          >
            More details
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </Card>
  );
}