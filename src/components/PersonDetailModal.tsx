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
import { getRoleGradient } from "../styles/roleColors";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
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
        className="fixed inset-0 flex items-center justify-center p-4 z-50" 
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: Z_INDEX_MODAL_BACKDROP,
        }}
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col relative"
          style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="px-6 md:px-8 pt-6 pb-6">
              {/* Name row with buttons on the right */}
              <div className="flex items-start justify-between gap-4 mb-6">
                {isEditing && editingPerson ? (
                  <Input
                    value={editingPerson.fullName}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, fullName: e.target.value })
                    }
                    className="text-2xl md:text-3xl font-bold flex-1"
                    placeholder="Full Name"
                  />
                ) : (
                  <h2
                    className="text-2xl md:text-3xl font-bold text-gray-900 flex-1"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {displayPerson.fullName}
                  </h2>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <Edit className="h-4 w-4 mr-1" />
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
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSavePerson}
                        disabled={isSaving}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </>
                  )}
                  {/* Navigation buttons */}
                  {!isEditing && (hasPrevious || hasNext) && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        disabled={!hasPrevious}
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        disabled={!hasNext}
                        className="border-gray-300 hover:bg-gray-50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 p-1.5 rounded transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-4">
                {/* Role and Cohort row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {isEditing && editingPerson ? (
                    <>
                      <Select
                        value={editingPerson.roleType}
                        onValueChange={(value: RoleType) =>
                          setEditingPerson({ ...editingPerson, roleType: value })
                        }
                      >
                        <SelectTrigger className="w-32">
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
                        className="w-24"
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
                        <Label htmlFor="isAlumni" className="cursor-pointer text-sm">
                          Alumni
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
                      <span
                        className="text-sm px-3 py-1 rounded-full font-medium"
                        style={{
                          background: getRoleGradient(displayPerson.roleType),
                          color: "#374151",
                        }}
                      >
                        {displayPerson.roleType}
                      </span>
                      <span className="text-sm text-gray-700">
                        Cohort {displayPerson.fellowshipCohortYear}
                      </span>
                      {displayPerson.isAlumni && (
                        <Badge variant="secondary" className="text-xs">
                          Alumni
                        </Badge>
                      )}
                    </>
                  )}
                </div>
                
                {/* Focus Areas row */}
                {isEditing && editingPerson ? (
                  <div>
                    <Label htmlFor="focusTags" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Focus Tags (comma-separated)
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
                    <div className="flex flex-wrap gap-2">
                      {displayPerson.focusTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 md:px-8 pt-6 md:pt-8 pb-6 md:pb-8 space-y-6">
            {/* Project Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Project</h3>
              {isEditing && editingPerson ? (
                <>
                  <Input
                    value={editingPerson.shortProjectTagline}
                    onChange={(e) =>
                      setEditingPerson({ ...editingPerson, shortProjectTagline: e.target.value })
                    }
                    placeholder="Short project tagline"
                    className="mb-3"
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
                </>
              ) : (
                <>
                  <p className="text-base text-gray-900 font-medium mb-3">
                    {displayPerson.shortProjectTagline}
                  </p>
                  {displayPerson.expandedProjectDescription && (
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {displayPerson.expandedProjectDescription}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Home Base
                </h3>
                {isEditing && editingPerson ? (
                  <div className="space-y-2">
                    <Input
                      value={editingPerson.homeBaseCity}
                      onChange={(e) =>
                        setEditingPerson({ ...editingPerson, homeBaseCity: e.target.value })
                      }
                      placeholder="City"
                    />
                    <Input
                      value={editingPerson.homeBaseCountry}
                      onChange={(e) =>
                        setEditingPerson({ ...editingPerson, homeBaseCountry: e.target.value })
                      }
                      placeholder="Country"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">
                    {displayPerson.homeBaseCity}, {displayPerson.homeBaseCountry}
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Current Location
                </h3>
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
                  <p className="text-sm text-gray-900">
                    {displayPerson.currentCity}, {displayPerson.currentCountry}
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Primary Node</h3>
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
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-gray-900">{displayPerson.primaryNode}</p>
                )}
              </div>
            </div>

            {/* Travel Windows */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Travel & Residencies ({personTravelWindows.length})
                </h3>
                {isEditing && isAdmin && (
                  <Button
                    size="sm"
                    onClick={handleAddTravelWindow}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Travel Window
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
                    <p className="text-sm text-gray-500 italic">No travel windows</p>
                  ) : (
                    personTravelWindows.map((tw) => (
                      <div
                        key={tw.id}
                        className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h4 className="text-base font-semibold text-gray-900 mb-1">
                              {tw.title}
                            </h4>
                            <p className="text-sm text-gray-700">
                              {tw.city}, {tw.country}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {tw.type}
                            </Badge>
                            {isEditing && isAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditTravelWindow(tw)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTravelWindow(tw)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDateRange(tw.startDate, tw.endDate)}</span>
                        </div>
                        {tw.notes && (
                          <p className="text-sm text-gray-600 mt-3 italic">{tw.notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="pt-6 border-t border-gray-200 pb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact & Links</h3>
              {isEditing && editingPerson ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="contact">Contact/Handle</Label>
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
                    <Label htmlFor="profileUrl">Profile URL</Label>
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
                <div className="flex flex-wrap gap-3">
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
                      className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                    >
                      {displayPerson.contactUrlOrHandle.includes("@") && 
                       !displayPerson.contactUrlOrHandle.startsWith("@") ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      {displayPerson.contactUrlOrHandle.startsWith("@")
                        ? displayPerson.contactUrlOrHandle
                        : "Contact"}
                    </a>
                  )}
                  {displayPerson.profileUrl && (
                    <a
                      href={displayPerson.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                    >
                      <Globe className="h-4 w-4" />
                      View on Foresight.org
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Spacer for extra scrollable space */}
            <div className="h-24 md:h-32"></div>
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
