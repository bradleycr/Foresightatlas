/**
 * Fellow Card
 *
 * Compact, information-dense card representing a single person.
 * Clicking anywhere opens the full detail modal.
 * Designed to feel modern yet restrained — no visual clutter.
 */

import { MapPin, Calendar, ArrowUpRight } from "lucide-react";
import { Person, TravelWindow } from "../types";
import { Card } from "./ui/card";
import { getRoleGradient } from "../styles/roleColors";
import { getNodeLabel } from "../utils/nodeLabels";
import { getCohortLabel } from "../utils/cohortLabel";

interface FellowCardProps {
  person: Person;
  nextTravel?: TravelWindow;
  onSelect?: () => void;
  isHighlighted?: boolean;
}

export function FellowCard({
  person,
  nextTravel,
  onSelect,
  isHighlighted,
}: FellowCardProps) {
  const projectTagline = person.shortProjectTagline?.trim();
  const projectFallback = person.isAlumni
    ? "Alumni profile — project details forthcoming."
    : "Project details coming soon.";
  const nodeLabel = getNodeLabel(person.primaryNode);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${startDate.toLocaleDateString("en-US", options)} – ${endDate.toLocaleDateString("en-US", options)}`;
  };

  return (
    <Card
      className={`group relative p-0 cursor-pointer transition-all duration-200 border overflow-hidden ${
        isHighlighted
          ? "ring-2 ring-teal-400/60 shadow-lg border-teal-200/80"
          : "border-gray-100/80 hover:border-gray-200 hover:shadow-md"
      }`}
      style={{
        background: isHighlighted
          ? "linear-gradient(145deg, #f0fdfa 0%, #ffffff 100%)"
          : "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      aria-label={`View full profile for ${person.fullName}`}
    >
      <div className="p-4 md:p-5 space-y-3">
        {/* Name + Role line */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className="text-sm md:text-base font-semibold text-gray-900 leading-snug"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {person.fullName}
            </h3>
            <ArrowUpRight className="size-4 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0 mt-0.5" />
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: getRoleGradient(person.roleType),
                color: "#374151",
              }}
            >
              {person.roleType}
            </span>
            <span className="text-xs text-gray-400 font-medium">
              {getCohortLabel(person)}
            </span>
            {person.isAlumni && (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                Alumni
              </span>
            )}
          </div>
        </div>

        {/* Focus Tags */}
        {person.focusTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.focusTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-[10px] font-medium text-gray-500 bg-gray-100/70 px-2 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Project tagline */}
        <p className={`text-xs leading-relaxed line-clamp-2 ${
          projectTagline ? "text-gray-600" : "text-gray-400 italic"
        }`}>
          {projectTagline || projectFallback}
        </p>

        {/* Affiliation */}
        {(person.affiliationOrInstitution ?? "").trim() && (
          <p className="text-[10px] text-gray-400 font-medium">
            {person.affiliationOrInstitution}
          </p>
        )}

        {/* Node */}
        {!person.isAlumni && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="size-3" />
            <span>{nodeLabel}</span>
          </div>
        )}
      </div>

      {/* Next travel — visual footer */}
      {nextTravel && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 md:px-5 py-3">
          <div className="flex items-start gap-2">
            <Calendar className="size-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                {nextTravel.city}, {nextTravel.country}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {formatDateRange(nextTravel.startDate, nextTravel.endDate)}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
