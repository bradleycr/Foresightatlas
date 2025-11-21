import { useState, useMemo } from "react";
import { Person, TravelWindow } from "../types";
import { FellowCard } from "./FellowCard";
import { MapPin, Users } from "lucide-react";
import foresightIcon from "figma:asset/4396d511673bc6640dd36d993bc028270de6d524.png";

interface MapViewProps {
  filteredPeople: Person[];
  filteredTravelWindows: TravelWindow[];
  timeWindowStart: Date;
  timeWindowEnd: Date;
}

interface MarkerData {
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  people: Array<{
    person: Person;
    travelWindow?: TravelWindow;
  }>;
}

export function MapView({
  filteredPeople,
  filteredTravelWindows,
  timeWindowStart,
  timeWindowEnd,
}: MapViewProps) {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  // Calculate markers based on current time window
  const markers = useMemo(() => {
    const markerMap = new Map<string, MarkerData>();

    filteredPeople.forEach((person) => {
      // Get travel windows for this person in the time range
      const personTravelWindows = filteredTravelWindows.filter(
        (tw) =>
          tw.personId === person.id &&
          new Date(tw.startDate) <= timeWindowEnd &&
          new Date(tw.endDate) >= timeWindowStart
      );

      personTravelWindows.forEach((tw) => {
        const key = `${tw.city}-${tw.country}`;
        if (!markerMap.has(key)) {
          markerMap.set(key, {
            city: tw.city,
            country: tw.country,
            coordinates: tw.coordinates,
            people: [],
          });
        }
        markerMap.get(key)!.people.push({ person, travelWindow: tw });
      });

      // Also show current location if no travel windows in range
      if (personTravelWindows.length === 0) {
        const key = `${person.currentCity}-${person.currentCountry}`;
        if (!markerMap.has(key)) {
          markerMap.set(key, {
            city: person.currentCity,
            country: person.currentCountry,
            coordinates: person.currentCoordinates,
            people: [],
          });
        }
        markerMap.get(key)!.people.push({ person });
      }
    });

    return Array.from(markerMap.values());
  }, [filteredPeople, filteredTravelWindows, timeWindowStart, timeWindowEnd]);

  // Get next travel window for each person
  const getNextTravel = (personId: string): TravelWindow | undefined => {
    const personWindows = filteredTravelWindows
      .filter((tw) => tw.personId === personId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return personWindows.find((tw) => new Date(tw.startDate) >= new Date());
  };

  // Convert lat/lng to pixel position for overlay markers
  const projectCoordinates = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = 50 - (mercN / Math.PI) * 50;
    
    return { 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(5, Math.min(95, y)) 
    };
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Map Panel */}
      <div className="flex-1 bg-white rounded-xl overflow-hidden relative min-h-[400px] sm:min-h-[500px] lg:min-h-0 shadow-lg border border-gray-100">
        {/* Gradient background matching Foresight website */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(circle at 20% 50%, rgba(147, 197, 253, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 207, 232, 0.4) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(167, 243, 208, 0.4) 0%, transparent 50%), radial-gradient(circle at 60% 60%, rgba(253, 230, 138, 0.4) 0%, transparent 50%)'
          }}
        />

        {/* Interactive overlay map with markers */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-pink-50/50">
          {/* Simplified world map backdrop */}
          <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
            {/* Equator */}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,6" />
            {/* Prime meridian */}
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,6" />
            
            {/* Latitude lines */}
            {[25, 75].map((y) => (
              <line
                key={`lat-${y}`}
                x1="0"
                y1={`${y}%`}
                x2="100%"
                y2={`${y}%`}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}
            
            {/* Longitude lines */}
            {[25, 75].map((x) => (
              <line
                key={`lng-${x}`}
                x1={`${x}%`}
                y1="0"
                x2={`${x}%`}
                y2="100%"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            ))}
          </svg>

          {/* Stylized continent blobs with gradients */}
          <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
            {/* North America */}
            <ellipse cx="20%" cy="35%" rx="12%" ry="15%" fill="url(#grad1)" />
            {/* Europe */}
            <ellipse cx="52%" cy="35%" rx="8%" ry="10%" fill="url(#grad2)" />
            {/* Asia */}
            <ellipse cx="70%" cy="40%" rx="18%" ry="18%" fill="url(#grad3)" />
            {/* Africa */}
            <ellipse cx="53%" cy="55%" rx="10%" ry="15%" fill="url(#grad4)" />
            {/* South America */}
            <ellipse cx="30%" cy="65%" rx="8%" ry="15%" fill="url(#grad5)" />
            {/* Australia */}
            <ellipse cx="80%" cy="70%" rx="7%" ry="8%" fill="url(#grad6)" />
            
            <defs>
              <radialGradient id="grad1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.2" />
              </radialGradient>
              <radialGradient id="grad2">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ddd6fe" stopOpacity="0.2" />
              </radialGradient>
              <radialGradient id="grad3">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#fbcfe8" stopOpacity="0.2" />
              </radialGradient>
              <radialGradient id="grad4">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.2" />
              </radialGradient>
              <radialGradient id="grad5">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#fde68a" stopOpacity="0.2" />
              </radialGradient>
              <radialGradient id="grad6">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a5f3fc" stopOpacity="0.2" />
              </radialGradient>
            </defs>
          </svg>

          {/* Markers Container */}
          <div className="absolute inset-0">
            {markers.map((marker, idx) => {
              const pos = projectCoordinates(
                marker.coordinates.lat,
                marker.coordinates.lng
              );
              const isSelected = selectedMarker?.city === marker.city && 
                                selectedMarker?.country === marker.country;

              // Gradient colors for badges - cycling through Foresight palette
              const gradients = [
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
                'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Purple
                'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // Pink
                'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Green
                'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
                'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan
              ];
              const gradient = gradients[idx % gradients.length];

              return (
                <div
                  key={`${marker.city}-${marker.country}-${idx}`}
                  className="absolute cursor-pointer group transition-transform hover:scale-110"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -100%)',
                    zIndex: isSelected ? 1000 : 10,
                  }}
                  onClick={() => setSelectedMarker(isSelected ? null : marker)}
                >
                  {/* Marker with Foresight Icon */}
                  <div className="relative">
                    <img
                      src={foresightIcon}
                      alt="Location"
                      className={`w-10 h-10 sm:w-12 sm:h-12 transition-all ${
                        isSelected ? 'drop-shadow-lg' : 'drop-shadow-md'
                      }`}
                      style={{
                        filter: isSelected 
                          ? 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.5))' 
                          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
                      }}
                    />
                    
                    {/* Number Badge with Gradient */}
                    <div
                      className={`absolute -top-2 -right-2 flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all ${
                        isSelected
                          ? 'w-7 h-7 text-sm'
                          : 'w-6 h-6 text-xs'
                      }`}
                      style={{
                        background: gradient,
                      }}
                    >
                      <span className="text-white font-semibold">
                        {marker.people.length}
                      </span>
                    </div>

                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap bg-gray-900 text-white text-xs px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                      {marker.city}, {marker.country}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-900"></div>
                    </div>
                  </div>

                  {/* Popover when selected */}
                  {isSelected && (
                    <div 
                      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50"
                      style={{
                        background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 100%)'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                          {marker.city}, {marker.country}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMarker(null);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
                        >
                          ×
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {marker.people.map(({ person, travelWindow }) => (
                          <div
                            key={person.id}
                            className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPerson(person.id);
                            }}
                          >
                            <p className="text-sm text-gray-900 font-medium">{person.fullName}</p>
                            <p className="text-xs text-gray-600">
                              {person.roleType} · {person.focusTags.slice(0, 2).join(", ")}
                            </p>
                            {travelWindow && (
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(travelWindow.startDate).toLocaleDateString()} -{" "}
                                {new Date(travelWindow.endDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Info Overlay with Gradient */}
        <div 
          className="absolute top-4 left-4 rounded-xl shadow-lg p-3 border border-white/20 backdrop-blur-sm z-20"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)'
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 text-blue-500 flex-shrink-0" />
              <span className="hidden sm:inline">{markers.length} locations</span>
              <span className="sm:hidden">{markers.length}</span>
            </div>
            <span className="text-gray-400">·</span>
            <div className="flex items-center gap-1.5">
              <Users className="size-4 text-purple-500 flex-shrink-0" />
              <span className="hidden sm:inline">{filteredPeople.length} people</span>
              <span className="sm:hidden">{filteredPeople.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fellows & Grantees List */}
      <div className="w-full lg:w-96 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col max-h-[500px] lg:max-h-none">
        <div 
          className="p-4 border-b border-gray-200"
          style={{
            background: 'linear-gradient(135deg, #fafafa 0%, #f9fafb 100%)'
          }}
        >
          <h3 className="text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
            Fellows & Grantees
          </h3>
          <p className="text-sm text-gray-600">{filteredPeople.length} people</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredPeople.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No fellows or grantees match your filters
            </p>
          ) : (
            filteredPeople.map((person) => (
              <FellowCard
                key={person.id}
                person={person}
                nextTravel={getNextTravel(person.id)}
                onSelect={() => {
                  setSelectedPerson(person.id);
                  // Find and select the marker for this person
                  const personMarker = markers.find((m) =>
                    m.people.some((p) => p.person.id === person.id)
                  );
                  if (personMarker) {
                    setSelectedMarker(personMarker);
                  }
                }}
                isHighlighted={selectedPerson === person.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}