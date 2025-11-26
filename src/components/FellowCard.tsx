import { ExternalLink, MapPin, Calendar, Info } from "lucide-react";
import { Person, TravelWindow } from "../types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { getRoleGradient } from "../styles/roleColors";

interface FellowCardProps {
  person: Person;
  nextTravel?: TravelWindow;
  onSelect?: () => void;
  onViewDetails?: () => void;
  isHighlighted?: boolean;
}

export function FellowCard({
  person,
  nextTravel,
  onSelect,
  onViewDetails,
  isHighlighted,
}: FellowCardProps) {
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
        isHighlighted ? "ring-2 ring-teal-500 shadow-lg border-teal-200" : "border-gray-100"
      }`}
      style={{
        background: isHighlighted 
          ? 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)'
          : 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)'
      }}
      onClick={onSelect}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{person.fullName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: getRoleGradient(person.roleType),
                  color: "#374151",
                }}
              >
                {person.roleType}
              </span>
              <span className="text-sm text-gray-600">
                Cohort {person.fellowshipCohortYear}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onViewDetails?.();
            }}
            className="text-teal-500 hover:text-teal-600 transition-colors flex-shrink-0 p-1 rounded hover:bg-teal-50 relative z-50"
            title="View full details"
            aria-label="View full details"
          >
            <Info className="size-4" />
          </button>
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
        <p className="text-sm text-gray-700">{person.shortProjectTagline}</p>

        {/* Node */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="size-4" />
          <span>{person.primaryNode}</span>
        </div>

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
      </div>
    </Card>
  );
}