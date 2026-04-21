/**
 * Person Detail Modal Component
 * 
 * Displays comprehensive person information in a full-screen modal.
 * When admin is logged in, provides full CRUD editing capabilities for:
 * - Person details (name, role, cohort, focus tags, locations, details/bio, contact)
 * - Travel windows (create, edit, delete)
 * 
 * Beautiful, modular design with elegant mobile styling and production-ready error handling.
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, ChevronLeft, ChevronRight, MapPin, Calendar, ExternalLink, Mail, Globe,
  Edit, Save, Trash2, Plus, XCircle, Users, CalendarDays, MapPinCheck, Copy, ChevronDown, Bookmark
} from "lucide-react";
import { Person, TravelWindow, RoleType, PrimaryNode, TravelWindowType, Filters } from "../types";
import type { NodeEvent } from "../types/events";
import { getPersonRSVPs } from "../services/rsvp";
import { getPersonCheckIns } from "../services/checkin";
import { getNode } from "../data/nodes";
import { buildFullPath } from "../utils/router";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "./ui/utils";
import { getRolePillClass } from "../styles/roleColors";
import { connectionsAccentGradient } from "../styles/gradients";
import { getNodeLabel } from "../utils/nodeLabels";
import { getCohortLabel, effectiveIsAlumni } from "../utils/cohortLabel";
import { PRESET_FOCUS_AREAS, getPresetFocusTags, getCustomFocusTags, parseFocusTags } from "../data/focusAreas";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT, Z_INDEX_MODAL_DROPDOWN } from "../constants/zIndex";
import { useIsMobile } from "./ui/use-mobile";
import { 
  updatePerson, 
  updateTravelWindow, 
  addTravelWindow, 
  deleteTravelWindow,
  generateTravelWindowId 
} from "../services/database";
import { geocodeCity } from "../services/geocoding";
import { toast } from "sonner";
import type { Identity } from "../services/identity";
import { isConnected, toggleConnection } from "../services/connections";
import { buildGoogleCalendarTemplateUrl } from "../utils/googleCalendarTemplate";
import { NanowheelBadge } from "./NanowheelBadge";
import { getNanowheelSummary, type NanowheelSummary } from "../services/nanowheels";

/** True only when the value looks like real contact (email, URL, or @handle). Avoids showing bio/description. */
function looksLikeContact(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s) return false;
  if (s.length > 250) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120) return true;
  if (/^https?:\/\/[^\s]+$/i.test(s) && s.length <= 220) return true;
  if (/^@[\w]+$/i.test(s) && s.length <= 50) return true;
  return false;
}

function looksLikeEmail(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;
}

function looksLikeUrl(value: string | null | undefined): boolean {
  const s = (value ?? "").trim();
  if (!s) return false;
  return /^https?:\/\/[^\s]+$/i.test(s) && s.length <= 220;
}

/** Cohort years 2017–current plus 0 for Unknown. */
const COHORT_YEAR_OPTIONS: number[] = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [0];
  for (let y = 2017; y <= current; y++) years.push(y);
  return years;
})();

/** Location-only nodes; alumni is a separate program-status field. */
const LOCATION_NODE_OPTIONS: PrimaryNode[] = ["Global", "Berlin Node", "Bay Area Node"];

interface NavigationContext {
  peopleIds: string[];
  label: string;
}

interface PersonDetailModalProps {
  person: Person | null;
  travelWindows: TravelWindow[];
  /** Events list (from loadEvents) for resolving RSVP event details; null until loaded. */
  events?: NodeEvent[] | null;
  allPeople: Person[];
  /** When set, arrows cycle through this subset instead of allPeople. */
  navigationContext?: NavigationContext | null;
  /** Active filters — shown as context badges so the user knows what slice they're browsing. */
  filters?: Filters;
  isOpen: boolean;
  isAdmin?: boolean;
  /** Logged-in user; when set, show bookmark (connections) button. */
  identity?: Identity | null;
  /** Called after user toggles a connection so parent can refresh (e.g. Connections page). */
  onConnectionsChange?: () => void;
  onClose: () => void;
  onNavigate?: (personId: string) => void;
  /** Called when user clicks "Browse all" to widen navigation to the full filtered set. */
  onExpandNavigation?: () => void;
  onDataUpdate?: () => Promise<void>;
}

