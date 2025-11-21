import { useState, useMemo } from "react";
import { Person, TravelWindow, Granularity } from "../types";
import { Badge } from "./ui/badge";
import { ExternalLink, X } from "lucide-react";

interface TimelineViewProps {
  filteredPeople: Person[];
  filteredTravelWindows: TravelWindow[];
  year: number;
  granularity: Granularity;
  onViewOnMap?: (personId: string, travelWindowId: string) => void;
}

export function TimelineView({
  filteredPeople,
  filteredTravelWindows,
  year,
  granularity,
  onViewOnMap,
}: TimelineViewProps) {
  const [selectedTravel, setSelectedTravel] = useState<{
    person: Person;
    travel: TravelWindow;
  } | null>(null);

  // Calculate time axis
  const timeAxis = useMemo(() => {
    if (granularity === "Year") {
      // Show 12 months
      return Array.from({ length: 12 }, (_, i) => {
        const date = new Date(year, i, 1);
        return {
          label: date.toLocaleDateString("en-US", { month: "short" }),
          date,
          value: i,
        };
      });
    } else if (granularity === "Month") {
      // Show weeks of current month
      const weeksInMonth = 4;
      return Array.from({ length: weeksInMonth }, (_, i) => ({
        label: `Wk ${i + 1}`,
        date: new Date(year, new Date().getMonth(), i * 7 + 1),
        value: i,
      }));
    } else {
      // Week view - show 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - date.getDay() + i);
        return {
          label: date.toLocaleDateString("en-US", { weekday: "short" }),
          date,
          value: i,
        };
      });
    }
  }, [year, granularity]);

  // Calculate bar positions
  const calculateBarPosition = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (granularity === "Year") {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const totalDays = 365;

      const startOffset = Math.max(
        0,
        (start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      const endOffset = Math.min(
        totalDays,
        (end.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        left: (startOffset / totalDays) * 100,
        width: ((endOffset - startOffset) / totalDays) * 100,
      };
    } else {
      // Simplified for month and week
      const yearStart = new Date(year, 0, 1);
      const totalDays = 365;
      const startOffset = (start.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

      return {
        left: (startOffset / totalDays) * 100,
        width: (duration / totalDays) * 100,
      };
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Timeline Grid */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        {/* Timeline Header */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex">
            <div className="w-64 p-4 border-r border-gray-200">
              <h3 className="text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>Fellow / Grantee</h3>
            </div>
            <div className="flex-1 overflow-x-auto">
              <div className="flex min-w-[800px]">
                {timeAxis.map((tick) => (
                  <div
                    key={tick.value}
                    className="flex-1 p-4 text-center border-r border-gray-200 last:border-r-0"
                  >
                    <span className="text-sm text-gray-700">{tick.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Rows */}
        <div className="flex-1 overflow-y-auto">
          {filteredPeople.map((person) => {
            const personTravels = filteredTravelWindows.filter(
              (tw) => tw.personId === person.id
            );

            return (
              <div key={person.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                {/* Person Info */}
                <div className="w-64 p-4 border-r border-gray-200">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-gray-900">{person.fullName}</p>
                        <p className="text-xs text-gray-600">
                          {person.roleType} · {person.fellowshipCohortYear}
                        </p>
                      </div>
                      {person.profileUrl && (
                        <a
                          href={person.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-500 hover:text-teal-600"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {person.focusTags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline Bars */}
                <div className="flex-1 relative min-h-[80px]">
                  <div className="absolute inset-0 flex">
                    {timeAxis.map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 border-r border-gray-100 last:border-r-0"
                      />
                    ))}
                  </div>

                  {/* Travel Windows */}
                  {personTravels.map((travel, idx) => {
                    const position = calculateBarPosition(
                      travel.startDate,
                      travel.endDate
                    );

                    // Only show if within view
                    if (position.width <= 0 || position.left >= 100) return null;

                    // Cycle through pastel gradients
                    const gradients = [
                      'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)', // Purple
                      'linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)', // Pink
                      'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)', // Blue
                      'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)', // Green
                      'linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)', // Yellow
                      'linear-gradient(135deg, #a5f3fc 0%, #67e8f9 100%)', // Cyan
                    ];
                    const gradient = gradients[idx % gradients.length];

                    return (
                      <div
                        key={travel.id}
                        className="absolute top-1/2 transform -translate-y-1/2 h-8 cursor-pointer group z-10"
                        style={{
                          left: `${Math.max(0, position.left)}%`,
                          width: `${Math.min(100 - position.left, position.width)}%`,
                        }}
                        onClick={() => setSelectedTravel({ person, travel })}
                      >
                        <div 
                          className="h-full rounded px-2 flex items-center shadow-sm transition-all group-hover:shadow-md border border-white/50"
                          style={{
                            background: gradient,
                          }}
                        >
                          <span className="text-xs text-gray-700 truncate font-medium">
                            {travel.city}
                          </span>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs p-3 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                          <p className="font-medium">{travel.title}</p>
                          <p className="text-gray-300 mt-1">
                            {travel.city}, {travel.country}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            {formatDateRange(travel.startDate, travel.endDate)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredPeople.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              No fellows match the current filters
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      {selectedTravel && (
        <div className="w-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h3 className="text-gray-900">{selectedTravel.person.fullName}</h3>
              <p className="text-sm text-gray-600">
                {selectedTravel.person.roleType} · Cohort{" "}
                {selectedTravel.person.fellowshipCohortYear}
              </p>
            </div>
            <button
              onClick={() => setSelectedTravel(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Focus Tags */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Focus Areas</p>
              <div className="flex flex-wrap gap-1">
                {selectedTravel.person.focusTags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Project */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Project</p>
              <p className="text-sm text-gray-900">
                {selectedTravel.person.shortProjectTagline}
              </p>
            </div>

            {/* Travel Details */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-gray-900 mb-3">Travel Details</h4>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-600">Title</dt>
                  <dd className="text-gray-900">{selectedTravel.travel.title}</dd>
                </div>
                <div>
                  <dt className="text-gray-600">Location</dt>
                  <dd className="text-gray-900">
                    {selectedTravel.travel.city}, {selectedTravel.travel.country}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Dates</dt>
                  <dd className="text-gray-900">
                    {formatDateRange(
                      selectedTravel.travel.startDate,
                      selectedTravel.travel.endDate
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600">Type</dt>
                  <dd className="text-gray-900">{selectedTravel.travel.type}</dd>
                </div>
                {selectedTravel.travel.notes && (
                  <div>
                    <dt className="text-gray-600">Notes</dt>
                    <dd className="text-gray-900">{selectedTravel.travel.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-gray-200">
              {selectedTravel.person.profileUrl && (
                <a
                  href={selectedTravel.person.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                >
                  <ExternalLink className="size-4" />
                  View full profile
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}