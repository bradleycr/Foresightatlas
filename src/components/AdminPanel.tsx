/**
 * Updates Panel Component
 * 
 * Admin interface for reviewing suggested updates and managing data:
 * - Location Suggestions (approve/reject pending requests)
 * - People Management (create, read, update, delete)
 * - Travel Windows Management (create, read, update, delete)
 * 
 * Note: The entire admin view is "admin" - this panel specifically handles updates and suggestions.
 * Beautiful, modular design with elegant mobile styling.
 */

import { useState } from "react";
import {
  X,
  Check,
  XCircle,
  Clock,
  Users,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Save,
} from "lucide-react";
import { Z_INDEX_MODAL_BACKDROP, Z_INDEX_MODAL_CONTENT } from "../constants/zIndex";
import { Person, TravelWindow, LocationSuggestion, RoleType, PrimaryNode, TravelWindowType } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
  addPerson,
  updatePerson,
  deletePerson,
  addTravelWindow,
  updateTravelWindow,
  deleteTravelWindow,
  generatePersonId,
  generateTravelWindowId,
} from "../services/database";
import { geocodeCity } from "../services/geocoding";
import { toast } from "sonner";
import { getNodeLabel } from "../utils/nodeLabels";
import { effectiveIsAlumni } from "../utils/cohortLabel";

interface AdminPanelProps {
  people: Person[];
  travelWindows: TravelWindow[];
  suggestions: LocationSuggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onPersonUpdate: () => Promise<void>;
  onPersonDelete: () => Promise<void>;
  onTravelWindowUpdate: () => Promise<void>;
  onTravelWindowDelete: () => Promise<void>;
  onClose: () => void;
}

