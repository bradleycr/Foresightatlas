/**
 * Person Detail Modal
 *
 * Full-screen overlay displaying comprehensive person information.
 * Admin mode unlocks inline CRUD for person details and travel windows.
 * Designed for cross-platform elegance with careful mobile spacing.
 */

import React, { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, MapPin, Calendar, ExternalLink, Mail, Globe,
  Edit, Save, Trash2, Plus, XCircle, Briefcase, Plane, Link2
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
import { getRoleGradient } from "../styles/roleColors";
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

  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

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

  const personTravelWindows = isEditing
    ? editingTravelWindows
    : travelWindows
        .filter((tw) => tw.personId === person.id)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

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
    return `${startDate.toLocaleDateString("en-US", options)} – ${endDate.toLocaleDateString("en-US", options)}`;
  };

  const handleEdit = () => setIsEditing(true);

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

      if (!editingPerson.fullName.trim()) {
        toast.error("Full name is required");
        return;
      }
      if (!editingPerson.currentCity.trim() || !editingPerson.currentCountry.trim()) {
        toast.error("Current city and country are required");
        return;
      }

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
      toast.error("Failed to save person", { description: errorMessage });
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

      if (!editingTravelWindow.city.trim() || !editingTravelWindow.country.trim()) {
        toast.error("City and country are required");
        return;
      }
      if (!editingTravelWindow.title.trim()) {
        toast.error("Title is required");
        return;
      }

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
        await updateTravelWindow(travelWindowToSave.id, travelWindowToSave);
        const updated = [...editingTravelWindows];
        updated[existingIndex] = travelWindowToSave;
        setEditingTravelWindows(updated);
        toast.success("Travel window updated successfully");
      } else {
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
      toast.error("Failed to save travel window", { description: errorMessage });
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
      toast.error("Failed to delete travel window", { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const displayPerson = isEditing && editingPerson ? editingPerson : person;

  /* Travel-window type → colour token for the accent pip */
  const typeAccent: Record<TravelWindowType, string> = {
    Residency: "bg-cyan-400",
    Conference: "bg-indigo-400",
    Workshop: "bg-amber-400",
    Visit: "bg-emerald-400",
    Other: "bg-gray-400",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: Z_INDEX_MODAL_BACKDROP,
        }}
        onClick={onClose}
      >
        {/* Panel */}
        <div
          className={`person-detail-modal bg-white flex flex-col relative ${
            isMobile
              ? 'rounded-t-3xl rounded-b-none h-full w-full max-h-[100dvh]'
              : 'rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh]'
          } overflow-hidden`}
          style={{
            zIndex: Z_INDEX_MODAL_CONTENT,
            paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
            paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable content */}
          <div
            className="person-detail-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            style={isMobile ? { paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px) + 1.5rem)' } : undefined}
          >
            <div className="px-5 pt-5 pb-10 md:px-10 md:pt-8 md:pb-14">

              {/* ── Top toolbar ────────────────────────────────── */}
              <div className={`flex items-center justify-between ${isMobile ? 'mb-6' : 'mb-8'}`}>
                {/* Navigation arrows (left side) */}
                <div className="flex items-center gap-1.5">
                  {!isEditing && (hasPrevious || hasNext) && (
                    <>
                      <button
                        onClick={handlePrevious}
                        disabled={!hasPrevious}
                        className="flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Action buttons (right side) */}
                <div className="flex items-center gap-2">
                  {isAdmin && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="border-gray-200 hover:bg-gray-50 text-xs h-8 px-3"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  )}
                  {isEditing && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="border-gray-200 hover:bg-gray-50 text-xs h-8 px-3"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePerson}
                        disabled={isSaving}
                        className="bg-teal-600 hover:bg-teal-700 text-xs h-8 px-3"
                      >
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        Save
                      </Button>
                    </>
                  )}
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* ── Identity block (name, role badge, cohort, tags) ── */}
              <div className="person-detail-content__head">
                {/* Name */}
                {isEditing && editingPerson ? (
                  <Input
                    value={editingPerson.fullName}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, fullName: e.target.value })
                    }
                    className="text-2xl md:text-3xl font-bold mb-3"
                    placeholder="Full Name"
                  />
                ) : (
                  <h2
                    className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {displayPerson.fullName}
                  </h2>
                )}

                {/* Role + Cohort + Alumni */}
                <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                  {isEditing && editingPerson ? (
                    <>
                      <Select
                        value={editingPerson.roleType}
                        onValueChange={(value: RoleType) =>
                          setEditingPerson({ ...editingPerson, roleType: value })
                        }
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fellow">Fellow</SelectItem>
                          <SelectItem value="Grantee">Grantee</SelectItem>
                          <SelectItem value="Prize Winner">Prize Winner</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={editingPerson.fellowshipCohortYear}
                        onChange={(e) =>
                          setEditingPerson({
                            ...editingPerson,
                            fellowshipCohortYear: parseInt(e.target.value) || 2024,
                          })
                        }
                        className="w-24 h-8 text-xs"
                        placeholder="Start year"
                      />
                      <span className="text-gray-300">–</span>
                      <Input
                        type="number"
                        placeholder="End (optional)"
                        className="w-24 h-8 text-xs"
                        value={editingPerson.fellowshipEndYear ?? ""}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setEditingPerson({
                            ...editingPerson,
                            fellowshipEndYear: v === "" ? null : parseInt(v, 10) || null,
                          });
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isAlumni"
                          checked={editingPerson.isAlumni}
                          onChange={(e) =>
                            setEditingPerson({ ...editingPerson, isAlumni: e.target.checked })
                          }
                          className="rounded"
                        />
                        <Label htmlFor="isAlumni" className="cursor-pointer text-xs">
                          Alumni
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold tracking-wide"
                        style={{
                          background: getRoleGradient(displayPerson.roleType),
                          color: "#374151",
                        }}
                      >
                        {displayPerson.roleType}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">
                        Cohort {getCohortLabel(displayPerson)}
                      </span>
                      {displayPerson.isAlumni && (
                        <Badge variant="secondary" className="text-xs font-medium">
                          Alumni
                        </Badge>
                      )}
                    </>
                  )}
                </div>

                {/* Focus tags */}
                {isEditing && editingPerson ? (
                  <div className="mt-4">
                    <Label htmlFor="focusTags" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                      Focus Tags
                    </Label>
                    <Input
                      id="focusTags"
                      value={editingPerson.focusTags.join(", ")}
                      onChange={(e) =>
                        setEditingPerson({
                          ...editingPerson,
                          focusTags: e.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter((tag) => tag.length > 0),
                        })
                      }
                      placeholder="Secure AI, Longevity Biotechnology"
                    />
                  </div>
                ) : (
                  displayPerson.focusTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {displayPerson.focusTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100/80 px-2.5 py-1 rounded-md border border-gray-200/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* ── Project ─────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-4 w-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Project</h3>
                </div>
                {isEditing && editingPerson ? (
                  <div className="space-y-3">
                    <Input
                      value={editingPerson.shortProjectTagline}
                      onChange={(e) =>
                        setEditingPerson({ ...editingPerson, shortProjectTagline: e.target.value })
                      }
                      placeholder="Short project tagline"
                    />
                    <Textarea
                      value={editingPerson.expandedProjectDescription}
                      onChange={(e) =>
                        setEditingPerson({
                          ...editingPerson,
                          expandedProjectDescription: e.target.value,
                        })
                      }
                      rows={4}
                      placeholder="Expanded project description"
                    />
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                        Affiliation / Institution
                      </Label>
                      <Input
                        value={editingPerson.affiliationOrInstitution ?? ""}
                        onChange={(e) =>
                          setEditingPerson({
                            ...editingPerson,
                            affiliationOrInstitution: e.target.value.trim() || null,
                          })
                        }
                        placeholder="University, company, or institution"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 p-5 md:p-6">
                    <p className="text-base md:text-lg font-semibold text-gray-900 leading-snug">
                      {displayPerson.shortProjectTagline}
                    </p>
                    {displayPerson.expandedProjectDescription && (
                      <p className="text-sm text-gray-600 leading-relaxed mt-3">
                        {displayPerson.expandedProjectDescription}
                      </p>
                    )}
                    {(displayPerson.affiliationOrInstitution ?? "").trim() && (
                      <p className="text-xs text-gray-400 font-medium mt-4 uppercase tracking-wide">
                        {displayPerson.affiliationOrInstitution}
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* ── Location & Primary Node ────────────────────── */}
              <section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Location</h3>
                    </div>
                    {isEditing && editingPerson ? (
                      <div className="space-y-2">
                        <Input
                          value={editingPerson.currentCity}
                          onChange={(e) =>
                            setEditingPerson({ ...editingPerson, currentCity: e.target.value })
                          }
                          placeholder="City"
                        />
                        <Input
                          value={editingPerson.currentCountry}
                          onChange={(e) =>
                            setEditingPerson({ ...editingPerson, currentCountry: e.target.value })
                          }
                          placeholder="Country"
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-gray-800">
                        {displayPerson.currentCity}, {displayPerson.currentCountry}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Primary Node</h3>
                    </div>
                    {isEditing && editingPerson ? (
                      <Select
                        value={editingPerson.primaryNode}
                        onValueChange={(value: PrimaryNode) =>
                          setEditingPerson({ ...editingPerson, primaryNode: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Global">Global</SelectItem>
                          <SelectItem value="Berlin Node">Berlin Node</SelectItem>
                          <SelectItem value="Bay Area Node">Bay Area Node</SelectItem>
                          <SelectItem value="Alumni">Alumni</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium text-gray-800">
                        {displayPerson.primaryNode === "Alumni" ? "—" : getNodeLabel(displayPerson.primaryNode)}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Travel & Residencies ───────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-gray-400" />
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                      Travel & Residencies
                    </h3>
                    <span className="text-xs text-gray-300 font-medium ml-1">
                      {personTravelWindows.length}
                    </span>
                  </div>
                  {isEditing && isAdmin && (
                    <Button
                      size="sm"
                      onClick={handleAddTravelWindow}
                      className="bg-teal-600 hover:bg-teal-700 text-xs h-8 px-3"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                {editingTravelWindow ? (
                  <TravelWindowEditForm
                    travelWindow={editingTravelWindow}
                    onChange={setEditingTravelWindow}
                    onSave={handleSaveTravelWindow}
                    onCancel={() => setEditingTravelWindow(null)}
                    isSaving={isSaving}
                  />
                ) : (
                  <div className="space-y-3">
                    {personTravelWindows.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Plane className="h-6 w-6 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No travel windows yet</p>
                      </div>
                    ) : (
                      personTravelWindows.map((tw) => (
                        <div
                          key={tw.id}
                          className="group relative rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all p-4 md:p-5"
                        >
                          {/* Colour accent pip */}
                          <div className={`absolute top-4 left-0 w-1 h-8 rounded-r-full ${typeAccent[tw.type]}`} />

                          <div className="flex items-start justify-between gap-3 pl-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {tw.title}
                                </h4>
                                <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                  {tw.type}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                {tw.city}, {tw.country}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDateRange(tw.startDate, tw.endDate)}</span>
                              </div>
                              {tw.notes && (
                                <p className="text-xs text-gray-500 mt-2.5 italic leading-relaxed">{tw.notes}</p>
                              )}
                            </div>
                            {isEditing && isAdmin && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleEditTravelWindow(tw)}
                                  className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTravelWindow(tw)}
                                  className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>

              {/* ── Contact & Links ────────────────────────────── */}
              <section
                className="border-t border-gray-100 pt-8"
                style={isMobile ? { paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px) + 1rem)' } : undefined}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Link2 className="h-4 w-4 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contact & Links</h3>
                </div>
                {isEditing && editingPerson ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="contact" className="text-xs text-gray-500">Contact / Handle</Label>
                      <Input
                        id="contact"
                        value={editingPerson.contactUrlOrHandle || ""}
                        onChange={(e) =>
                          setEditingPerson({
                            ...editingPerson,
                            contactUrlOrHandle: e.target.value || null,
                          })
                        }
                        placeholder="@username or email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="profileUrl" className="text-xs text-gray-500">Profile URL</Label>
                      <Input
                        id="profileUrl"
                        type="url"
                        value={editingPerson.profileUrl}
                        onChange={(e) =>
                          setEditingPerson({ ...editingPerson, profileUrl: e.target.value })
                        }
                        placeholder="https://foresight.org/fellow/..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {displayPerson.contactUrlOrHandle && (
                      <a
                        href={
                          displayPerson.contactUrlOrHandle.startsWith("@")
                            ? `https://twitter.com/${displayPerson.contactUrlOrHandle.slice(1)}`
                            : displayPerson.contactUrlOrHandle.startsWith("http")
                            ? displayPerson.contactUrlOrHandle
                            : `mailto:${displayPerson.contactUrlOrHandle}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-800 bg-teal-50/60 hover:bg-teal-100/60 px-3.5 py-2 rounded-lg border border-teal-100 transition-colors"
                      >
                        {displayPerson.contactUrlOrHandle.includes("@") &&
                         !displayPerson.contactUrlOrHandle.startsWith("@") ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        {displayPerson.contactUrlOrHandle.startsWith("@")
                          ? displayPerson.contactUrlOrHandle
                          : "Contact"}
                      </a>
                    )}
                    <a
                      href="https://foresight.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-50/80 hover:bg-gray-100/80 px-3.5 py-2 rounded-lg border border-gray-200/60 transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Foresight.org
                    </a>
                  </div>
                )}
              </section>

              <div className="h-16 md:h-20" aria-hidden />
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

/* ─── Travel Window Edit Form ─────────────────────────────────────────── */

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
    <div className="rounded-xl bg-gray-50/80 border border-gray-200 p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="twTitle" className="text-xs font-medium text-gray-600">Title *</Label>
          <Input
            id="twTitle"
            value={travelWindow.title}
            onChange={(e) => onChange({ ...travelWindow, title: e.target.value })}
            placeholder="Conference name or event"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twType" className="text-xs font-medium text-gray-600">Type *</Label>
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
        <div className="space-y-1.5">
          <Label htmlFor="twCity" className="text-xs font-medium text-gray-600">City *</Label>
          <Input
            id="twCity"
            value={travelWindow.city}
            onChange={(e) => onChange({ ...travelWindow, city: e.target.value })}
            placeholder="San Francisco"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twCountry" className="text-xs font-medium text-gray-600">Country *</Label>
          <Input
            id="twCountry"
            value={travelWindow.country}
            onChange={(e) => onChange({ ...travelWindow, country: e.target.value })}
            placeholder="USA"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twStartDate" className="text-xs font-medium text-gray-600">Start Date *</Label>
          <Input
            id="twStartDate"
            type="date"
            value={
              travelWindow.startDate.includes("T")
                ? travelWindow.startDate.split("T")[0]
                : travelWindow.startDate
            }
            onChange={(e) =>
              onChange({ ...travelWindow, startDate: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="twEndDate" className="text-xs font-medium text-gray-600">End Date *</Label>
          <Input
            id="twEndDate"
            type="date"
            value={
              travelWindow.endDate.includes("T")
                ? travelWindow.endDate.split("T")[0]
                : travelWindow.endDate
            }
            onChange={(e) =>
              onChange({ ...travelWindow, endDate: e.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="twNotes" className="text-xs font-medium text-gray-600">Notes</Label>
        <Textarea
          id="twNotes"
          value={travelWindow.notes}
          onChange={(e) => onChange({ ...travelWindow, notes: e.target.value })}
          rows={3}
          placeholder="Additional details about this travel window"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={isSaving} className="flex-1 bg-teal-600 hover:bg-teal-700 h-9 text-sm">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1 h-9 text-sm" disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
