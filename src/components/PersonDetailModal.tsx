/**
 * Person Detail Modal Component
 * 
 * Displays comprehensive person information in a full-screen modal.
 * When admin is logged in, provides full CRUD editing capabilities for:
 * - Person details (name, role, cohort, focus tags, locations, project info, contact)
 * - Travel windows (create, edit, delete)
 * 
 * Beautiful, modular design with elegant mobile styling and production-ready error handling.
 */

import React, { useState, useEffect } from "react";
import { 
  X, ChevronLeft, ChevronRight, MapPin, Calendar, ExternalLink, Mail, Globe,
  Edit, Save, Trash2, Plus, XCircle
} from "lucide-react";
import { Person, TravelWindow, RoleType, PrimaryNode, TravelWindowType } from "../types";
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
import { cn } from "./ui/utils";
import { getRolePillClass } from "../styles/roleColors";
import { getNodeLabel } from "../utils/nodeLabels";
import { getCohortLabel } from "../utils/cohortLabel";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
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

interface PersonDetailModalProps {
  person: Person | null;
  travelWindows: TravelWindow[];
  allPeople: Person[];
  isOpen: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onNavigate?: (personId: string) => void;
  onDataUpdate?: () => Promise<void>;
}

export function PersonDetailModal({
  person,
  travelWindows,
  allPeople,
  isOpen,
  isAdmin = false,
  onClose,
  onNavigate,
  onDataUpdate,
}: PersonDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingTravelWindows, setEditingTravelWindows] = useState<TravelWindow[]>([]);
  const [editingTravelWindow, setEditingTravelWindow] = useState<TravelWindow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  if (!isOpen || !person) return null;

  // Get travel windows for this person, sorted by start date
  const personTravelWindows = isEditing 
    ? editingTravelWindows 
    : travelWindows
        .filter((tw) => tw.personId === person.id)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Find current person index for navigation
  const currentIndex = allPeople.findIndex((p) => p.id === person.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allPeople.length - 1;

  const handlePrevious = () => {
    if (hasPrevious && onNavigate && !isEditing) {
      onNavigate(allPeople[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate && !isEditing) {
      onNavigate(allPeople[currentIndex + 1].id);
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
      if (!editingPerson.currentCity.trim() || !editingPerson.currentCountry.trim()) {
        toast.error("Current city and country are required");
        return;
      }

      // Geocode current location if coordinates are missing or zero
      let personToSave = { ...editingPerson };
      if (
        (personToSave.currentCoordinates.lat === 0 &&
          personToSave.currentCoordinates.lng === 0) ||
        (!personToSave.currentCity || !personToSave.currentCountry)
      ) {
        const geocodeResult = await geocodeCity(
          personToSave.currentCity,
          personToSave.currentCountry
        );
        if (geocodeResult) {
          personToSave.currentCoordinates = {
            lat: geocodeResult.lat,
            lng: geocodeResult.lng,
          };
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
            <div className="px-5 pt-5 pb-10 sm:px-8 lg:px-10 lg:pt-8 lg:pb-12">
              {/* Toolbar: nav left, actions right */}
              <div className="flex items-center justify-between gap-3 mb-8 sm:mb-10">
                <div className="flex items-center gap-1 sm:gap-2">
                  {!isEditing && (hasPrevious || hasNext) && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevious}
                        disabled={!hasPrevious}
                        className="person-detail-toolbar-btn flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-0"
                            aria-label="Previous person"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="person-detail-toolbar-btn flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-0"
                            aria-label="Next person"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
                    className="person-detail-toolbar-btn-close flex min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center p-2.5"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Name + metadata block */}
              <header className="person-detail-content__head mb-8 lg:mb-10">
                <div className="mb-3 sm:mb-4">
                  {isEditing && editingPerson ? (
                    <Input
                      value={editingPerson.fullName}
                      onChange={(e) => setEditingPerson({ ...editingPerson, fullName: e.target.value })}
                      className="text-xl sm:text-2xl lg:text-3xl font-bold border-gray-300"
                      placeholder="Full Name"
                    />
                  ) : (
                    <h2 className="person-detail-title">
                      {displayPerson.fullName}
                    </h2>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {isEditing && editingPerson ? (
                    <>
                      <Select value={editingPerson.roleType} onValueChange={(v: RoleType) => setEditingPerson({ ...editingPerson, roleType: v })}>
                        <SelectTrigger className="w-28 sm:w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fellow">Fellow</SelectItem>
                          <SelectItem value="Grantee">Grantee</SelectItem>
                          <SelectItem value="Prize Winner">Prize Winner</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" value={editingPerson.fellowshipCohortYear} onChange={(e) => setEditingPerson({ ...editingPerson, fellowshipCohortYear: parseInt(e.target.value) || 2024 })} className="w-20" placeholder="Year" />
                      <span className="text-gray-400">–</span>
                      <Input type="number" placeholder="End" className="w-20" value={editingPerson.fellowshipEndYear ?? ""} onChange={(e) => { const v = e.target.value.trim(); setEditingPerson({ ...editingPerson, fellowshipEndYear: v === "" ? null : parseInt(v, 10) || null }); }} />
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                        <input type="checkbox" checked={editingPerson.isAlumni} onChange={(e) => setEditingPerson({ ...editingPerson, isAlumni: e.target.checked })} className="rounded" />
                        Alumni
                      </label>
                    </>
                  ) : (
                    <>
                      <span className={cn("person-detail-pill text-sm font-medium", getRolePillClass(displayPerson.roleType))}>
                        {displayPerson.roleType}
                      </span>
                      <span className="person-detail-pill person-detail-pill-muted">Cohort {getCohortLabel(displayPerson)}</span>
                      {displayPerson.isAlumni && <Badge variant="secondary" className="person-detail-badge-pill text-xs">Alumni</Badge>}
                    </>
                  )}
                </div>
                {isEditing && editingPerson ? (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-gray-700 mb-1 block">Focus tags (comma-separated)</Label>
                    <Input
                      value={editingPerson.focusTags.join(", ")}
                      onChange={(e) => setEditingPerson({ ...editingPerson, focusTags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                      placeholder="e.g. Longevity, AI"
                    />
                  </div>
                ) : (
                  displayPerson.focusTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {displayPerson.focusTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="person-detail-badge-pill text-xs font-normal">{tag}</Badge>
                      ))}
                    </div>
                  )
                )}
              </header>

              {/* Main content: 2-col on desktop, single col on mobile */}
              <div className="person-detail-grid grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,320px)] gap-8 lg:gap-10">
                {/* Left: Project */}
                <section className="person-detail-section space-y-3">
                  <h3 className="person-detail-section-title">Project</h3>
                  {isEditing && editingPerson ? (
                    <div className="space-y-3">
                      <Input value={editingPerson.shortProjectTagline} onChange={(e) => setEditingPerson({ ...editingPerson, shortProjectTagline: e.target.value })} placeholder="Short tagline" />
                      <Textarea value={editingPerson.expandedProjectDescription} onChange={(e) => setEditingPerson({ ...editingPerson, expandedProjectDescription: e.target.value })} rows={4} placeholder="Full description" />
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
                        const showExpanded = expanded || tagline;
                        return (
                          <>
                            {showTagline && <p className="person-detail-body text-base font-medium">{tagline}</p>}
                            {showExpanded && (
                              <p className="person-detail-body leading-relaxed">
                                {taglineIsPrefix ? expanded : (expanded || tagline)}
                              </p>
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

                {/* Right: Location, Node, Contact — sidebar on desktop */}
                <div className="person-detail-sidebar space-y-6 lg:space-y-7">
                  <section className="person-detail-section">
                    <h3 className="person-detail-section-title flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      Location
                    </h3>
                    {isEditing && editingPerson ? (
                      <div className="space-y-2">
                        <Input value={editingPerson.currentCity} onChange={(e) => setEditingPerson({ ...editingPerson, currentCity: e.target.value })} placeholder="City" />
                        <Input value={editingPerson.currentCountry} onChange={(e) => setEditingPerson({ ...editingPerson, currentCountry: e.target.value })} placeholder="Country" />
                      </div>
                    ) : (
                      <p className="person-detail-body">{displayPerson.currentCity}, {displayPerson.currentCountry}</p>
                    )}
                  </section>
                  <section className="person-detail-section">
                    <h3 className="person-detail-section-title">Primary Node</h3>
                    {isEditing && editingPerson ? (
                      <Select value={editingPerson.primaryNode} onValueChange={(v: PrimaryNode) => setEditingPerson({ ...editingPerson, primaryNode: v })}>
                        <SelectTrigger className="rounded-[var(--pdm-radius-sm)] border-[var(--pdm-border)] bg-[#fafafa]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Global">Global</SelectItem>
                          <SelectItem value="Berlin Node">Berlin Node</SelectItem>
                          <SelectItem value="Bay Area Node">Bay Area Node</SelectItem>
                          <SelectItem value="Alumni">Alumni</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="person-detail-body">{displayPerson.primaryNode === "Alumni" ? "—" : getNodeLabel(displayPerson.primaryNode)}</p>
                    )}
                  </section>
                  <section className="person-detail-section person-detail-divider">
                    <h3 className="person-detail-section-title mb-3">Contact & Links</h3>
                    {isEditing && editingPerson ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-gray-600">Contact</Label>
                          <Input value={editingPerson.contactUrlOrHandle || ""} onChange={(e) => setEditingPerson({ ...editingPerson, contactUrlOrHandle: e.target.value || null })} placeholder="Email or @handle" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Profile URL</Label>
                          <Input type="url" value={editingPerson.profileUrl} onChange={(e) => setEditingPerson({ ...editingPerson, profileUrl: e.target.value })} placeholder="https://..." className="mt-1" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {displayPerson.contactUrlOrHandle && (
                          <a
                            href={displayPerson.contactUrlOrHandle.startsWith("@") ? `https://twitter.com/${displayPerson.contactUrlOrHandle.slice(1)}` : displayPerson.contactUrlOrHandle.startsWith("http") ? displayPerson.contactUrlOrHandle : `mailto:${displayPerson.contactUrlOrHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="person-detail-link-primary min-h-[44px] sm:min-h-[40px]"
                          >
                            {displayPerson.contactUrlOrHandle.includes("@") && !displayPerson.contactUrlOrHandle.startsWith("@") ? <Mail className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            {displayPerson.contactUrlOrHandle.startsWith("@") ? displayPerson.contactUrlOrHandle : "Contact"}
                          </a>
                        )}
                        <a
                          href="https://foresight.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="person-detail-link-secondary min-h-[44px] sm:min-h-[40px]"
                        >
                          <Globe className="h-4 w-4" />
                          Foresight.org
                        </a>
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/* Travel — full width below grid */}
              <section className="person-detail-section mt-8 lg:mt-10 person-detail-divider">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="person-detail-section-title flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Travel & Residencies ({personTravelWindows.length})
                  </h3>
                  {isEditing && isAdmin && (
                    <Button size="sm" onClick={handleAddTravelWindow} className="bg-teal-600 hover:bg-teal-700">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                {editingTravelWindow ? (
                  <TravelWindowEditForm travelWindow={editingTravelWindow} onChange={setEditingTravelWindow} onSave={handleSaveTravelWindow} onCancel={() => setEditingTravelWindow(null)} isSaving={isSaving} />
                ) : (
                  <div className="space-y-3">
                    {personTravelWindows.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No travel windows</p>
                    ) : (
                      personTravelWindows.map((tw) => (
                        <div key={tw.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-gray-100/60 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-gray-900">{tw.title}</h4>
                              <p className="text-sm text-gray-600 mt-0.5">{tw.city}, {tw.country}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                <Calendar className="h-3 w-3" />
                                {formatDateRange(tw.startDate, tw.endDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{tw.type}</Badge>
                              {isEditing && isAdmin && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleEditTravelWindow(tw)} className="h-8 w-8 p-0"><Edit className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="outline" onClick={() => handleDeleteTravelWindow(tw)} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /></Button>
                                </>
                              )}
                            </div>
                          </div>
                          {tw.notes && <p className="text-sm text-gray-600 mt-3 italic">{tw.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>

              <div className="h-12 lg:h-16" aria-hidden />
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
    <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
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