export function AdminPanel({
  people,
  travelWindows,
  suggestions,
  onAccept,
  onReject,
  onPersonUpdate,
  onPersonDelete,
  onTravelWindowUpdate,
  onTravelWindowDelete,
  onClose,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"suggestions" | "people" | "travel">(
    "suggestions"
  );
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingTravelWindow, setEditingTravelWindow] =
    useState<TravelWindow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "person" | "travelWindow";
    id: string;
    name: string;
  } | null>(null);

  const pendingSuggestions = suggestions.filter((s) => s.status === "Pending");
  const processedSuggestions = suggestions.filter((s) => s.status !== "Pending");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Person CRUD handlers
  const handleAddPerson = () => {
    const newPerson: Person = {
      id: generatePersonId(),
      fullName: "",
      roleType: "Fellow",
      fellowshipCohortYear: new Date().getFullYear(),
      fellowshipEndYear: null,
      affiliationOrInstitution: null,
      focusTags: [],
      currentCity: "",
      currentCountry: "",
      currentCoordinates: { lat: 0, lng: 0 },
      primaryNode: "Global",
      profileUrl: "",
      contactUrlOrHandle: null,
      shortProjectTagline: "",
      expandedProjectDescription: "",
      isAlumni: false,
    };
    setEditingPerson(newPerson);
    setActiveTab("people");
  };

  const handleEditPerson = (person: Person) => {
    setEditingPerson({ ...person });
  };

  const handleSavePerson = async () => {
    if (!editingPerson) return;

    try {
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

      if (people.find((p) => p.id === personToSave.id)) {
        // Update existing
        await updatePerson(personToSave.id, personToSave);
        toast.success("Person updated successfully");
      } else {
        // Add new
        await addPerson(personToSave);
        toast.success("Person added successfully");
      }
      setEditingPerson(null);
      await onPersonUpdate();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save person";
      toast.error("Failed to save person", {
        description: errorMessage,
      });
    }
  };

  const handleDeletePerson = (person: Person) => {
    setDeleteTarget({
      type: "person",
      id: person.id,
      name: person.fullName,
    });
    setShowDeleteDialog(true);
  };

  const confirmDeletePerson = async () => {
    if (!deleteTarget || deleteTarget.type !== "person") return;

    try {
      await deletePerson(deleteTarget.id);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      await onPersonDelete();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete person";
      toast.error("Failed to delete person", {
        description: errorMessage,
      });
    }
  };

  // Travel Window CRUD handlers
  const handleAddTravelWindow = () => {
    const today = new Date().toISOString().split("T")[0];
    const newTravelWindow: TravelWindow = {
      id: generateTravelWindowId(),
      personId: people[0]?.id || "",
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
    setActiveTab("travel");
  };

  const handleEditTravelWindow = (travelWindow: TravelWindow) => {
    setEditingTravelWindow({ ...travelWindow });
  };

  const handleSaveTravelWindow = async () => {
    if (!editingTravelWindow) return;

    try {
      // Validate required fields
      if (!editingTravelWindow.personId) {
        toast.error("Person is required");
        return;
      }
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

      if (
        travelWindows.find((tw) => tw.id === travelWindowToSave.id)
      ) {
        // Update existing
        await updateTravelWindow(
          travelWindowToSave.id,
          travelWindowToSave
        );
        toast.success("Travel window updated successfully");
      } else {
        // Add new
        await addTravelWindow(travelWindowToSave);
        toast.success("Travel window added successfully");
      }
      setEditingTravelWindow(null);
      await onTravelWindowUpdate();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save travel window";
      toast.error("Failed to save travel window", {
        description: errorMessage,
      });
    }
  };

  const handleDeleteTravelWindow = (travelWindow: TravelWindow) => {
    setDeleteTarget({
      type: "travelWindow",
      id: travelWindow.id,
      name: travelWindow.title,
    });
    setShowDeleteDialog(true);
  };

  const confirmDeleteTravelWindow = async () => {
    if (!deleteTarget || deleteTarget.type !== "travelWindow") return;

    try {
      await deleteTravelWindow(deleteTarget.id);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      await onTravelWindowDelete();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to delete travel window";
      toast.error("Failed to delete travel window", {
        description: errorMessage,
      });
    }
  };

  const renderPayloadSummary = (suggestion: LocationSuggestion) => {
    const payload = suggestion.requestedPayload;

    if (suggestion.requestedChangeType === "New entry") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600">Details:</span>{" "}
            <span className="text-gray-900">{payload.projectTagline}</span>
          </p>
          <p>
            <span className="text-gray-600">Focus:</span>{" "}
            <span className="text-gray-900">{payload.focusAreas?.join(", ")}</span>
          </p>
          <p>
            <span className="text-gray-600">Location:</span>{" "}
            <span className="text-gray-900">
              {payload.currentCity}, {payload.currentCountry}
            </span>
          </p>
        </div>
      );
    } else if (suggestion.requestedChangeType === "Update location") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600">New location:</span>{" "}
            <span className="text-gray-900">
              {payload.currentCity}, {payload.currentCountry}
            </span>
          </p>
          <p>
            <span className="text-gray-600">From:</span>{" "}
            <span className="text-gray-900">
              {new Date(payload.fromDate).toLocaleDateString()}
            </span>
          </p>
        </div>
      );
    } else if (suggestion.requestedChangeType === "Add travel window") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600">Destination:</span>{" "}
            <span className="text-gray-900">
              {payload.city}, {payload.country}
            </span>
          </p>
          <p>
            <span className="text-gray-600">Dates:</span>{" "}
            <span className="text-gray-900">
              {new Date(payload.startDate).toLocaleDateString()} -{" "}
              {new Date(payload.endDate).toLocaleDateString()}
            </span>
          </p>
          {payload.notes && (
            <p>
              <span className="text-gray-600">Notes:</span>{" "}
              <span className="text-gray-900">{payload.notes}</span>
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: Z_INDEX_MODAL_BACKDROP,
        }}
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col relative"
          style={{ zIndex: Z_INDEX_MODAL_CONTENT }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Updates Panel</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review suggested updates and manage people and travel windows
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1.5 transition-colors"
              aria-label="Close panel"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="px-6 pt-4 border-b border-gray-200">
                <TabsList className="grid w-full max-w-lg grid-cols-3 gap-1">
                  <TabsTrigger value="suggestions" className="flex items-center gap-2">
                    <Clock className="size-4" />
                    <span className="hidden sm:inline">Suggestions</span>
                    {pendingSuggestions.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {pendingSuggestions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="people" className="flex items-center gap-2">
                    <Users className="size-4" />
                    <span className="hidden sm:inline">People</span>
                  </TabsTrigger>
                  <TabsTrigger value="travel" className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    <span className="hidden sm:inline">Travel</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Suggestions Tab */}
                <TabsContent value="suggestions" className="mt-0 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="size-5 text-amber-500" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pending Requests
                      </h3>
                      {pendingSuggestions.length > 0 && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          {pendingSuggestions.length}
                        </Badge>
                      )}
                    </div>

                    {pendingSuggestions.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-12 text-center">
                        <Clock className="size-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No pending requests</p>
                        <p className="text-sm text-gray-400 mt-1">All suggestions have been processed</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {suggestion.personName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {suggestion.personEmailOrHandle}
                                    </p>
                                  </div>
                                  <Badge className="bg-amber-100 text-amber-800">
                                    {suggestion.requestedChangeType}
                                  </Badge>
                                </div>

                                {renderPayloadSummary(suggestion)}

                                <p className="text-xs text-gray-500">
                                  Submitted {formatDate(suggestion.createdAt)}
                                </p>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => onAccept(suggestion.id)}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check className="size-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  onClick={() => onReject(suggestion.id)}
                                  size="sm"
                                  variant="outline"
                                  className="border-red-300 text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="size-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {processedSuggestions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Processed Requests
                      </h3>
                      <div className="space-y-2">
                        {processedSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.id}
                            className={`bg-gray-50 rounded-lg p-4 ${
                              suggestion.status === "Rejected" ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-900">
                                {suggestion.personName}
                              </p>
                              <Badge
                                variant={
                                  suggestion.status === "Accepted"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  suggestion.status === "Accepted"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-200 text-gray-700"
                                }
                              >
                                {suggestion.status}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {suggestion.requestedChangeType} ·{" "}
                                {formatDate(suggestion.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* People Tab */}
                <TabsContent value="people" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      People Management
                    </h3>
                    <Button onClick={handleAddPerson} size="sm">
                      <Plus className="size-4 mr-2" />
                      Add Person
                    </Button>
                  </div>

                  {editingPerson ? (
                    <PersonEditForm
                      person={editingPerson}
                      onChange={setEditingPerson}
                      onSave={handleSavePerson}
                      onCancel={() => setEditingPerson(null)}
                      people={people}
                    />
                  ) : (
                    <div className="space-y-3">
                      {people.map((person) => (
                        <div
                          key={person.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-medium text-gray-900">
                                  {person.fullName}
                                </p>
                                <Badge variant="outline">{person.roleType}</Badge>
                                <Badge variant="outline" className="text-xs">
                                  {person.fellowshipCohortYear
                                    ? (person.fellowshipEndYear != null
                                        ? `${person.fellowshipCohortYear}–${person.fellowshipEndYear}`
                                        : person.fellowshipCohortYear)
                                    : "—"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {person.shortProjectTagline}
                              </p>
                              <p className="text-xs text-gray-500">
                                {person.currentCity}, {person.currentCountry}
                                {!effectiveIsAlumni(person) && ` · ${getNodeLabel(person.primaryNode)}`}
                                {(person.affiliationOrInstitution ?? "").trim() && ` · ${person.affiliationOrInstitution}`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleEditPerson(person)}
                                size="sm"
                                variant="outline"
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button
                                onClick={() => handleDeletePerson(person)}
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Travel Windows Tab */}
                <TabsContent value="travel" className="mt-0 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Travel Windows Management
                    </h3>
                    <Button onClick={handleAddTravelWindow} size="sm">
                      <Plus className="size-4 mr-2" />
                      Add Travel Window
                    </Button>
                  </div>

                  {editingTravelWindow ? (
                    <TravelWindowEditForm
                      travelWindow={editingTravelWindow}
                      onChange={setEditingTravelWindow}
                      onSave={handleSaveTravelWindow}
                      onCancel={() => setEditingTravelWindow(null)}
                      people={people}
                      travelWindows={travelWindows}
                    />
                  ) : (
                    <div className="space-y-3">
                      {travelWindows.map((tw) => {
                        const person = people.find((p) => p.id === tw.personId);
                        return (
                          <div
                            key={tw.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-medium text-gray-900">
                                    {tw.title}
                                  </p>
                                  <Badge variant="outline">{tw.type}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                  {person?.fullName || "Unknown Person"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {tw.city}, {tw.country} ·{" "}
                                  {new Date(tw.startDate).toLocaleDateString()} -{" "}
                                  {new Date(tw.endDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleEditTravelWindow(tw)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Edit className="size-4" />
                                </Button>
                                <Button
                                  onClick={() => handleDeleteTravelWindow(tw)}
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={
                deleteTarget?.type === "person"
                  ? confirmDeletePerson
                  : confirmDeleteTravelWindow
              }
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

// Person Edit Form Component
interface PersonEditFormProps {
  person: Person;
  onChange: (person: Person) => void;
  onSave: () => void;
  onCancel: () => void;
  people: Person[];
}

function PersonEditForm({
  person,
  onChange,
  onSave,
  onCancel,
}: PersonEditFormProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={person.fullName}
            onChange={(e) => onChange({ ...person, fullName: e.target.value })}
            placeholder="Dr. Jane Doe"
          />
        </div>

        <div>
          <Label htmlFor="roleType">Role Type *</Label>
          <Select
            value={person.roleType}
            onValueChange={(value: RoleType) =>
              onChange({ ...person, roleType: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fellow">Fellow</SelectItem>
              <SelectItem value="Senior Fellow">Senior Fellow</SelectItem>
              <SelectItem value="Grantee">Grantee</SelectItem>
              <SelectItem value="Prize Winner">Prize Winner</SelectItem>
              <SelectItem value="Nodee">Nodee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="cohortYear">Cohort Year (start; 0 or blank = unknown / all-time)</Label>
          <Input
            id="cohortYear"
            type="number"
            value={person.fellowshipCohortYear || ""}
            placeholder="e.g. 2024"
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({
                ...person,
                fellowshipCohortYear: v === "" ? 0 : parseInt(e.target.value, 10) || 0,
              });
            }}
          />
        </div>

        <div>
          <Label htmlFor="cohortEndYear">End Year (optional, for alumni)</Label>
          <Input
            id="cohortEndYear"
            type="number"
            placeholder="Leave blank if ongoing"
            value={person.fellowshipEndYear ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onChange({
                ...person,
                fellowshipEndYear: v === "" ? null : parseInt(v, 10) || null,
              });
            }}
          />
        </div>

        <div>
          <Label htmlFor="affiliation">Affiliation / Institution</Label>
          <Input
            id="affiliation"
            value={person.affiliationOrInstitution ?? ""}
            onChange={(e) =>
              onChange({
                ...person,
                affiliationOrInstitution: e.target.value.trim() || null,
              })
            }
            placeholder="University, company, or institution"
          />
        </div>

        <div>
          <Label htmlFor="primaryNode">Primary Node *</Label>
          <Select
            value={person.primaryNode}
            onValueChange={(value: PrimaryNode) =>
              onChange({ ...person, primaryNode: value })
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
        </div>

        <div>
          <Label htmlFor="currentCity">City *</Label>
          <Input
            id="currentCity"
            value={person.currentCity}
            onChange={(e) =>
              onChange({ ...person, currentCity: e.target.value })
            }
            placeholder="San Francisco"
          />
        </div>

        <div>
          <Label htmlFor="currentCountry">Country (optional)</Label>
          <Input
            id="currentCountry"
            value={person.currentCountry}
            onChange={(e) =>
              onChange({ ...person, currentCountry: e.target.value })
            }
            placeholder="USA"
          />
        </div>

        <div>
          <Label htmlFor="currentLat">Current Latitude</Label>
          <Input
            id="currentLat"
            type="number"
            step="any"
            value={person.currentCoordinates.lat}
            onChange={(e) =>
              onChange({
                ...person,
                currentCoordinates: {
                  ...person.currentCoordinates,
                  lat: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="currentLng">Current Longitude</Label>
          <Input
            id="currentLng"
            type="number"
            step="any"
            value={person.currentCoordinates.lng}
            onChange={(e) =>
              onChange({
                ...person,
                currentCoordinates: {
                  ...person.currentCoordinates,
                  lng: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="profileUrl">Profile URL</Label>
          <Input
            id="profileUrl"
            type="url"
            value={person.profileUrl}
            onChange={(e) =>
              onChange({ ...person, profileUrl: e.target.value })
            }
            placeholder="https://foresight.org/fellow/..."
          />
        </div>

        <div>
          <Label htmlFor="contact">Contact/Handle</Label>
          <Input
            id="contact"
            value={person.contactUrlOrHandle || ""}
            onChange={(e) =>
              onChange({
                ...person,
                contactUrlOrHandle: e.target.value || null,
              })
            }
            placeholder="@username or email"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="tagline">Short tagline *</Label>
        <Input
          id="tagline"
          value={person.shortProjectTagline}
          onChange={(e) =>
            onChange({ ...person, shortProjectTagline: e.target.value })
          }
          placeholder="One sentence about their work or focus"
        />
      </div>

      <div>
        <Label htmlFor="description">Details (full description)</Label>
        <Textarea
          id="description"
          value={person.expandedProjectDescription}
          onChange={(e) =>
            onChange({
              ...person,
              expandedProjectDescription: e.target.value,
            })
          }
          rows={4}
          placeholder="About them, their work, research, or project"
        />
      </div>

      <div>
        <Label htmlFor="focusTags">Focus Tags (comma-separated)</Label>
        <Input
          id="focusTags"
          value={person.focusTags.join(", ")}
          onChange={(e) =>
            onChange({
              ...person,
              focusTags: e.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0),
            })
          }
          placeholder="Secure AI, Longevity Biotechnology"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isAlumni"
          checked={person.isAlumni}
          onChange={(e) =>
            onChange({ ...person, isAlumni: e.target.checked })
          }
          className="rounded"
        />
        <Label htmlFor="isAlumni" className="cursor-pointer">
          Is Alumni
        </Label>
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={onSave} className="flex-1">
          <Save className="size-4 mr-2" />
          Save
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Travel Window Edit Form Component
interface TravelWindowEditFormProps {
  travelWindow: TravelWindow;
  onChange: (travelWindow: TravelWindow) => void;
  onSave: () => void;
  onCancel: () => void;
  people: Person[];
  travelWindows: TravelWindow[];
}

function TravelWindowEditForm({
  travelWindow,
  onChange,
  onSave,
  onCancel,
  people,
}: TravelWindowEditFormProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="twPersonId">Person *</Label>
          <Select
            value={travelWindow.personId}
            onValueChange={(value) =>
              onChange({ ...travelWindow, personId: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="twTitle">Title *</Label>
          <Input
            id="twTitle"
            value={travelWindow.title}
            onChange={(e) =>
              onChange({ ...travelWindow, title: e.target.value })
            }
            placeholder="Conference name or event"
          />
        </div>

        <div>
          <Label htmlFor="twCity">City *</Label>
          <Input
            id="twCity"
            value={travelWindow.city}
            onChange={(e) =>
              onChange({ ...travelWindow, city: e.target.value })
            }
            placeholder="San Francisco"
          />
        </div>

        <div>
          <Label htmlFor="twCountry">Country *</Label>
          <Input
            id="twCountry"
            value={travelWindow.country}
            onChange={(e) =>
              onChange({ ...travelWindow, country: e.target.value })
            }
            placeholder="USA"
          />
        </div>

        <div>
          <Label htmlFor="twLat">Latitude</Label>
          <Input
            id="twLat"
            type="number"
            step="any"
            value={travelWindow.coordinates.lat}
            onChange={(e) =>
              onChange({
                ...travelWindow,
                coordinates: {
                  ...travelWindow.coordinates,
                  lat: parseFloat(e.target.value) || 0,
                },
              })
            }
          />
        </div>

        <div>
          <Label htmlFor="twLng">Longitude</Label>
          <Input
            id="twLng"
            type="number"
            step="any"
            value={travelWindow.coordinates.lng}
            onChange={(e) =>
              onChange({
                ...travelWindow,
                coordinates: {
                  ...travelWindow.coordinates,
                  lng: parseFloat(e.target.value) || 0,
                },
              })
            }
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
                startDate: e.target.value, // Store as date string (YYYY-MM-DD)
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
                endDate: e.target.value, // Store as date string (YYYY-MM-DD)
              })
            }
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
      </div>

      <div>
        <Label htmlFor="twNotes">Notes</Label>
        <Textarea
          id="twNotes"
          value={travelWindow.notes}
          onChange={(e) =>
            onChange({ ...travelWindow, notes: e.target.value })
          }
          rows={3}
          placeholder="Additional details about this travel window"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={onSave} className="flex-1">
          <Save className="size-4 mr-2" />
          Save
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
