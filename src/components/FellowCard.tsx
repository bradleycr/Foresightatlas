import { ExternalLink, MapPin, Calendar } from "lucide-react";
import { Person, TravelWindow } from "../types";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

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
            <p className="text-sm text-gray-600">
              {person.roleType} · Cohort {person.fellowshipCohortYear}
            </p>
          </div>
          {person.profileUrl && (
            <a
              href={person.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-teal-500 hover:text-teal-600"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
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