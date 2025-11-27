import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Person, TravelWindow, Granularity, PrimaryNode, TimelineViewMode } from "../types";
import { Badge } from "./ui/badge";
import { ExternalLink, X, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { getRoleGradient } from "../styles/roleColors";
import { useIsMobile } from "./ui/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Z_INDEX_TIMELINE_BAR, Z_INDEX_TIMELINE_TOOLTIP, Z_INDEX_TIMELINE_HEADER } from "../constants/zIndex";

interface TimelineViewProps {
  filteredPeople: Person[];
  filteredTravelWindows: TravelWindow[];
  year: number | null; // null means "All time"
  granularity: Granularity;
  referenceDate: string;
  cities: string[]; // Selected cities filter
  nodes: PrimaryNode[]; // Selected nodes filter
  timelineViewMode: TimelineViewMode; // "person" or "location"
  onViewOnMap?: (personId: string, travelWindowId: string) => void;
  onViewPersonDetails?: (personId: string) => void;
  onSwitchToMap?: () => void; // Callback to switch to map view
}

interface PersonRow {
  person: Person;
  travelWindows: TravelWindow[];
}

// Represents a time period at a location (either travel or default)
interface LocationPeriod {
  startDate: Date;
  endDate: Date;
  city: string;
  country: string;
  isDefaultLocation: boolean; // true if this is their home base/current location, false if it's a travel window
  travelWindow?: TravelWindow; // Only present if isDefaultLocation is false
}

interface LocationRow {
  locationName: string;
  locationType: 'city' | 'node';
  people: Array<{
    person: Person;
    travelWindow: TravelWindow | null;
    isCurrentLocation: boolean;
  }>;
}

export function TimelineView({
  filteredPeople,
  filteredTravelWindows,
  year,
  granularity,
  referenceDate,
  cities,
  nodes,
  timelineViewMode,
  onViewOnMap,
  onViewPersonDetails,
  onSwitchToMap,
}: TimelineViewProps) {
  const isMobile = useIsMobile();
  const [selectedTravel, setSelectedTravel] = useState<{
    person: Person;
    travel: TravelWindow;
  } | null>(null);

  // Tooltip state for person view
  const [personTooltip, setPersonTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: { personName: string; city: string; country: string; dateRange: string };
  } | null>(null);
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // Show mobile warning when timeline view is accessed on mobile
  // Respect user's preference to not show again
  useEffect(() => {
    if (isMobile) {
      const dontShowAgain = localStorage.getItem('timeline-mobile-warning-dismissed');
      if (!dontShowAgain) {
        setShowMobileWarning(true);
      }
    }
  }, [isMobile]);

  // Calendar grid structure for Month and Week views
  interface CalendarCell {
    date: Date;
    dayOfMonth: number;
    isCurrentMonth: boolean;
    columnIndex: number; // 0-6 (Sunday-Saturday)
    rowIndex: number; // Week row index
    value: number; // Unique identifier
  }

  // Calculate visible range and time axis
  const { rangeStart, rangeEnd, timeAxis, calendarGrid } = useMemo(() => {
    if (granularity === "Year") {
      // Handle "All time" - show a wide range covering all travel windows
      if (year === null) {
        // Find the earliest and latest dates from all travel windows
        const allDates = filteredTravelWindows.flatMap(tw => [
          new Date(tw.startDate),
          new Date(tw.endDate)
        ]);
        
        if (allDates.length === 0) {
          // Fallback to current year if no travel windows
          const currentYear = new Date().getFullYear();
          const start = new Date(currentYear, 0, 1, 0, 0, 0, 0);
          const end = new Date(currentYear, 11, 31, 23, 59, 59, 999);
          const axis = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(currentYear, i, 1, 0, 0, 0, 0);
            return {
              label: date.toLocaleDateString("en-US", { month: "short" }),
              date,
              value: i,
            };
          });
          return { rangeStart: start, rangeEnd: end, timeAxis: axis, calendarGrid: null };
        }
        
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        const startYear = minDate.getFullYear();
        const endYear = maxDate.getFullYear();
        const yearSpan = endYear - startYear + 1;
        
        // Create axis with one entry per year
        const axis = Array.from({ length: yearSpan }, (_, i) => {
          const yr = startYear + i;
          return {
            label: yr.toString(),
            date: new Date(yr, 0, 1, 0, 0, 0, 0),
            value: i,
          };
        });
        
        return {
          rangeStart: new Date(startYear, 0, 1, 0, 0, 0, 0),
          rangeEnd: new Date(endYear, 11, 31, 23, 59, 59, 999),
          timeAxis: axis,
          calendarGrid: null,
        };
      }
      
      // Normal year view - start at beginning of year, end at end of last day
      const start = new Date(year, 0, 1, 0, 0, 0, 0);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      const axis = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(year, i, 1, 0, 0, 0, 0);
        return {
          label: date.toLocaleDateString("en-US", { month: "short" }),
          date,
          value: i,
        };
      });
      return { rangeStart: start, rangeEnd: end, timeAxis: axis, calendarGrid: null };
    }

    const ref = new Date(referenceDate);

    if (granularity === "Month") {
      const month = ref.getMonth();
      const yr = ref.getFullYear();
      // Start at beginning of first day of the month
      const firstDayOfMonth = new Date(yr, month, 1, 0, 0, 0, 0);
      // End at end of last day of month (23:59:59.999)
      const lastDay = new Date(yr, month + 1, 0);
      const end = new Date(yr, month, lastDay.getDate(), 23, 59, 59, 999);
      
      // Calculate the first Sunday of the calendar view (may be before month start)
      const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 6 = Saturday
      const calendarStart = new Date(firstDayOfMonth);
      calendarStart.setDate(calendarStart.getDate() - firstDayOfWeek);
      
      // Calculate how many weeks we need (usually 4-6 weeks)
      const daysInMonth = lastDay.getDate();
      const totalDaysToShow = firstDayOfWeek + daysInMonth;
      const weeksNeeded = Math.ceil(totalDaysToShow / 7);
      
      // Create calendar grid: 7 columns (Sun-Sat), multiple rows
      const grid: CalendarCell[] = [];
      let cellValue = 0;
      
      for (let week = 0; week < weeksNeeded; week++) {
        for (let day = 0; day < 7; day++) {
          const cellDate = new Date(calendarStart);
          cellDate.setDate(calendarStart.getDate() + (week * 7) + day);
          const isCurrentMonth = cellDate.getMonth() === month && cellDate.getFullYear() === yr;
          
          grid.push({
            date: new Date(cellDate),
            dayOfMonth: cellDate.getDate(),
            isCurrentMonth,
            columnIndex: day, // 0 = Sunday, 6 = Saturday
            rowIndex: week,
            value: cellValue++,
          });
        }
      }
      
      // Create axis for backward compatibility (one entry per day in month)
      const axis = Array.from({ length: daysInMonth }, (_, i) => {
        const date = new Date(yr, month, i + 1, 0, 0, 0, 0);
        return {
          label: date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
          date,
          value: i,
        };
      });
      
      return { 
        rangeStart: firstDayOfMonth, 
        rangeEnd: end, 
        timeAxis: axis, 
        calendarGrid: { cells: grid, weeks: weeksNeeded, columns: 7 }
      };
    }

    // Week view - show 7 days (Sunday to Saturday) in a single row
    const base = new Date(referenceDate);
    // Normalize to start of day
    base.setHours(0, 0, 0, 0);
    const start = new Date(base);
    start.setDate(base.getDate() - base.getDay()); // Start on Sunday
    
    // End at end of last day of week (Saturday, 23:59:59.999)
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // Create calendar grid: 7 columns (Sun-Sat), single row
    const grid: CalendarCell[] = [];
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(start);
      cellDate.setDate(start.getDate() + day);
      grid.push({
        date: new Date(cellDate),
        dayOfMonth: cellDate.getDate(),
        isCurrentMonth: true,
        columnIndex: day, // 0 = Sunday, 6 = Saturday
        rowIndex: 0,
        value: day,
      });
    }

    // Create axis for backward compatibility
    const axis = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      date.setHours(0, 0, 0, 0);
      return {
        label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        date,
        value: i,
      };
    });

    return { 
      rangeStart: start, 
      rangeEnd: end, 
      timeAxis: axis, 
      calendarGrid: { cells: grid, weeks: 1, columns: 7 }
    };
  }, [year, granularity, referenceDate, filteredTravelWindows]);

  // Filter travel windows by the visible date range for month/week views
  const travelWindowsInRange = useMemo(() => {
    if (granularity === "Year") {
      // For year view, use all filtered travel windows
      return filteredTravelWindows;
    }
    
    // For month/week views, filter by the actual date range
    return filteredTravelWindows.filter((tw) => {
      const twStart = new Date(tw.startDate);
      twStart.setHours(0, 0, 0, 0);
      const twEnd = new Date(tw.endDate);
      twEnd.setHours(23, 59, 59, 999);
      
      // Check if travel window overlaps with the visible range
      return twStart <= rangeEnd && twEnd >= rangeStart;
    });
  }, [filteredTravelWindows, granularity, rangeStart, rangeEnd]);

  // Calculate bar positions within the visible range
  // For calendar grid views (Month/Week), returns grid cell positions
  // For other views, returns percentage positions
  const calculateBarPosition = (startDate: string, endDate: string) => {
    // Normalize dates to start of day for consistent calculations
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    // End date should include the full day, so set to end of day
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Clamp to visible range
    const clampedStart = start < rangeStart ? rangeStart : start;
    const clampedEnd = end > rangeEnd ? rangeEnd : end;

    // For calendar grid views, calculate which cells the bar spans
    if (calendarGrid && (granularity === "Month" || granularity === "Week")) {
      const startCell = calendarGrid.cells.find(cell => {
        const cellStart = new Date(cell.date);
        cellStart.setHours(0, 0, 0, 0);
        const cellEnd = new Date(cell.date);
        cellEnd.setHours(23, 59, 59, 999);
        return clampedStart >= cellStart && clampedStart <= cellEnd;
      });
      
      const endCell = calendarGrid.cells.find(cell => {
        const cellStart = new Date(cell.date);
        cellStart.setHours(0, 0, 0, 0);
        const cellEnd = new Date(cell.date);
        cellEnd.setHours(23, 59, 59, 999);
        return clampedEnd >= cellStart && clampedEnd <= cellEnd;
      });

      if (startCell && endCell) {
        // Calculate position based on grid cells
        const startCol = startCell.columnIndex;
        const endCol = endCell.columnIndex;
        const startRow = startCell.rowIndex;
        const endRow = endCell.rowIndex;
        
        // For single row (week view) or same row spans
        if (startRow === endRow) {
          const left = (startCol / 7) * 100;
          const width = ((endCol - startCol + 1) / 7) * 100;
          return {
            left: Math.max(0, Math.min(100, left)),
            width: Math.max(0, Math.min(100 - left, width)),
            startCell,
            endCell,
            isGridLayout: true,
          };
        } else {
          // Multi-row span (for month view bars that span weeks)
          // Position at start column, full width of that column
          const left = (startCol / 7) * 100;
          const width = (1 / 7) * 100;
          return {
            left: Math.max(0, Math.min(100, left)),
            width: Math.max(0, Math.min(100 - left, width)),
            startCell,
            endCell,
            isGridLayout: true,
            spansMultipleRows: true,
          };
        }
      }
    }

    // Fallback to percentage-based positioning for non-grid views
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    if (totalMs <= 0) {
      return { left: 0, width: 0, isGridLayout: false };
    }

    // Calculate offsets in milliseconds
    const startOffset = clampedStart.getTime() - rangeStart.getTime();
    const endOffset = clampedEnd.getTime() - rangeStart.getTime();

    // Convert to percentages
    const left = (startOffset / totalMs) * 100;
    const width = ((endOffset - startOffset) / totalMs) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: Math.max(0, Math.min(100 - left, width)),
      isGridLayout: false,
    };
  };

  // Group locations based on filters - for location view
  const locationRows = useMemo((): LocationRow[] => {
    const locationMap = new Map<string, LocationRow>();

    // Priority: cities filter > nodes filter > all cities
    if (cities.length > 0) {
      // Show selected cities
      cities.forEach((city) => {
        if (!locationMap.has(city)) {
          locationMap.set(city, {
            locationName: city,
            locationType: 'city',
            people: [],
          });
        }
      });

      // Add people with travel windows in these cities
      travelWindowsInRange.forEach((tw) => {
        if (cities.includes(tw.city)) {
          const person = filteredPeople.find((p) => p.id === tw.personId);
          if (person) {
            const location = locationMap.get(tw.city);
            if (location) {
              location.people.push({
                person,
                travelWindow: tw,
                isCurrentLocation: false,
              });
            }
          }
        }
      });
    } else if (nodes.length > 0) {
      // Show selected nodes
      nodes.forEach((node) => {
        if (!locationMap.has(node)) {
          locationMap.set(node, {
            locationName: node,
            locationType: 'node',
            people: [],
          });
        }
      });

      // Add people whose primaryNode matches
      filteredPeople.forEach((person) => {
        if (nodes.includes(person.primaryNode)) {
          const location = locationMap.get(person.primaryNode);
          if (location) {
            // Add current location
            location.people.push({
              person,
              travelWindow: null,
              isCurrentLocation: true,
            });

            // Add travel windows for this person in the time range
            filteredTravelWindows
              .filter((tw) => tw.personId === person.id)
              .forEach((tw) => {
                location.people.push({
                  person,
                  travelWindow: tw,
                  isCurrentLocation: false,
                });
              });
          }
        }
      });
    } else {
      // Show all unique cities from travel windows
      const citySet = new Set<string>();
      travelWindowsInRange.forEach((tw) => {
        citySet.add(tw.city);
      });

      citySet.forEach((city) => {
        locationMap.set(city, {
          locationName: city,
          locationType: 'city',
          people: [],
        });
      });

      // Add people with travel windows
      travelWindowsInRange.forEach((tw) => {
        const person = filteredPeople.find((p) => p.id === tw.personId);
        if (person) {
          const location = locationMap.get(tw.city);
          if (location) {
            location.people.push({
              person,
              travelWindow: tw,
              isCurrentLocation: false,
            });
          }
        }
      });
    }

    // Sort locations alphabetically and filter out empty ones
    // If cities are explicitly selected, always show them (even if empty)
    // If nodes are explicitly selected, show them if they have people
    // Otherwise, only show cities that have travel windows
    return Array.from(locationMap.values())
      .filter((loc) => {
        if (cities.length > 0 && loc.locationType === 'city' && cities.includes(loc.locationName)) {
          // Always show explicitly selected cities, even if they have no travel windows
          return true;
        }
        if (loc.locationType === 'node') {
          // For nodes, show if there are any people (including those with just current location)
          return loc.people.length > 0;
        } else {
          // For cities (when not explicitly selected), only show if there are travel windows
          return loc.people.some((p) => p.travelWindow !== null);
        }
      })
      .sort((a, b) => a.locationName.localeCompare(b.locationName));
  }, [cities, nodes, filteredPeople, travelWindowsInRange]);

  // Generate location periods for a person, filling gaps with default location
  const generateLocationPeriods = (
    person: Person,
    travelWindows: TravelWindow[],
    rangeStart: Date,
    rangeEnd: Date
  ): LocationPeriod[] => {
    const periods: LocationPeriod[] = [];
    const defaultCity = person.currentCity || person.homeBaseCity;
    const defaultCountry = person.currentCountry || person.homeBaseCountry;

    // Sort travel windows by start date
    const sortedTravelWindows = [...travelWindows].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    let currentDate = new Date(rangeStart);

    // Process each travel window and fill gaps with default location
    for (const tw of sortedTravelWindows) {
      const twStart = new Date(tw.startDate);
      const twEnd = new Date(tw.endDate);
      twEnd.setHours(23, 59, 59, 999);

      // Only consider travel windows that overlap with the visible range
      if (twEnd < rangeStart || twStart > rangeEnd) {
        continue;
      }

      // Add default location period before this travel window (if there's a gap)
      if (currentDate < twStart) {
        const defaultEnd = new Date(twStart);
        defaultEnd.setDate(defaultEnd.getDate() - 1);
        defaultEnd.setHours(23, 59, 59, 999);
        
        if (defaultEnd >= currentDate) {
          periods.push({
            startDate: new Date(currentDate),
            endDate: defaultEnd,
            city: defaultCity,
            country: defaultCountry,
            isDefaultLocation: true,
          });
        }
        currentDate = new Date(twEnd);
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      }

      // Add the travel window period
      const clampedTwStart = twStart < rangeStart ? rangeStart : twStart;
      const clampedTwEnd = twEnd > rangeEnd ? rangeEnd : twEnd;
      
      periods.push({
        startDate: clampedTwStart,
        endDate: clampedTwEnd,
        city: tw.city,
        country: tw.country,
        isDefaultLocation: false,
        travelWindow: tw,
      });

      // Update currentDate to after this travel window
      currentDate = new Date(twEnd);
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    // Fill remaining time with default location
    if (currentDate <= rangeEnd) {
      periods.push({
        startDate: new Date(currentDate),
        endDate: new Date(rangeEnd),
        city: defaultCity,
        country: defaultCountry,
        isDefaultLocation: true,
      });
    }

    // If no travel windows at all, show default location for entire range
    if (sortedTravelWindows.length === 0) {
      periods.push({
        startDate: new Date(rangeStart),
        endDate: new Date(rangeEnd),
        city: defaultCity,
        country: defaultCountry,
        isDefaultLocation: true,
      });
    }

    return periods;
  };

  // Group people with their travel windows - simple person-based rows
  const personRows = useMemo((): PersonRow[] => {
    // Create a map of person ID to their travel windows
    const personMap = new Map<string, PersonRow>();

    // Initialize with all filtered people
    filteredPeople.forEach((person) => {
      const personTravelWindows = travelWindowsInRange.filter(tw => tw.personId === person.id);
      personMap.set(person.id, {
        person,
        travelWindows: personTravelWindows,
      });
    });

    // Return all filtered people (they should always appear, showing default location if no travel)
    return Array.from(personMap.values())
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
  }, [filteredPeople, travelWindowsInRange]);

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

  // Mobile-friendly date formatting
  const formatDateRangeMobile = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // If same month, show "Nov 22-28"
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${endDate.toLocaleDateString("en-US", { day: "numeric" })}`;
    }
    
    // If same year, show "Nov 22 - Dec 5"
    if (startDate.getFullYear() === endDate.getFullYear()) {
      return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    
    // Otherwise show full range
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}`;
  };

  // Helper to calculate overlapping bars and stack them
  const calculateBarStack = (bars: Array<{ 
    person: Person; 
    travel?: TravelWindow; 
    period?: LocationPeriod;
    isDefaultLocation?: boolean;
    position: { left: number; width: number } 
  }>) => {
    if (bars.length === 0) return [];
    
    // Sort bars by start position
    const sortedBars = [...bars].sort((a, b) => a.position.left - b.position.left);
    
    // Track which stack level each bar should be on
    const barStacks: Array<{ 
      person: Person; 
      travel?: TravelWindow; 
      period?: LocationPeriod;
      isDefaultLocation?: boolean;
      position: { left: number; width: number }; 
      stackIndex: number 
    }> = [];
    const activeStacks: Array<number> = []; // Track when each stack level becomes free
    
    sortedBars.forEach((bar) => {
      const barEnd = bar.position.left + bar.position.width;
      
      // Find the first stack level that's free (no overlap)
      let stackIndex = 0;
      for (let i = 0; i < activeStacks.length; i++) {
        if (bar.position.left >= activeStacks[i]) {
          stackIndex = i;
          break;
        }
        stackIndex = i + 1;
      }
      
      // Update the active stack end time
      activeStacks[stackIndex] = barEnd;
      
      barStacks.push({
        ...bar,
        stackIndex,
      });
    });

    return barStacks;
  };

  // Render location-based row (for location view mode)
  const renderLocationRow = (
    location: LocationRow,
    isMobileView: boolean
  ) => {
    const bars = location.people
      .filter((p) => p.travelWindow !== null)
      .map((p) => {
        const position = calculateBarPosition(
          p.travelWindow!.startDate,
          p.travelWindow!.endDate
        );
        return {
          person: p.person,
          travel: p.travelWindow!,
          position,
        };
      })
      .filter((b) => b.position.width > 0 && b.position.left < 100);

    const stackedBars = calculateBarStack(bars);
    const maxStackHeight = stackedBars.length > 0 ? Math.max(...stackedBars.map((b) => b.stackIndex), 0) + 1 : 1;
    const rowHeight = isMobileView 
      ? Math.max(60, maxStackHeight * 48)
      : Math.max(80, maxStackHeight * 50);

    const leftColumnWidth = isMobileView ? "w-32 sm:w-40" : "w-64";
    const barHeight = isMobileView ? "38px" : "40px";
    const stackOffset = isMobileView ? 45 : 50;
    const topOffset = isMobileView ? 5 : 10;

    return (
      <div key={`${location.locationType}-${location.locationName}`} className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors relative">
        {/* Location Info - Sticky left column */}
        <div className={`${leftColumnWidth} ${isMobileView ? "p-2 sm:p-3" : "p-4"} border-r-2 border-gray-200 flex-shrink-0 bg-white ${!isMobileView ? "sticky left-0 z-20 shadow-sm" : ""}`}>
          <div className={isMobileView ? "space-y-0.5" : "space-y-1"}>
            <p className={`${isMobileView ? "text-xs sm:text-sm" : "text-sm"} font-medium text-gray-900 ${isMobileView ? "truncate leading-tight" : ""}`} title={location.locationName}>
              {location.locationName}
            </p>
            <p className={`${isMobileView ? "text-[10px]" : "text-xs"} text-gray-500`}>
              {location.locationType === 'city' ? 'City' : 'Node'} · {location.people.filter(p => p.travelWindow !== null).length}
            </p>
          </div>
        </div>

        {/* Timeline Bars - Calendar Grid Layout */}
        {calendarGrid && (granularity === "Month" || granularity === "Week") ? (
          <div className="flex-1 relative w-full" style={{ minHeight: `${rowHeight}px` }}>
            {/* Calendar Grid with proper sizing for scrolling */}
            <div 
              className="grid w-full h-full"
              style={{ 
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridTemplateRows: granularity === "Month" 
                  ? `repeat(${calendarGrid.weeks}, minmax(80px, auto))`
                  : 'minmax(80px, auto)'
              }}
            >
              {calendarGrid.cells.map((cell) => {
                // Find bars that should appear in this cell based on date range
                const cellBars = stackedBars.filter(bar => {
                  if (!bar.travel) return false;
                  
                  // Get the actual date range for this travel window
                  const barStart = new Date(bar.travel.startDate);
                  barStart.setHours(0, 0, 0, 0);
                  const barEnd = new Date(bar.travel.endDate);
                  barEnd.setHours(23, 59, 59, 999);
                  
                  // Get the cell's date range
                  const cellStart = new Date(cell.date);
                  cellStart.setHours(0, 0, 0, 0);
                  const cellEnd = new Date(cell.date);
                  cellEnd.setHours(23, 59, 59, 999);
                  
                  // Check if the cell's date falls within the bar's date range
                  return cellStart <= barEnd && cellEnd >= barStart;
                });

                return (
                  <div
                    key={cell.value}
                    className={`relative border-r border-b border-gray-200 ${
                      !cell.isCurrentMonth && granularity === "Month" ? 'bg-gray-50' : 'bg-white'
                    }`}
                    style={{
                      gridColumn: cell.columnIndex + 1,
                      gridRow: cell.rowIndex + 1
                    }}
                  >
                    {/* Date number */}
                    <div className={`absolute top-1 left-1 ${isMobileView ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500`}>
                      {cell.dayOfMonth}
                    </div>
                    
                    {/* Bars in this cell */}
                    <div className={`pt-5 pb-1 px-0.5 space-y-0.5 h-full`}>
                      {cellBars.map((bar, idx) => {
                        if (!bar.travel) return null;
                        
                        const barKey = bar.travel.id;
                        
                        // Check if this is the first cell by comparing dates
                        const barStart = new Date(bar.travel.startDate);
                        barStart.setHours(0, 0, 0, 0);
                        const cellStart = new Date(cell.date);
                        cellStart.setHours(0, 0, 0, 0);
                        const isFirstCell = cellStart.getTime() === barStart.getTime();
                        
                        // For location view, show person name; for person view, show city
                        const barLabel = timelineViewMode === "location"
                          ? bar.person.fullName
                          : bar.travel.city;
                        
                        return (
                          <div
                            key={barKey}
                            onClick={() => setSelectedTravel({ person: bar.person, travel: bar.travel! })}
                            className={`relative ${isMobileView ? 'h-5' : 'h-6'} rounded px-1 flex items-center shadow-sm transition-all border border-white/50 ${isMobileView ? 'text-[9px]' : 'text-xs'} truncate cursor-pointer group hover:shadow-md`}
                            style={{
                              background: getRoleGradient(bar.person.roleType),
                              zIndex: 10,
                            }}
                            title={barLabel}
                            onMouseMove={(e) => {
                              const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                              if (tooltip) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                tooltip.style.top = `${rect.top}px`;
                              }
                            }}
                          >
                            {(isFirstCell || cellBars.length === 1) && (
                              <span className={`${isMobileView ? 'text-[9px]' : 'text-[10px]'} text-gray-700 font-medium truncate`}>
                                {barLabel}
                              </span>
                            )}
                            {/* Custom tooltip for better visibility - using fixed positioning to escape overflow */}
                            <div 
                              data-tooltip
                              className="fixed w-64 bg-gray-900 text-white text-xs p-3 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                              style={{ 
                                zIndex: 99999,
                                transform: 'translate(-50%, calc(-100% - 8px))',
                              }}
                            >
                              <p className="font-medium">{bar.person.fullName}</p>
                              <p className="text-gray-300 mt-1">
                                {bar.travel.city}, {bar.travel.country}
                              </p>
                              <p className="text-gray-400 mt-1 text-[10px]">
                                {formatDateRange(bar.travel.startDate, bar.travel.endDate)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`flex-1 relative ${isMobileView ? "overflow-x-auto" : ""}`} style={{ minHeight: `${rowHeight}px` }}>
            {/* Grid lines */}
            <div className={`absolute inset-0 flex ${isMobileView ? "min-w-max" : "w-full"}`}>
              {timeAxis.map((_, i) => (
                <div
                  key={i}
                  className={`${isMobileView ? "w-20 sm:w-24 flex-shrink-0" : "flex-1 min-w-0"} border-r border-gray-200 last:border-r-0`}
                />
              ))}
            </div>

            {/* People Bars */}
            {stackedBars.map((bar) => {
              // In location view, travel is always present (filtered above)
              if (!bar.travel) return null;
              
              const stackTop = stackOffset * bar.stackIndex + topOffset;
              
              return isMobileView ? (
                <button
                  key={bar.travel.id}
                  onClick={() => setSelectedTravel({ person: bar.person, travel: bar.travel! })}
                  className="absolute cursor-pointer group min-w-[50px] touch-manipulation"
                  style={{
                    left: `${Math.max(0, bar.position.left)}%`,
                    width: `${Math.min(100 - bar.position.left, bar.position.width)}%`,
                    top: `${stackTop}px`,
                    height: barHeight,
                  }}
                >
                  <div 
                    className="h-full rounded px-1.5 sm:px-2 flex items-center shadow-sm transition-all active:shadow-md border border-white/50"
                    style={{
                      background: getRoleGradient(bar.person.roleType),
                    }}
                  >
                    <span className="text-[9px] sm:text-[10px] text-gray-700 truncate font-medium whitespace-nowrap leading-tight">
                      {bar.person.fullName}
                    </span>
                  </div>
                </button>
              ) : (
                <div
                  key={bar.travel.id}
                  className="absolute cursor-pointer group"
                  style={{
                    left: `${Math.max(0, bar.position.left)}%`,
                    width: `${Math.min(100 - bar.position.left, bar.position.width)}%`,
                    top: `${stackTop}px`,
                    height: barHeight,
                  }}
                  onClick={() => setSelectedTravel({ person: bar.person, travel: bar.travel! })}
                  onMouseMove={(e) => {
                    const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                    if (tooltip) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      tooltip.style.left = `${rect.left + rect.width / 2}px`;
                      tooltip.style.top = `${rect.top}px`;
                    }
                  }}
                >
                  <div 
                    className="h-full rounded px-3 flex items-center shadow-sm transition-all group-hover:shadow-md border border-white/50"
                    style={{
                      background: getRoleGradient(bar.person.roleType),
                    }}
                  >
                    <span className="text-xs text-gray-700 truncate font-medium">
                      {bar.person.fullName}
                    </span>
                  </div>

                  {/* Tooltip */}
                  <div 
                    data-tooltip
                    className="fixed w-64 bg-gray-900 text-white text-xs p-3 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                    style={{ 
                      zIndex: 99999,
                      transform: 'translate(-50%, calc(-100% - 8px))',
                    }}
                  >
                    <p className="font-medium">{bar.person.fullName}</p>
                    <p className="text-gray-300 mt-1">
                      {bar.travel.city}, {bar.travel.country}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {formatDateRange(bar.travel.startDate, bar.travel.endDate)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Mobile Layout - Gantt Chart optimized for mobile
  if (isMobile) {
    return (
      <>
        {/* Mobile Warning Dialog */}
        <Dialog open={showMobileWarning} onOpenChange={setShowMobileWarning}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Timeline View Best on Desktop
              </DialogTitle>
              <DialogDescription className="pt-3 text-base leading-relaxed">
                The timeline view is optimized for larger screens like computers and tablets. For the best experience on your phone, we recommend using the map view instead, or visiting us on a computer for the full timeline experience.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-6">
              {onSwitchToMap && (
                <Button
                  onClick={() => {
                    setShowMobileWarning(false);
                    onSwitchToMap();
                  }}
                  className="w-full"
                  variant="default"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                  }}
                >
                  <MapPin className="size-4 mr-2" />
                  Switch to Map View
                </Button>
              )}
              <Button
                onClick={() => {
                  setShowMobileWarning(false);
                }}
                className="w-full"
                variant="outline"
              >
                Continue to Timeline Anyway
              </Button>
              <Button
                onClick={() => {
                  localStorage.setItem('timeline-mobile-warning-dismissed', 'true');
                  setShowMobileWarning(false);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
                variant="ghost"
              >
                Don't Show This Again
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col h-full">
        {/* Mobile Timeline Grid */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* Sticky Timeline Header - Calendar Grid Layout for Month/Week */}
          <div className="border-b-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white sticky top-0 shadow-sm"
            style={{ zIndex: 1 }}
          >
            {calendarGrid && (granularity === "Month" || granularity === "Week") ? (
              <>
                {/* Day of week headers (Sun-Sat) - Beautiful horizontal row */}
                <div className="flex border-b border-gray-200">
                  <div className="w-32 sm:w-40 p-2 sm:p-3 border-r-2 border-gray-300 flex-shrink-0 bg-white flex items-center">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                      {timelineViewMode === "person" ? "Person" : "Location"}
                    </h3>
                  </div>
                  <div className="flex-1 bg-gradient-to-b from-gray-50 to-white min-w-0">
                    <div className="flex w-full">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                        <div
                          key={day}
                          className="flex-1 p-2 sm:p-3 text-center bg-white border-r border-gray-200 last:border-r-0 flex items-center justify-center min-w-0"
                        >
                          <span className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide truncate">{day}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Date headers for Month view (multiple rows) - Calendar grid */}
                {granularity === "Month" && (
                  <div className="flex" style={{ zIndex: 0 }}>
                    <div className="w-32 sm:w-40 border-r-2 border-gray-300 flex-shrink-0 bg-white"></div>
                  <div className="flex-1 bg-white overflow-visible">
                    <div 
                      className="grid w-full"
                      style={{ 
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gridTemplateRows: `repeat(${calendarGrid.weeks}, minmax(60px, auto))`
                      }}
                    >
                        {calendarGrid.cells.map((cell) => (
                          <div
                            key={cell.value}
                            className={`p-1 sm:p-2 text-center border-r border-b border-gray-200 bg-white flex items-center justify-center ${
                              !cell.isCurrentMonth ? 'bg-gray-50' : ''
                            }`}
                            style={{
                              gridColumn: cell.columnIndex + 1,
                              gridRow: cell.rowIndex + 1,
                              zIndex: 0
                            }}
                          >
                            <span className={`text-xs sm:text-sm font-medium ${cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                              {cell.dayOfMonth}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex">
                {/* Column Header */}
                <div className="w-32 sm:w-40 p-2 sm:p-3 border-r-2 border-gray-300 flex-shrink-0 bg-white">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                    {timelineViewMode === "person" ? "Person" : "Location"}
                  </h3>
                </div>
                {/* Scrollable Timeline Axis - More prominent */}
                <div className="flex-1 overflow-x-auto bg-gray-50">
                  <div className="flex min-w-max">
                    {timeAxis.map((tick) => (
                      <div
                        key={tick.value}
                        className="w-20 sm:w-24 p-2 sm:p-3 text-center border-r border-gray-300 last:border-r-0 flex-shrink-0 bg-white"
                      >
                        <span className="text-xs font-semibold text-gray-900 block whitespace-nowrap">{tick.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timeline Rows */}
          <div className="flex-1 timeline-scrollable overflow-y-auto">
            {timelineViewMode === "person" ? (
              <>
                {/* Person-based rows */}
                {personRows.map((personRow) => {
                  // Generate location periods (travel windows + default location periods)
                  const locationPeriods = generateLocationPeriods(
                    personRow.person,
                    personRow.travelWindows,
                    rangeStart,
                    rangeEnd
                  );

                  // Get all bars for this person with their positions
                  const bars = locationPeriods
                    .map((period) => {
                      const position = calculateBarPosition(
                        period.startDate.toISOString(),
                        period.endDate.toISOString()
                      );
                      return {
                        person: personRow.person,
                        travel: period.travelWindow,
                        period,
                        position,
                        isDefaultLocation: period.isDefaultLocation,
                      };
                    })
                    .filter((b) => b.position.width > 0 && b.position.left < 100);

                  // Calculate stacking for overlapping bars
                  const stackedBars = calculateBarStack(bars);
                  const maxStackHeight = stackedBars.length > 0 ? Math.max(...stackedBars.map((b) => b.stackIndex), 0) + 1 : 1;
                  const rowHeight = Math.max(60, maxStackHeight * 48); // Minimum 60px, 48px per stack level on mobile

                  return (
                    <div key={personRow.person.id} className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      {/* Person Info */}
                      <div className="w-32 sm:w-40 p-2 sm:p-3 border-r-2 border-gray-200 flex-shrink-0 bg-white">
                        <div className="space-y-0.5">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate leading-tight" title={personRow.person.fullName}>
                            {personRow.person.fullName}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {personRow.person.roleType} · {personRow.travelWindows.length} {personRow.travelWindows.length === 1 ? 'trip' : 'trips'}
                          </p>
                        </div>
                      </div>

                      {/* Timeline Bars - Calendar Grid Layout */}
                      {calendarGrid && (granularity === "Month" || granularity === "Week") ? (
                        <div className="flex-1 relative w-full" style={{ minHeight: `${rowHeight}px` }}>
                          {/* Calendar Grid with proper sizing for scrolling */}
                          <div 
                            className="grid w-full h-full"
                            style={{ 
                              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                              gridTemplateRows: granularity === "Month" 
                                ? `repeat(${calendarGrid.weeks}, minmax(80px, auto))`
                                : 'minmax(80px, auto)'
                            }}
                          >
                            {calendarGrid.cells.map((cell) => {
                              // Find bars that should appear in this cell based on date range
                              const cellBars = stackedBars.filter(bar => {
                                if (!bar.period) return false;
                                
                                // Get the actual date range for this period
                                const barStart = new Date(bar.period.startDate);
                                barStart.setHours(0, 0, 0, 0);
                                const barEnd = new Date(bar.period.endDate);
                                barEnd.setHours(23, 59, 59, 999);
                                
                                // Get the cell's date range
                                const cellStart = new Date(cell.date);
                                cellStart.setHours(0, 0, 0, 0);
                                const cellEnd = new Date(cell.date);
                                cellEnd.setHours(23, 59, 59, 999);
                                
                                // Check if the cell's date falls within the bar's date range
                                return cellStart <= barEnd && cellEnd >= barStart;
                              });

                              return (
                                <div
                                  key={cell.value}
                                  className={`relative border-r border-b border-gray-200 ${
                                    !cell.isCurrentMonth && granularity === "Month" ? 'bg-gray-50' : 'bg-white'
                                  }`}
                                  style={{
                                    gridColumn: cell.columnIndex + 1,
                                    gridRow: cell.rowIndex + 1
                                  }}
                                >
                                  {/* Date number */}
                                  <div className="absolute top-1 left-1 text-[10px] font-medium text-gray-500">
                                    {cell.dayOfMonth}
                                  </div>
                                  
                                  {/* Bars in this cell */}
                                  <div className="pt-5 pb-1 px-0.5 space-y-0.5 h-full">
                                    {cellBars.map((bar, idx) => {
                                      if (!bar.period) return null;
                                      
                                      const barKey = bar.travel ? bar.travel.id : `${bar.person.id}-${bar.period.city}-default`;
                                      
                                      // Check if this is the first cell by comparing dates
                                      const barStart = new Date(bar.period.startDate);
                                      barStart.setHours(0, 0, 0, 0);
                                      const cellStart = new Date(cell.date);
                                      cellStart.setHours(0, 0, 0, 0);
                                      const isFirstCell = cellStart.getTime() === barStart.getTime();
                                      
                                      // Determine label based on view mode
                                      const barLabel = timelineViewMode === "person" 
                                        ? bar.period.city 
                                        : bar.person.fullName;
                                      
                                      return (
                                        <div
                                          key={barKey}
                                          onClick={() => {
                                            if (bar.travel) {
                                              setSelectedTravel({ person: bar.person, travel: bar.travel });
                                            }
                                          }}
                                          className={`h-5 rounded px-1 flex items-center shadow-sm transition-all border border-white/50 text-[9px] truncate ${
                                            bar.travel ? "cursor-pointer group active:shadow-md" : "cursor-default opacity-60"
                                          }`}
                                          style={{
                                            background: bar.isDefaultLocation 
                                              ? `linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)`
                                              : getRoleGradient(bar.person.roleType),
                                          }}
                                          title={barLabel}
                                        >
                                          {(isFirstCell || cellBars.length === 1) && (
                                            <span className="text-[9px] text-gray-700 font-medium truncate">
                                              {barLabel}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 relative overflow-x-auto" style={{ minHeight: `${rowHeight}px` }}>
                          {/* Grid lines - More visible */}
                          <div className="absolute inset-0 flex min-w-max">
                            {timeAxis.map((_, i) => (
                              <div
                                key={i}
                                className="w-20 sm:w-24 border-r border-gray-200 last:border-r-0 flex-shrink-0"
                              />
                            ))}
                          </div>

                          {/* Location Period Bars */}
                          {stackedBars.map((bar) => {
                            // In person-based rows, period is always present
                            if (!bar.period) return null;
                            
                            const stackOffset = bar.stackIndex * 45; // 45px per stack level on mobile
                            const barKey = bar.travel ? bar.travel.id : `${bar.person.id}-${bar.period.city}-default`;
                            const gradientStyle = bar.isDefaultLocation 
                              ? `linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)`
                              : getRoleGradient(bar.person.roleType);
                            
                            return (
                              <button
                                key={barKey}
                                onClick={() => {
                                  if (bar.travel) {
                                    setSelectedTravel({ person: bar.person, travel: bar.travel });
                                  }
                                }}
                                disabled={!bar.travel}
                                className={`absolute min-w-[50px] touch-manipulation ${
                                  bar.travel ? "cursor-pointer group" : "cursor-default opacity-60"
                                }`}
                                style={{
                                  left: `${Math.max(0, bar.position.left)}%`,
                                  width: `${Math.min(100 - bar.position.left, bar.position.width)}%`,
                                  top: `${stackOffset + 5}px`,
                                  height: '38px',
                                  zIndex: Z_INDEX_TIMELINE_BAR,
                                }}
                              >
                                <div 
                                  className={`h-full rounded px-1.5 sm:px-2 flex items-center shadow-sm transition-all border border-white/50 ${
                                    bar.travel ? "active:shadow-md" : ""
                                  }`}
                                  style={{
                                    background: gradientStyle,
                                  }}
                                >
                                  <span className="text-[9px] sm:text-[10px] text-gray-700 truncate font-medium whitespace-nowrap leading-tight">
                                    {bar.period.city}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {personRows.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    <p className="text-sm sm:text-base">No people match the current filters</p>
                  </div>
                )}
              </>
            ) : (
              // Location-based rows
              locationRows.map((location) => renderLocationRow(location, true))
            )}
            {timelineViewMode === "location" && locationRows.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <p className="text-sm sm:text-base">No locations match the current filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Travel Details Sheet */}
        <Sheet open={!!selectedTravel} onOpenChange={(open) => !open && setSelectedTravel(null)}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            {selectedTravel && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">
                    {selectedTravel.person.fullName}
                  </SheetTitle>
                  <p className="text-sm text-gray-600 text-left">
                    {selectedTravel.person.roleType} · Cohort{" "}
                    {selectedTravel.person.fellowshipCohortYear}
                  </p>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Focus Tags */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Focus Areas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTravel.person.focusTags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Project */}
                  {selectedTravel.person.shortProjectTagline && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Project</p>
                      <p className="text-sm text-gray-900">
                        {selectedTravel.person.shortProjectTagline}
                      </p>
                    </div>
                  )}

                  {/* Travel Details */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Travel Details</h4>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-600 mb-1">Title</dt>
                        <dd className="text-sm text-gray-900">{selectedTravel.travel.title}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-600 mb-1">Location</dt>
                        <dd className="text-sm text-gray-900">
                          {selectedTravel.travel.city}, {selectedTravel.travel.country}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-600 mb-1">Dates</dt>
                        <dd className="text-sm text-gray-900">
                          {formatDateRange(
                            selectedTravel.travel.startDate,
                            selectedTravel.travel.endDate
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-600 mb-1">Type</dt>
                        <dd className="text-sm text-gray-900">{selectedTravel.travel.type}</dd>
                      </div>
                      {selectedTravel.travel.notes && (
                        <div>
                          <dt className="text-sm font-medium text-gray-600 mb-1">Notes</dt>
                          <dd className="text-sm text-gray-900">{selectedTravel.travel.notes}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    {onViewOnMap && (
                      <Button
                        onClick={() => {
                          onViewOnMap(selectedTravel.person.id, selectedTravel.travel.id);
                          setSelectedTravel(null);
                        }}
                        className="w-full"
                        variant="outline"
                      >
                        <MapPin className="size-4 mr-2" />
                        View on Map
                      </Button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onViewPersonDetails?.(selectedTravel.person.id);
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full text-sm text-teal-600 hover:text-teal-700 py-2 px-4 border border-teal-200 rounded-md hover:bg-teal-50 transition-colors relative z-50"
                    >
                      <ExternalLink className="size-4" />
                      View full profile
                    </button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
      </>
    );
  }

  // Desktop Layout - Person-based Gantt chart
  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 min-w-0 overflow-hidden">
      {/* Timeline Grid */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
        {/* Timeline Header - Calendar Grid Layout for Month/Week */}
        <div className="border-b-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white shadow-sm" style={{ zIndex: 1 }}>
          {calendarGrid && (granularity === "Month" || granularity === "Week") ? (
            <>
              {/* Day of week headers (Sun-Sat) - Beautiful horizontal row */}
              <div className="flex border-b border-gray-200">
                <div className="w-64 p-4 border-r-2 border-gray-300 bg-white flex items-center sticky left-0 z-30 shadow-sm">
                  <h3 className="text-gray-900 font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
                    {timelineViewMode === "person" ? "Person" : "Location"}
                  </h3>
                </div>
                <div className="flex-1 bg-gradient-to-b from-gray-50 to-white min-w-0">
                  <div className="flex w-full">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div
                        key={day}
                        className="flex-1 p-3 sm:p-4 text-center bg-white border-r border-gray-200 last:border-r-0 flex items-center justify-center min-w-0"
                      >
                        <span className="text-sm sm:text-base font-bold text-gray-900 uppercase tracking-wide truncate">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Date headers for Month view (multiple rows) - Calendar grid */}
              {granularity === "Month" && (
                <div className="flex" style={{ zIndex: 0 }}>
                  <div className="w-64 border-r-2 border-gray-300 bg-white sticky left-0 z-20"></div>
                  <div className="flex-1 bg-white overflow-visible">
                    <div 
                      className="grid w-full"
                      style={{ 
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        gridTemplateRows: `repeat(${calendarGrid.weeks}, minmax(80px, auto))`
                      }}
                    >
                      {calendarGrid.cells.map((cell) => (
                        <div
                          key={cell.value}
                          className={`p-2 text-center border-r border-b border-gray-200 bg-white flex items-center justify-center ${
                            !cell.isCurrentMonth ? 'bg-gray-50' : ''
                          }`}
                          style={{
                            gridColumn: cell.columnIndex + 1,
                            gridRow: cell.rowIndex + 1,
                            zIndex: 0
                          }}
                        >
                          <span className={`text-sm font-medium ${cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                            {cell.dayOfMonth}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex">
              <div className="w-64 p-4 border-r-2 border-gray-300 bg-white sticky left-0 z-30 shadow-sm">
                <h3 className="text-gray-900 font-semibold uppercase tracking-wide text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
                  {timelineViewMode === "person" ? "Person" : "Location"}
                </h3>
              </div>
              <div className="flex-1 bg-gray-50">
                <div className="flex w-full">
                  {timeAxis.map((tick) => (
                    <div
                      key={tick.value}
                      className="flex-1 p-3 text-center border-r border-gray-300 last:border-r-0 bg-white min-w-0"
                    >
                      <span className="text-base font-semibold text-gray-900 block whitespace-nowrap truncate">
                        {tick.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Rows - Scrollable container for full month visibility */}
        <div className={`flex-1 timeline-scrollable overflow-y-auto ${calendarGrid && (granularity === "Month" || granularity === "Week") ? "" : "overflow-x-auto"}`}>
          {timelineViewMode === "person" ? (
            <>
              {/* Person-based rows */}
              {personRows.map((personRow) => {
                // Generate location periods (travel windows + default location periods)
                const locationPeriods = generateLocationPeriods(
                  personRow.person,
                  personRow.travelWindows,
                  rangeStart,
                  rangeEnd
                );

                // Get all bars for this person with their positions
                const bars = locationPeriods
                  .map((period) => {
                    const position = calculateBarPosition(
                      period.startDate.toISOString(),
                      period.endDate.toISOString()
                    );
                    return {
                      person: personRow.person,
                      travel: period.travelWindow,
                      period,
                      position,
                      isDefaultLocation: period.isDefaultLocation,
                    };
                  })
                  .filter((b) => b.position.width > 0 && b.position.left < 100);

                // Calculate stacking for overlapping bars
                const stackedBars = calculateBarStack(bars);
                const maxStackHeight = stackedBars.length > 0 ? Math.max(...stackedBars.map((b) => b.stackIndex), 0) + 1 : 1;
                const rowHeight = Math.max(80, maxStackHeight * 50); // Minimum 80px, 50px per stack level

                return (
                  <div key={personRow.person.id} className="flex border-b border-gray-200 hover:bg-gray-50 transition-colors relative">
                    {/* Person Info - Sticky left column */}
                    <div className="w-64 p-4 border-r-2 border-gray-200 bg-white flex-shrink-0 sticky left-0 z-20 shadow-sm">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{personRow.person.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {personRow.person.roleType} · {personRow.travelWindows.length} {personRow.travelWindows.length === 1 ? 'trip' : 'trips'}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Bars - Calendar Grid Layout */}
                    {calendarGrid && (granularity === "Month" || granularity === "Week") ? (
                      <div className="flex-1 relative w-full" style={{ minHeight: `${rowHeight}px` }}>
                        {/* Calendar Grid with proper sizing for scrolling */}
                        <div 
                          className="grid w-full h-full"
                          style={{ 
                            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                            gridTemplateRows: granularity === "Month" 
                              ? `repeat(${calendarGrid.weeks}, minmax(100px, auto))`
                              : 'minmax(100px, auto)'
                          }}
                        >
                          {calendarGrid.cells.map((cell) => {
                            // Find bars that should appear in this cell based on date range
                            const cellBars = stackedBars.filter(bar => {
                              if (!bar.period) return false;
                              
                              // Get the actual date range for this bar
                              const barStart = new Date(bar.period.startDate);
                              barStart.setHours(0, 0, 0, 0);
                              const barEnd = new Date(bar.period.endDate);
                              barEnd.setHours(23, 59, 59, 999);
                              
                              // Get the cell's date range
                              const cellStart = new Date(cell.date);
                              cellStart.setHours(0, 0, 0, 0);
                              const cellEnd = new Date(cell.date);
                              cellEnd.setHours(23, 59, 59, 999);
                              
                              // Check if the cell's date falls within the bar's date range
                              return cellStart <= barEnd && cellEnd >= barStart;
                            });

                            return (
                              <div
                                key={cell.value}
                                className={`relative border-r border-b border-gray-200 ${
                                  !cell.isCurrentMonth && granularity === "Month" ? 'bg-gray-50' : 'bg-white'
                                }`}
                                style={{
                                  gridColumn: cell.columnIndex + 1,
                                  gridRow: cell.rowIndex + 1
                                }}
                              >
                                {/* Date number */}
                                <div className="absolute top-1 left-1 text-xs font-medium text-gray-500">
                                  {cell.dayOfMonth}
                                </div>
                                
                                {/* Bars in this cell */}
                                <div className="pt-6 pb-1 px-1 space-y-1 h-full">
                                  {cellBars.map((bar, idx) => {
                                    if (!bar.period) return null;
                                    
                                    const barKey = bar.travel ? bar.travel.id : `${bar.person.id}-${bar.period.city}-default`;
                                    
                                    // Check if this is the first cell by comparing dates
                                    const barStart = new Date(bar.period.startDate);
                                    barStart.setHours(0, 0, 0, 0);
                                    const cellStart = new Date(cell.date);
                                    cellStart.setHours(0, 0, 0, 0);
                                    const isFirstCell = cellStart.getTime() === barStart.getTime();
                                    
                                    // Determine label based on view mode
                                    const barLabel = timelineViewMode === "person" 
                                      ? bar.period.city 
                                      : bar.person.fullName;
                                    
                                    return (
                                      <div
                                        key={barKey}
                                        onClick={() => {
                                          if (bar.travel) {
                                            setSelectedTravel({ person: bar.person, travel: bar.travel });
                                          }
                                        }}
                                        className={`relative h-6 rounded px-2 flex items-center shadow-sm transition-all border border-white/50 text-xs truncate ${
                                          bar.travel ? "cursor-pointer group hover:shadow-md" : "cursor-default opacity-60"
                                        }`}
                                        onMouseEnter={(e) => {
                                          if (bar.travel && bar.period) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setPersonTooltip({
                                              visible: true,
                                              x: rect.left + rect.width / 2,
                                              y: rect.top,
                                              content: {
                                                personName: bar.person.fullName,
                                                city: bar.period.city,
                                                country: bar.period.country,
                                                dateRange: formatDateRange(bar.period.startDate.toISOString(), bar.period.endDate.toISOString()),
                                              },
                                            });
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          setPersonTooltip(null);
                                        }}
                                        style={{
                                          background: bar.isDefaultLocation 
                                            ? `linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)`
                                            : getRoleGradient(bar.person.roleType),
                                          zIndex: bar.travel ? 10 : 1,
                                        }}
                                        title={barLabel}
                                      >
                                        {(isFirstCell || cellBars.length === 1) && (
                                          <span className="text-[10px] text-gray-700 font-medium truncate">
                                            {barLabel}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 relative" style={{ minHeight: `${rowHeight}px` }}>
                        {/* Grid lines - More visible */}
                        <div className="absolute inset-0 flex w-full">
                          {timeAxis.map((_, i) => (
                            <div
                              key={i}
                              className="flex-1 border-r border-gray-200 last:border-r-0 min-w-0"
                            />
                          ))}
                        </div>

                        {/* Location Period Bars */}
                        {stackedBars.map((bar) => {
                          // In person-based rows, period is always present
                          if (!bar.period) return null;
                          
                          const stackOffset = bar.stackIndex * 50; // 50px per stack level
                          const barKey = bar.travel ? bar.travel.id : `${bar.person.id}-${bar.period.city}-default`;
                          
                          return (
                            <div
                              key={barKey}
                              className={`absolute ${
                                bar.travel ? "cursor-pointer group" : "cursor-default opacity-60"
                              }`}
                              style={{
                                left: `${Math.max(0, bar.position.left)}%`,
                                width: `${Math.min(100 - bar.position.left, bar.position.width)}%`,
                                top: `${stackOffset + 10}px`,
                                height: '40px',
                                zIndex: Z_INDEX_TIMELINE_BAR,
                              }}
                              onClick={() => {
                                if (bar.travel) {
                                  setSelectedTravel({ person: bar.person, travel: bar.travel });
                                }
                              }}
                              onMouseMove={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement;
                                if (tooltip) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                  tooltip.style.top = `${rect.top}px`;
                                }
                              }}
                            >
                              <div 
                                className={`h-full rounded px-3 flex items-center shadow-sm transition-all border border-white/50 ${
                                  bar.travel ? "group-hover:shadow-md" : ""
                                }`}
                                style={{
                                  background: bar.isDefaultLocation 
                                    ? `linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)`
                                    : getRoleGradient(bar.person.roleType),
                                }}
                              >
                                <span className="text-xs text-gray-700 truncate font-medium">
                                  {bar.period.city}
                                </span>
                              </div>

                              {/* Tooltip - only show for travel windows */}
                              {bar.travel && (
                                <div 
                                  data-tooltip
                                  className="fixed w-64 bg-gray-900 text-white text-xs p-3 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                                  style={{ 
                                    zIndex: 99999,
                                    transform: 'translate(-50%, calc(-100% - 8px))',
                                  }}
                                >
                                  <p className="font-medium">{bar.person.fullName}</p>
                                  <p className="text-gray-300 mt-1">
                                    {bar.travel.city}, {bar.travel.country}
                                  </p>
                                  <p className="text-gray-400 text-xs mt-1">
                                    {formatDateRange(bar.travel.startDate, bar.travel.endDate)}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {personRows.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  No people match the current filters
                </div>
              )}
            </>
          ) : (
              // Location-based rows
              locationRows.map((location) => renderLocationRow(location, false))
            )}
            {timelineViewMode === "location" && locationRows.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                No locations match the current filters
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onViewPersonDetails?.(selectedTravel.person.id);
                }}
                className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 relative z-50"
              >
                <ExternalLink className="size-4" />
                View full profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal-rendered tooltip for person view to escape overflow containers */}
      {personTooltip && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed w-64 bg-gray-900 text-white text-xs p-3 rounded shadow-lg pointer-events-none"
          style={{ 
            zIndex: 999999,
            left: `${personTooltip.x}px`,
            top: `${personTooltip.y}px`,
            transform: 'translate(-50%, calc(-100% - 8px))',
          }}
        >
          <p className="font-medium">{personTooltip.content.personName}</p>
          <p className="text-gray-300 mt-1">
            {personTooltip.content.city}, {personTooltip.content.country}
          </p>
          <p className="text-gray-400 mt-1 text-[10px]">
            {personTooltip.content.dateRange}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
}