export function PersonDetailModal({
  person,
  travelWindows,
  events = null,
  allPeople,
  navigationContext,
  filters,
  isOpen,
  isAdmin = false,
  identity = null,
  onConnectionsChange,
  onClose,
  onNavigate,
  onExpandNavigation,
  onDataUpdate,
}: PersonDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingTravelWindows, setEditingTravelWindows] = useState<TravelWindow[]>([]);
  const [editingTravelWindow, setEditingTravelWindow] = useState<TravelWindow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** When true, show full expanded project description; otherwise truncate with "Show more". */
  const [projectDescriptionExpanded, setProjectDescriptionExpanded] = useState(false);

  /**
   * Nanowheel totals for the currently viewed person. Loaded lazily whenever
   * a different person is opened so the modal doesn't block on the API when
   * users are rapid-clicking through map pins.
   */
  const [nanowheelSummary, setNanowheelSummary] = useState<NanowheelSummary | null>(null);

  useEffect(() => {
    setProjectDescriptionExpanded(false);
  }, [person?.id]);

  useEffect(() => {
    // Only fetch when a person is actually on screen; clear between swaps so
    // the previous person's badge doesn't flash during the transition.
    setNanowheelSummary(null);
    if (!isOpen || !person?.id) return;
    let cancelled = false;
    void getNanowheelSummary(person.id).then((summary) => {
      if (!cancelled) setNanowheelSummary(summary);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, person?.id]);
  const isMobile = useIsMobile();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Lock body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore scroll position
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Initialize editing state when person changes
  useEffect(() => {
    if (person) {
      setEditingPerson({ ...person });
      const personTWs = travelWindows
        .filter((tw) => tw.personId === person.id)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setEditingTravelWindows(personTWs.map(tw => ({ ...tw })));
    }
  }, [person, travelWindows]);

  // Resolve navigation list: scoped subset when a context is active, full filtered list otherwise
  // Must be called unconditionally (before any early return) to satisfy Rules of Hooks.
  const navigationList = useMemo(() => {
    if (!navigationContext) return allPeople;
    const idSet = new Set(navigationContext.peopleIds);
    return allPeople.filter((p) => idSet.has(p.id));
  }, [allPeople, navigationContext]);

  // Human-readable summary of active filters for context display
  const filterSummary = useMemo(() => {
    if (!filters) return [];
    const tags: string[] = [];
    if (filters.year !== null) tags.push(`${filters.year}`);
    if (filters.programs.length > 0) tags.push(...filters.programs);
    if (filters.nodes.length > 0) tags.push(...filters.nodes.map(n => n.replace(" Node", "")));
    if (filters.focusTags.length > 0) tags.push(...filters.focusTags.slice(0, 2));
    if (filters.search) tags.push(`"${filters.search}"`);
    return tags;
  }, [filters]);

  if (!isOpen || !person) return null;

  // Get travel windows for this person, sorted by start date
  const personTravelWindows = isEditing 
    ? editingTravelWindows 
    : travelWindows
        .filter((tw) => tw.personId === person.id)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const currentIndex = navigationList.findIndex((p) => p.id === person.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < navigationList.length - 1;
  const isScoped = !!navigationContext;

  const handlePrevious = () => {
    if (hasPrevious && onNavigate && !isEditing) {
      onNavigate(navigationList[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate && !isEditing) {
      onNavigate(navigationList[currentIndex + 1].id);
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingTravelWindow(null);
    if (person) {
      setEditingPerson({ ...person });
      const personTWs = travelWindows
        .filter((tw) => tw.personId === person.id)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setEditingTravelWindows(personTWs.map(tw => ({ ...tw })));
    }
  };

  const handleSavePerson = async () => {
    if (!editingPerson) return;

    try {
      setIsSaving(true);

      // Validate required fields
      if (!editingPerson.fullName.trim()) {
        toast.error("Full name is required");
        return;
      }
      if (!editingPerson.currentCity.trim()) {
        toast.error("City is required for the map");
        return;
      }

      // Geocode when coordinates missing (city is enough; country optional)
      let personToSave = { ...editingPerson };
      if (
        personToSave.currentCoordinates.lat === 0 &&
        personToSave.currentCoordinates.lng === 0 &&
        personToSave.currentCity.trim()
      ) {
        const geocodeResult = await geocodeCity(
          personToSave.currentCity,
          personToSave.currentCountry || undefined
        );
        if (geocodeResult) {
          personToSave.currentCoordinates = {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng,
          };
          if (!personToSave.currentCountry?.trim() && geocodeResult.country) {
            personToSave.currentCountry = geocodeResult.country;
          }
        }
      }

      await updatePerson(person.id, personToSave);
      toast.success("Person updated successfully");
      setIsEditing(false);
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save person";
      toast.error("Failed to save person", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTravelWindow = () => {
    const today = new Date().toISOString().split("T")[0];
    const newTravelWindow: TravelWindow = {
      id: generateTravelWindowId(),
      personId: person.id,
      title: "",
      city: "",
      country: "",
      coordinates: { lat: 0, lng: 0 },
      startDate: today,
      endDate: today,
      type: "Conference",
      notes: "",
    };
    setEditingTravelWindow(newTravelWindow);
  };

  const handleEditTravelWindow = (tw: TravelWindow) => {
    setEditingTravelWindow({ ...tw });
  };

  const handleSaveTravelWindow = async () => {
    if (!editingTravelWindow) return;

    try {
      setIsSaving(true);

      // Validate required fields
      if (!editingTravelWindow.city.trim() || !editingTravelWindow.country.trim()) {
        toast.error("City and country are required");
        return;
      }
      if (!editingTravelWindow.title.trim()) {
        toast.error("Title is required");
        return;
      }

      // Geocode location if coordinates are missing or zero
      let travelWindowToSave = { ...editingTravelWindow };
      if (
        (travelWindowToSave.coordinates.lat === 0 &&
          travelWindowToSave.coordinates.lng === 0) ||
        (!travelWindowToSave.city || !travelWindowToSave.country)
      ) {
        const geocodeResult = await geocodeCity(
          travelWindowToSave.city,
          travelWindowToSave.country
        );
        if (geocodeResult) {
          travelWindowToSave.coordinates = {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng,
          };
        }
      }

      const existingIndex = editingTravelWindows.findIndex(
        (tw) => tw.id === travelWindowToSave.id
      );

      if (existingIndex >= 0) {
        // Update existing
        await updateTravelWindow(travelWindowToSave.id, travelWindowToSave);
        const updated = [...editingTravelWindows];
        updated[existingIndex] = travelWindowToSave;
        setEditingTravelWindows(updated);
        toast.success("Travel window updated successfully");
      } else {
        // Add new
        await addTravelWindow(travelWindowToSave);
        setEditingTravelWindows([...editingTravelWindows, travelWindowToSave]);
        toast.success("Travel window added successfully");
      }

      setEditingTravelWindow(null);
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save travel window";
      toast.error("Failed to save travel window", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTravelWindow = (tw: TravelWindow) => {
    setDeleteTarget({ id: tw.id, title: tw.title });
    setShowDeleteDialog(true);
  };

  const confirmDeleteTravelWindow = async () => {
    if (!deleteTarget) return;

    try {
      setIsSaving(true);
      await deleteTravelWindow(deleteTarget.id);
      setEditingTravelWindows(
        editingTravelWindows.filter((tw) => tw.id !== deleteTarget.id)
      );
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      toast.success("Travel window deleted successfully");
      if (onDataUpdate) {
        await onDataUpdate();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete travel window";
      toast.error("Failed to delete travel window", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayPerson = isEditing && editingPerson ? editingPerson : person;

  // Whether the person has any project content worth showing a project section for
  const hasProject = !!(
    isEditing ||
    (displayPerson.shortProjectTagline ?? "").trim() ||
    (displayPerson.expandedProjectDescription ?? "").trim() ||
    (displayPerson.affiliationOrInstitution ?? "").trim()
  );

  return (
    <>
      <div 
        className={`fixed inset-0 flex items-center ${isMobile ? 'items-start p-0' : 'items-center p-4'} z-50`}
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: Z_INDEX_MODAL_BACKDROP,
        }}
        onClick={onClose}
      >
        <div 
          className={`person-detail-modal bg-[var(--pdm-surface)] ${isMobile ? 'rounded-t-xl rounded-b-none h-full w-full max-h-[100dvh]' : 'rounded-xl w-full max-h-[90vh] max-w-4xl lg:max-w-5xl shadow-xl border border-[var(--pdm-border)]'} overflow-hidden flex flex-col relative`}
          style={{ 
            zIndex: Z_INDEX_MODAL_CONTENT,
            paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="person-detail-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={isMobile ? { paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px) + 1.5rem)' } : undefined}
          >
            {/* Generous padding on all sides — never flush to edges; respect safe area on mobile */}
            <div 
              className="px-6 pt-6 pb-10 sm:px-8 sm:pt-7 sm:pb-12 lg:px-12 lg:pt-10 lg:pb-16 break-words min-w-0"
              style={isMobile ? {
                paddingLeft: 'max(1.5rem, env(safe-area-inset-left, 0px) + 1rem)',
                paddingRight: 'max(1.5rem, env(safe-area-inset-right, 0px) + 1rem)',
              } : undefined}
            >
              {/* Toolbar: nav + context left, actions right */}
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  {!isEditing && (hasPrevious || hasNext) && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevious}
                        disabled={!hasPrevious}
                        className="person-detail-toolbar-btn flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-0 touch-manipulation"
                        aria-label="Previous person"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="person-detail-toolbar-btn flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-0 touch-manipulation"
                        aria-label="Next person"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {!isEditing && navigationList.length > 1 && currentIndex >= 0 && (
                    <span className="text-xs text-[var(--pdm-text-muted)] tabular-nums ml-1">
                      {currentIndex + 1} / {navigationList.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  {identity && person && identity.personId !== person.id && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        const nowConnected = toggleConnection(identity.personId, person.id);
                        onConnectionsChange?.();
                        toast.success(
                          nowConnected ? "Added to connections" : "Removed from connections",
                        );
                      }}
                      className={cn(
                        "person-detail-toolbar-btn flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-0 touch-manipulation active:scale-95 transition-transform",
                        isConnected(identity.personId, person.id)
                          ? "text-gray-900 border border-gray-200"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-100",
                      )}
                      style={isConnected(identity.personId, person.id) ? { background: connectionsAccentGradient } : undefined}
                      aria-label={isConnected(identity.personId, person.id) ? "Remove from connections" : "Add to connections"}
                    >
                      <Bookmark
                        className={cn("h-5 w-5", isConnected(identity.personId, person.id) && "fill-current")}
                      />
                    </button>
                  )}
                  {isAdmin && !isEditing && (
                    <button type="button" onClick={handleEdit} className="person-detail-toolbar-btn flex min-h-[44px] sm:min-h-9 items-center gap-1.5 px-3 sm:px-3">
                      <Edit className="h-4 w-4 sm:mr-0.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                  )}
                  {isEditing && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving} className="person-detail-toolbar-btn border-[var(--pdm-border)] bg-[var(--pdm-surface)]">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSavePerson} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white">
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="person-detail-toolbar-btn-close flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-2.5 touch-manipulation"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Navigation context bar — tells user what subset they're browsing */}
              {!isEditing && (
                <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-5">
                  {isScoped && navigationContext ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-medium">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {navigationContext.label}
                      </span>
                      {filterSummary.length > 0 && (
                        <span className="text-[var(--pdm-text-muted)]">
                          {filterSummary.join(" · ")}
                        </span>
                      )}
                      {onExpandNavigation && allPeople.length > navigationList.length && (
                        <button
                          type="button"
                          onClick={onExpandNavigation}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[var(--pdm-text-muted)] hover:text-[var(--pdm-text)] hover:bg-gray-100 transition-colors"
                        >
                          <Users className="h-3 w-3" />
                          Browse all {allPeople.length}
                        </button>
                      )}
                    </div>
                  ) : (
                    filterSummary.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--pdm-text-muted)]">
                        {filterSummary.map((tag) => (
                          <span key={tag} className="px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200">
                            {tag}
                          </span>
                        ))}
                        <span className="ml-0.5">&middot; {navigationList.length} results</span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Name + metadata block (optional profile image from foresight.org) */}
              <header className="person-detail-content__head">
                <div className={cn("mb-3 sm:mb-4", (displayPerson.profileImageUrl || (isEditing && editingPerson?.profileImageUrl)) && "flex items-start gap-4")}>
                  {(displayPerson.profileImageUrl || (isEditing && editingPerson?.profileImageUrl)) && (
                    <img
                      src={isEditing && editingPerson?.profileImageUrl ? editingPerson.profileImageUrl! : displayPerson.profileImageUrl!}
                      alt=""
                      className="size-16 sm:size-20 rounded-full object-cover border border-gray-200 flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                  {isEditing && editingPerson ? (
                    <Input
                      value={editingPerson.fullName}
                      onChange={(e) => setEditingPerson({ ...editingPerson, fullName: e.target.value })}
                      className="text-xl sm:text-2xl lg:text-3xl font-bold border-gray-300"
                      placeholder="Full Name"
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="person-detail-title">
                        {displayPerson.fullName}
                      </h2>
                      {/* Inline nanowheel count — quiet until someone has at least one wheel. */}
                      {nanowheelSummary && nanowheelSummary.total > 0 && (
                        <NanowheelBadge
                          count={nanowheelSummary.total}
                          size="sm"
                          ariaLabel={`${displayPerson.fullName} has earned ${nanowheelSummary.total} nanowheels`}
                        />
                      )}
                    </div>
                  )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {isEditing && editingPerson ? (
                    <>
                      <Select value={editingPerson.roleType} onValueChange={(v: RoleType) => setEditingPerson({ ...editingPerson, roleType: v })}>
                        <SelectTrigger className="w-28 sm:w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fellow">Fellow</SelectItem>
                          <SelectItem value="Senior Fellow">Senior Fellow</SelectItem>
                          <SelectItem value="Grantee">Grantee</SelectItem>
                          <SelectItem value="Prize Winner">Prize Winner</SelectItem>
                          <SelectItem value="Nodee">Nodee</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={String(editingPerson.fellowshipCohortYear)} onValueChange={(v) => setEditingPerson({ ...editingPerson, fellowshipCohortYear: v === "0" ? 0 : parseInt(v, 10) || 0 })}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Unknown</SelectItem>
                          {COHORT_YEAR_OPTIONS.filter((y) => y !== 0).map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-gray-400">–</span>
                      <Input type="number" placeholder="End" className="w-20" value={editingPerson.fellowshipEndYear ?? ""} onChange={(e) => { const v = e.target.value.trim(); setEditingPerson({ ...editingPerson, fellowshipEndYear: v === "" ? null : parseInt(v, 10) || null }); }} />
                      <Select value={editingPerson.isAlumni ? "Alumni" : "Current"} onValueChange={(v) => setEditingPerson({ ...editingPerson, isAlumni: v === "Alumni" })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Current">Current</SelectItem>
                          <SelectItem value="Alumni">Alumni</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <span className={cn("person-detail-pill text-sm font-medium", getRolePillClass(displayPerson.roleType))}>
                        {displayPerson.roleType}
                      </span>
                      <span className="person-detail-pill person-detail-pill-muted">Cohort {getCohortLabel(displayPerson)}</span>
                      {effectiveIsAlumni(displayPerson) && <Badge variant="alumni" className="person-detail-badge-pill text-xs">Alumni</Badge>}
                    </>
                  )}
                </div>
                {isEditing && editingPerson ? (
                  <div className="mt-4 space-y-3">
                    <Label className="text-sm font-medium text-gray-700 block">Focus areas</Label>
                    <p className="text-xs text-gray-500 mb-2">Main areas are used for map filtering; custom ones appear on your profile only.</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {PRESET_FOCUS_AREAS.map((tag) => (
                        <label
                          key={tag}
                          className="flex min-h-[44px] touch-manipulation cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 has-[:checked]:border-teal-400 has-[:checked]:bg-teal-50 has-[:checked]:text-teal-800 sm:min-h-0"
                        >
                          <input
                            type="checkbox"
                            checked={editingPerson.focusTags.includes(tag)}
                            onChange={() => {
                              const preset = getPresetFocusTags(editingPerson.focusTags);
                              const custom = getCustomFocusTags(editingPerson.focusTags);
                              const next = preset.includes(tag)
                                ? preset.filter((t) => t !== tag)
                                : [...preset, tag];
                              setEditingPerson({ ...editingPerson, focusTags: [...next, ...custom] });
                            }}
                            className="size-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Other (optional)</Label>
                      <Input
                        value={getCustomFocusTags(editingPerson.focusTags).join(", ")}
                        onChange={(e) => {
                          const preset = getPresetFocusTags(editingPerson.focusTags);
                          const custom = parseFocusTags(e.target.value);
                          setEditingPerson({ ...editingPerson, focusTags: [...preset, ...custom] });
                        }}
                        placeholder="e.g. Quantum computing, Policy"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  (() => {
                    const presetTags = getPresetFocusTags(displayPerson.focusTags);
                    const customTags = getCustomFocusTags(displayPerson.focusTags);
                    if (presetTags.length === 0 && customTags.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 sm:gap-2.5 mt-3 sm:mt-4">
                        {presetTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="person-detail-badge-pill text-xs font-normal">{tag}</Badge>
                        ))}
                        {customTags.length > 0 && (
                          <>
                            <Badge variant="outline" className="person-detail-badge-pill text-xs font-normal text-gray-600 border-gray-300">Other</Badge>
                            {customTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="person-detail-badge-pill text-xs font-normal bg-gray-100 text-gray-700">{tag}</Badge>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })()
                )}
              </header>

              {/* Main content: 2-col from md (tablet) up, single col on mobile.
                  When details block is absent the sidebar spans full width — no ghost left column. */}
              <div className={cn(
                "person-detail-grid grid grid-cols-1 gap-6 md:gap-8 lg:gap-10",
                hasProject && "md:grid-cols-[1fr_minmax(0,280px)]"
              )}>
                {/* Left: Details — bio/tagline/affiliation; only rendered when content exists or admin editing */}
                {hasProject && (
                  <section className="person-detail-section space-y-2">
                    <h3 className="person-detail-section-title">Details</h3>
                    {isEditing && editingPerson ? (
                      <div className="space-y-3">
                        <Input value={editingPerson.shortProjectTagline} onChange={(e) => setEditingPerson({ ...editingPerson, shortProjectTagline: e.target.value })} placeholder="Short tagline" />
                        <Textarea value={editingPerson.expandedProjectDescription} onChange={(e) => setEditingPerson({ ...editingPerson, expandedProjectDescription: e.target.value })} rows={4} placeholder="About you, your work, or project — full description" />
                        <div>
                          <Label className="text-sm font-medium text-gray-700">Affiliation</Label>
                          <Input value={editingPerson.affiliationOrInstitution ?? ""} onChange={(e) => setEditingPerson({ ...editingPerson, affiliationOrInstitution: e.target.value.trim() || null })} placeholder="Institution or company" className="mt-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const tagline = (displayPerson.shortProjectTagline ?? "").trim();
                          const expanded = (displayPerson.expandedProjectDescription ?? "").trim();
                          const taglineIsPrefix = tagline && expanded.toLowerCase().startsWith(tagline.toLowerCase());
                          const showTagline = tagline && !taglineIsPrefix;
                          const showExpandedOnly = expanded.length > 0;
                          const truncateLength = 320;
                          const isLong = expanded.length > truncateLength;
                          const showMore = isLong && !projectDescriptionExpanded;
                          const visibleDescription = showMore ? `${expanded.slice(0, truncateLength).trim()}\u2026` : expanded;
                          return (
                            <>
                              {showTagline && <p className="person-detail-body text-base font-medium">{tagline}</p>}
                              {showExpandedOnly && (
                                <>
                                  <p className="person-detail-body leading-relaxed whitespace-pre-wrap">{visibleDescription}</p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      onClick={() => setProjectDescriptionExpanded((v) => !v)}
                                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 rounded"
                                    >
                                      {projectDescriptionExpanded ? "Show less" : "Show more"}
                                      <ChevronDown className={`size-3.5 transition-transform ${projectDescriptionExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                  )}
                                </>
                              )}
                              {(displayPerson.affiliationOrInstitution ?? "").trim() && (
                                <p className="person-detail-body-muted mt-1">{displayPerson.affiliationOrInstitution}</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </section>
                )}

                {/* Right sidebar: meta + contact */}
                <div className="person-detail-sidebar space-y-5">

                  {/* Location + Node — compact paired meta in read mode, full fields in edit */}
                  {isEditing && editingPerson ? (
                    <>
                      <section className="person-detail-section">
                        <h3 className="person-detail-section-title flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          Location
                        </h3>
                        <div className="space-y-2">
                          <Input value={editingPerson.currentCity} onChange={(e) => setEditingPerson({ ...editingPerson, currentCity: e.target.value })} placeholder="City (used for map pin)" />
                          <Input value={editingPerson.currentCountry} onChange={(e) => setEditingPerson({ ...editingPerson, currentCountry: e.target.value })} placeholder="Country (optional)" />
                        </div>
                      </section>
                      <section className="person-detail-section">
                        <h3 className="person-detail-section-title">Primary Node (location)</h3>
                        <Select value={editingPerson.primaryNode === "Alumni" ? "Global" : editingPerson.primaryNode} onValueChange={(v: PrimaryNode) => setEditingPerson({ ...editingPerson, primaryNode: v })}>
                          <SelectTrigger className="rounded-[var(--pdm-radius-sm)] border-[var(--pdm-border)] bg-[#fafafa]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LOCATION_NODE_OPTIONS.map((n) => (
                              <SelectItem key={n} value={n}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </section>
                    </>
                  ) : (
                    /* Side-by-side on mobile (where sidebar stacks below project),
                       stacked in the actual sidebar column at md+ */
                    <section className="person-detail-section">
                      <div className="person-detail-meta-grid">
                        <div>
                          <h3 className="person-detail-section-title flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            Location
                          </h3>
                          <p className="person-detail-body">
                            {[displayPerson.currentCity, displayPerson.currentCountry].filter(Boolean).join(", ") || "—"}
                          </p>
                        </div>
                        <div>
                          <h3 className="person-detail-section-title">Node</h3>
                          <p className="person-detail-body">
                            {displayPerson.primaryNode === "Alumni"
                              ? "—"
                              : getNodeLabel(displayPerson.primaryNode)}
                          </p>
                        </div>
                        <div>
                          <h3 className="person-detail-section-title">Program status</h3>
                          <p className="person-detail-body">
                            {effectiveIsAlumni(displayPerson) ? "Alumni" : "Current participant"}
                          </p>
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="person-detail-section person-detail-divider">
                    <h3 className="person-detail-section-title">How to contact</h3>
                    {isEditing && editingPerson ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-gray-600">Email, URL, or LinkedIn</Label>
                          <Input value={editingPerson.contactUrlOrHandle || ""} onChange={(e) => setEditingPerson({ ...editingPerson, contactUrlOrHandle: e.target.value || null })} placeholder="you@example.com, https://linkedin.com/in/you, or profile URL" className="mt-1" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-gray-600">Calendar invite email</Label>
                            <Input
                              value={editingPerson.calendarEmail || ""}
                              onChange={(e) =>
                                setEditingPerson({
                                  ...editingPerson,
                                  calendarEmail: e.target.value.trim() || null,
                                })
                              }
                              placeholder="name@gmail.com"
                              className="mt-1"
                              inputMode="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Availability link</Label>
                            <Input
                              value={editingPerson.availabilityUrl || ""}
                              onChange={(e) =>
                                setEditingPerson({
                                  ...editingPerson,
                                  availabilityUrl: e.target.value.trim() || null,
                                })
                              }
                              placeholder="https://calendly.com/…"
                              className="mt-1"
                              inputMode="url"
                              autoCapitalize="none"
                              autoCorrect="off"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Profile URL</Label>
                          <Input type="url" value={editingPerson.profileUrl} onChange={(e) => setEditingPerson({ ...editingPerson, profileUrl: e.target.value })} placeholder="https://..." className="mt-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {looksLikeContact(displayPerson.contactUrlOrHandle) ? (() => {
                          const contact = displayPerson.contactUrlOrHandle!;
                          const isEmail = contact.includes("@") && !contact.startsWith("@");
                          const isUrl = contact.startsWith("http");
                          const href = contact.startsWith("@")
                            ? `https://twitter.com/${contact.slice(1)}`
                            : isUrl
                              ? contact
                              : `mailto:${contact}`;
                          const displayLabel = contact.startsWith("@")
                            ? contact
                            : contact.includes("linkedin.com")
                              ? "LinkedIn"
                              : contact.length > 40
                                ? contact.slice(0, 37) + "..."
                                : contact;
                          const copyValue = contact;
                          const handleCopy = () => {
                            navigator.clipboard.writeText(copyValue).then(
                              () => toast.success("Copied to clipboard"),
                              () => toast.error("Could not copy"),
                            );
                          };
                          const handleOpen = () => window.open(href, "_blank", "noopener,noreferrer");
                          return (
                            <DropdownMenu key="contact" modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="person-detail-link-primary min-h-[44px] sm:min-h-[40px] inline-flex items-center gap-2"
                                  aria-haspopup="menu"
                                  aria-label={`Contact: ${displayLabel}. Open menu for options.`}
                                >
                                  {isEmail ? <Mail className="h-4 w-4 shrink-0" /> : <ExternalLink className="h-4 w-4 shrink-0" />}
                                  <span className="min-w-0 truncate">{displayLabel}</span>
                                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="min-w-[12rem] !bg-white text-gray-900 border border-gray-200 shadow-xl rounded-lg py-1"
                                style={{ zIndex: Z_INDEX_MODAL_DROPDOWN }}
                              >
                                <DropdownMenuItem onSelect={handleOpen}>
                                  {isEmail ? <Mail className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                                  {isEmail ? "Send email" : isUrl ? "Open link" : "Open profile"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={handleCopy}>
                                  <Copy className="h-4 w-4" />
                                  {isEmail ? "Copy email address" : "Copy to clipboard"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })() : (
                          <p className="text-sm text-gray-500 italic">
                            {identity?.personId === person.id
                              ? "No contact info yet. You can add it when you log in and edit your profile."
                              : "No contact info added yet."}
                          </p>
                        )}
                        <a
                          href="https://foresight.org/about/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="person-detail-link-secondary min-h-[44px] sm:min-h-[40px]"
                        >
                          <Globe className="h-4 w-4" />
                          foresight.org/about
                        </a>

                        {looksLikeEmail(displayPerson.calendarEmail) ? (
                          <a
                            href={buildGoogleCalendarTemplateUrl({
                              title: `Meet: ${displayPerson.fullName}`,
                              details: `Inviting ${displayPerson.fullName}.`,
                              addGuests: [displayPerson.calendarEmail],
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="person-detail-link-secondary min-h-[44px] sm:min-h-[40px]"
                            aria-label={`Create a Google Calendar invite for ${displayPerson.fullName}`}
                          >
                            <CalendarDays className="h-4 w-4" />
                            Invite via Google Calendar
                          </a>
                        ) : null}

                        {looksLikeUrl(displayPerson.availabilityUrl) ? (
                          <a
                            href={displayPerson.availabilityUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="person-detail-link-secondary min-h-[44px] sm:min-h-[40px]"
                            aria-label={`Open ${displayPerson.fullName}'s availability`}
                          >
                            <Calendar className="h-4 w-4" />
                            Availability
                          </a>
                        ) : null}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/*
               * Events, travel & residencies
               * ----------------------------
               * Two separate, independent streams live here:
               *
               *   1. Events the person is going to (RSVPs with status="going"),
               *      rendered by <PersonEventRSVPs/>. Hides itself when empty.
               *   2. Travel windows — admin-curated residencies/visits stored
               *      on the person. Purely informational: they do not move
               *      the person's pin on the map.
               *
               * The whole section is suppressed when both streams are empty
               * (and we're not actively editing) so we don't show a lonely
               * "No travel windows" line on a card that has nothing to say.
               * When editing as admin we always show the section so the
               * "Add travel" action is reachable.
               */}
              {(() => {
                const hasTravelWindows = personTravelWindows.length > 0;
                const isAdminEditing = isEditing && isAdmin;
                const shouldRenderTravelList =
                  isAdminEditing || (!isEditing && hasTravelWindows) || !!editingTravelWindow;
                const shouldRenderSection =
                  !isEditing || isAdminEditing || !!editingTravelWindow;
                if (!shouldRenderSection) return null;
                return (
                  <section className="person-detail-section mt-6 lg:mt-8 person-detail-divider">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="person-detail-section-title flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        Events, travel &amp; residencies
                      </h3>
                      {isAdminEditing && (
                        <Button
                          size="sm"
                          onClick={handleAddTravelWindow}
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add travel
                        </Button>
                      )}
                    </div>
                    {!isEditing && <PersonEventRSVPs personId={person.id} events={events} />}
                    {editingTravelWindow ? (
                      <TravelWindowEditForm
                        travelWindow={editingTravelWindow}
                        onChange={setEditingTravelWindow}
                        onSave={handleSaveTravelWindow}
                        onCancel={() => setEditingTravelWindow(null)}
                        isSaving={isSaving}
                      />
                    ) : shouldRenderTravelList ? (
                      <div className="space-y-3">
                        {hasTravelWindows
                          ? personTravelWindows.map((tw) => (
                              <div
                                key={tw.id}
                                className="p-4 sm:p-5 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-gray-900">{tw.title}</h4>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                      {tw.city}, {tw.country}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                      <Calendar className="h-3 w-3" />
                                      {formatDateRange(tw.startDate, tw.endDate)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {tw.type}
                                    </Badge>
                                    {isAdminEditing && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditTravelWindow(tw)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteTravelWindow(tw)}
                                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {tw.notes && (
                                  <p className="text-sm text-gray-600 mt-3 italic">{tw.notes}</p>
                                )}
                              </div>
                            ))
                          : isAdminEditing && (
                              <p className="text-sm text-gray-500 italic">
                                No travel windows yet. Use "Add travel" above to add one.
                              </p>
                            )}
                      </div>
                    ) : null}
                  </section>
                );
              })()}

              {/* Node check-in schedule — upcoming days they plan to be at a node */}
              {!isEditing && <PersonCheckIns personId={person.id} />}

              <div className="h-8 lg:h-10" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the travel window{" "}
              <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTravelWindow}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Renders the "Event RSVPs" block for the person detail: events they're going to (confirmed).
 * Only "going" RSVPs are shown — not "interested". Only when events are loaded and person has at least one going RSVP.
 */
function PersonEventRSVPs({ personId, events }: { personId: string; events: NodeEvent[] | null | undefined }) {
  const goingRsvps = useMemo(() => getPersonRSVPs(personId).filter((r) => r.status === "going"), [personId]);
  const resolved = useMemo(() => {
    if (!events?.length) return [];
    return goingRsvps
      .map((r) => {
        const event = events.find((e) => e.id === r.eventId);
        return event ? { rsvp: r, event } : null;
      })
      .filter((x): x is { rsvp: typeof goingRsvps[0]; event: NodeEvent } => x !== null)
      .sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime());
  }, [goingRsvps, events]);

  if (resolved.length === 0) return null;

  return (
    <section className="person-detail-section mt-6 lg:mt-8 person-detail-divider">
      <h3 className="person-detail-section-title flex items-center gap-2 mb-4">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        Events they&apos;re going to ({resolved.length})
      </h3>
      <div className="space-y-3">
        {resolved.map(({ event }) => {
          const node = getNode(event.nodeSlug);
          const nodeLabel = node ? `${node.city}, ${node.country}` : event.location;
          const dateStr = new Date(event.startAt).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const nodePath = `/${event.nodeSlug}`;
          return (
            <a
              key={event.id}
              href={buildFullPath(nodePath)}
              className="block p-4 sm:p-5 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-teal-50/80 hover:border-teal-200 transition-colors group"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-gray-900 group-hover:text-teal-800">{event.title}</h4>
                  <p className="text-sm text-gray-600 mt-0.5">{nodeLabel}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <CalendarDays className="h-3 w-3" />
                    {dateStr}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-teal-600 shrink-0" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// Travel Window Edit Form Component
interface TravelWindowEditFormProps {
  travelWindow: TravelWindow;
  onChange: (travelWindow: TravelWindow) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function TravelWindowEditForm({
  travelWindow,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: TravelWindowEditFormProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-5 sm:p-6 space-y-4 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="twTitle">Title *</Label>
          <Input
            id="twTitle"
            value={travelWindow.title}
            onChange={(e) => onChange({ ...travelWindow, title: e.target.value })}
            placeholder="Conference name or event"
          />
        </div>

        <div>
          <Label htmlFor="twType">Type *</Label>
          <Select
            value={travelWindow.type}
            onValueChange={(value: TravelWindowType) =>
              onChange({ ...travelWindow, type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Residency">Residency</SelectItem>
              <SelectItem value="Conference">Conference</SelectItem>
              <SelectItem value="Workshop">Workshop</SelectItem>
              <SelectItem value="Visit">Visit</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="twCity">City *</Label>
          <Input
            id="twCity"
            value={travelWindow.city}
            onChange={(e) => onChange({ ...travelWindow, city: e.target.value })}
            placeholder="San Francisco"
          />
        </div>

        <div>
          <Label htmlFor="twCountry">Country *</Label>
          <Input
            id="twCountry"
            value={travelWindow.country}
            onChange={(e) => onChange({ ...travelWindow, country: e.target.value })}
            placeholder="USA"
          />
        </div>

        <div>
          <Label htmlFor="twStartDate">Start Date *</Label>
          <Input
            id="twStartDate"
            type="date"
            value={
              travelWindow.startDate.includes("T")
                ? travelWindow.startDate.split("T")[0]
                : travelWindow.startDate
            }
            onChange={(e) =>
              onChange({
                ...travelWindow,
                startDate: e.target.value,
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="twEndDate">End Date *</Label>
          <Input
            id="twEndDate"
            type="date"
            value={
              travelWindow.endDate.includes("T")
                ? travelWindow.endDate.split("T")[0]
                : travelWindow.endDate
            }
            onChange={(e) =>
              onChange({
                ...travelWindow,
                endDate: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div>
        <Label htmlFor="twNotes">Notes</Label>
        <Textarea
          id="twNotes"
          value={travelWindow.notes}
          onChange={(e) => onChange({ ...travelWindow, notes: e.target.value })}
          rows={3}
          placeholder="Additional details about this travel window"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} disabled={isSaving} className="flex-1 bg-teal-600 hover:bg-teal-700">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1" disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders upcoming node check-ins for a person — days they've checked in
 * or plan to attend, grouped by node with date + type badge.
 */
function PersonCheckIns({ personId }: { personId: string }) {
  const checkIns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return getPersonCheckIns(personId).filter((c) => c.date >= today);
  }, [personId]);

  if (checkIns.length === 0) return null;

  return (
    <section className="person-detail-section mt-6 lg:mt-8 person-detail-divider">
      <h3 className="person-detail-section-title flex items-center gap-2 mb-4">
        <MapPinCheck className="h-3.5 w-3.5 shrink-0" />
        At the Node ({checkIns.length} day{checkIns.length !== 1 ? "s" : ""})
      </h3>
      <div className="space-y-2">
        {checkIns.map((c) => {
          const node = getNode(c.nodeSlug);
          const dateStr = new Date(c.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const isToday = c.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={`${c.nodeSlug}-${c.date}`}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-gray-200 bg-gray-50/60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {node?.city ?? c.nodeSlug}
                  {isToday && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-teal-600">
                      Today
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {c.type === "checkin" ? "Checked in" : "Planned"}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}
