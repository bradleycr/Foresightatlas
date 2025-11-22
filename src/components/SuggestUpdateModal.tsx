import { useState, useMemo, useEffect, useRef } from "react";
import { X, Search, ChevronDown, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { ChangeType, Person } from "../types";
import { activeMultiGradient } from "../styles/gradients";

interface SuggestUpdateModalProps {
  onClose: () => void;
  onSubmit: (suggestion: any) => void;
  people?: Person[]; // Optional list of all people for search
}

export function SuggestUpdateModal({ onClose, onSubmit, people = [] }: SuggestUpdateModalProps) {
  const [formData, setFormData] = useState({
    personName: "",
    personEmailOrHandle: "",
    selectedPersonId: "",
    alreadyInSystem: "no",
    changeType: "New entry" as ChangeType,
    // New entry fields
    projectTagline: "",
    focusAreas: "",
    homeBaseCity: "",
    homeBaseCountry: "",
    // Update location fields
    currentCity: "",
    currentCountry: "",
    fromDate: "",
    // Add trip fields
    tripCity: "",
    tripCountry: "",
    tripStartDate: "",
    tripEndDate: "",
    tripNotes: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowPersonDropdown(false);
      }
    };

    if (showPersonDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPersonDropdown]);

  // Filter people based on search query
  const filteredPeople = useMemo(() => {
    if (!people || people.length === 0) return [];
    
    if (!personSearchQuery.trim()) return people.slice(0, 10); // Show first 10 if no search
    
    const query = personSearchQuery.toLowerCase();
    return people
      .filter((person) => 
        person.fullName.toLowerCase().includes(query) ||
        person.contactUrlOrHandle?.toLowerCase().includes(query) ||
        person.currentCity.toLowerCase().includes(query)
      )
      .slice(0, 10); // Limit to 10 results
  }, [people, personSearchQuery]);

  // Handle person selection
  const handlePersonSelect = (person: Person) => {
    setFormData({
      ...formData,
      personName: person.fullName,
      personEmailOrHandle: person.contactUrlOrHandle || "",
      selectedPersonId: person.id,
    });
    setPersonSearchQuery(person.fullName);
    setShowPersonDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate person selection if already in system
    if (formData.alreadyInSystem === "yes") {
      if (!formData.selectedPersonId) {
        alert("Please search for and select yourself from the list.");
        return;
      }
      // Ensure name and email are set from selected person
      const selectedPerson = (people || []).find(p => p.id === formData.selectedPersonId);
      if (selectedPerson) {
        setFormData({
          ...formData,
          personName: selectedPerson.fullName,
          personEmailOrHandle: selectedPerson.contactUrlOrHandle || "",
        });
        // Use the updated formData for submission
        const updatedFormData = {
          ...formData,
          personName: selectedPerson.fullName,
          personEmailOrHandle: selectedPerson.contactUrlOrHandle || "",
        };
        return handleSubmitWithData(updatedFormData);
      }
    }
    
    handleSubmitWithData(formData);
  };

  const handleSubmitWithData = (data: typeof formData) => {
    // Build payload based on change type
    let payload: any = {};

    if (data.changeType === "New entry") {
      payload = {
        projectTagline: data.projectTagline,
        focusAreas: data.focusAreas.split(",").map((s) => s.trim()),
        homeBaseCity: data.homeBaseCity,
        homeBaseCountry: data.homeBaseCountry,
      };
    } else if (data.changeType === "Update location") {
      payload = {
        currentCity: data.currentCity,
        currentCountry: data.currentCountry,
        fromDate: data.fromDate,
      };
    } else if (data.changeType === "Add travel window") {
      payload = {
        city: data.tripCity,
        country: data.tripCountry,
        startDate: data.tripStartDate,
        endDate: data.tripEndDate,
        notes: data.tripNotes,
      };
    }

    const suggestion = {
      id: `sugg-${Date.now()}`,
      personName: data.personName,
      personEmailOrHandle: data.personEmailOrHandle,
      requestedChangeType: data.changeType,
      requestedPayload: payload,
      createdAt: new Date().toISOString(),
      status: "Pending",
    };

    onSubmit(suggestion);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center z-[99999] p-4" 
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
        onClick={onClose}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative z-[99999]" onClick={(e) => e.stopPropagation()}>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-teal-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-gray-900">Update Submitted!</h3>
            <p className="text-sm text-gray-600">
              Thanks – your update has been recorded for review by an admin. You'll be
              contacted once it's processed.
            </p>
            <Button onClick={onClose} className="w-full bg-teal-500 hover:bg-teal-600">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[99999] p-4" 
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
      onClick={(e) => {
        // Close dropdown if clicking outside
        if (e.target === e.currentTarget) {
          setShowPersonDropdown(false);
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-[99999]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-gray-900">Suggest an Update</h2>
            <p className="text-sm text-gray-600 mt-1">
              Foresight fellows & grantees can suggest updates to their location or travel
              plans. A node manager will review and publish approved changes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-4"
          >
            <X className="size-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label>Are you already in the system?</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alreadyInSystem"
                    value="yes"
                    checked={formData.alreadyInSystem === "yes"}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        alreadyInSystem: e.target.value,
                        personName: "",
                        personEmailOrHandle: "",
                        selectedPersonId: ""
                      });
                      setPersonSearchQuery("");
                    }}
                    className="text-teal-500"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="alreadyInSystem"
                    value="no"
                    checked={formData.alreadyInSystem === "no"}
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        alreadyInSystem: e.target.value,
                        personName: "",
                        personEmailOrHandle: "",
                        selectedPersonId: ""
                      });
                      setPersonSearchQuery("");
                      setShowPersonDropdown(false);
                    }}
                    className="text-teal-500"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
            </div>

            {formData.alreadyInSystem === "yes" ? (
              <div className="relative">
                <Label>Search for yourself *</Label>
                {!people || !Array.isArray(people) || people.length === 0 ? (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Loading people list...</p>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Type your name, email, or city to search..."
                        value={personSearchQuery}
                        onChange={(e) => {
                          setPersonSearchQuery(e.target.value);
                          setShowPersonDropdown(true);
                        }}
                        onFocus={() => setShowPersonDropdown(true)}
                        className="pl-10 pr-10"
                        required={formData.alreadyInSystem === "yes"}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                      
                      {/* Dropdown results */}
                      {showPersonDropdown && Array.isArray(filteredPeople) && filteredPeople.length > 0 && (
                        <div 
                          ref={dropdownRef}
                          className="absolute z-[100000] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                        >
                          {filteredPeople.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => handlePersonSelect(person)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{person.fullName}</div>
                                <div className="text-sm text-gray-500">
                                  {person.roleType} · {person.contactUrlOrHandle || person.currentCity}
                                </div>
                              </div>
                              {formData.selectedPersonId === person.id && (
                                <Check className="size-4 text-teal-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {showPersonDropdown && personSearchQuery && Array.isArray(filteredPeople) && filteredPeople.length === 0 && (
                        <div 
                          ref={dropdownRef}
                          className="absolute z-[100000] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-sm text-gray-500"
                        >
                          No matches found. Try a different search term.
                        </div>
                      )}
                    </div>
                    {formData.selectedPersonId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {formData.personName}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="personName">Full Name *</Label>
                  <Input
                    id="personName"
                    required
                    value={formData.personName}
                    onChange={(e) =>
                      setFormData({ ...formData, personName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="personEmail">Email or Preferred Contact *</Label>
                  <Input
                    id="personEmail"
                    type="email"
                    required
                    value={formData.personEmailOrHandle}
                    onChange={(e) =>
                      setFormData({ ...formData, personEmailOrHandle: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            <div>
              <Label>Type of Change *</Label>
              <div className="flex flex-col gap-2 mt-2">
                {(["New entry", "Update location", "Add travel window"] as ChangeType[]).map(
                  (type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="changeType"
                        value={type}
                        checked={formData.changeType === type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            changeType: e.target.value as ChangeType,
                          })
                        }
                        className="text-teal-500"
                      />
                      <span className="text-sm text-gray-700">{type}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Conditional Fields */}
          {formData.changeType === "New entry" && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-gray-900">New Entry Details</h3>
              <div>
                <Label htmlFor="projectTagline">Project Tagline (one sentence) *</Label>
                <Input
                  id="projectTagline"
                  required
                  value={formData.projectTagline}
                  onChange={(e) =>
                    setFormData({ ...formData, projectTagline: e.target.value })
                  }
                  placeholder="Brief description of your project"
                />
              </div>
              <div>
                <Label htmlFor="focusAreas">
                  Focus Areas (comma-separated) *
                </Label>
                <Input
                  id="focusAreas"
                  required
                  value={formData.focusAreas}
                  onChange={(e) =>
                    setFormData({ ...formData, focusAreas: e.target.value })
                  }
                  placeholder="e.g., Secure AI, Neurotechnology"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="homeBaseCity">Home Base City *</Label>
                  <Input
                    id="homeBaseCity"
                    required
                    value={formData.homeBaseCity}
                    onChange={(e) =>
                      setFormData({ ...formData, homeBaseCity: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="homeBaseCountry">Home Base Country *</Label>
                  <Input
                    id="homeBaseCountry"
                    required
                    value={formData.homeBaseCountry}
                    onChange={(e) =>
                      setFormData({ ...formData, homeBaseCountry: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {formData.changeType === "Update location" && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-gray-900">Update Current Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentCity">Current City *</Label>
                  <Input
                    id="currentCity"
                    required
                    value={formData.currentCity}
                    onChange={(e) =>
                      setFormData({ ...formData, currentCity: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="currentCountry">Current Country *</Label>
                  <Input
                    id="currentCountry"
                    required
                    value={formData.currentCountry}
                    onChange={(e) =>
                      setFormData({ ...formData, currentCountry: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="fromDate">From Date *</Label>
                <Input
                  id="fromDate"
                  type="date"
                  required
                  value={formData.fromDate}
                  onChange={(e) =>
                    setFormData({ ...formData, fromDate: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {formData.changeType === "Add travel window" && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="text-gray-900">Add Future Trip</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tripCity">City *</Label>
                  <Input
                    id="tripCity"
                    required
                    value={formData.tripCity}
                    onChange={(e) =>
                      setFormData({ ...formData, tripCity: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tripCountry">Country *</Label>
                  <Input
                    id="tripCountry"
                    required
                    value={formData.tripCountry}
                    onChange={(e) =>
                      setFormData({ ...formData, tripCountry: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tripStartDate">Start Date *</Label>
                  <Input
                    id="tripStartDate"
                    type="date"
                    required
                    value={formData.tripStartDate}
                    onChange={(e) =>
                      setFormData({ ...formData, tripStartDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tripEndDate">End Date *</Label>
                  <Input
                    id="tripEndDate"
                    type="date"
                    required
                    value={formData.tripEndDate}
                    onChange={(e) =>
                      setFormData({ ...formData, tripEndDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tripNotes">Notes (optional)</Label>
                <Textarea
                  id="tripNotes"
                  value={formData.tripNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, tripNotes: e.target.value })
                  }
                  placeholder="e.g., Conference presentation, research collaboration"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 text-gray-900 font-medium"
              style={{
                background: activeMultiGradient,
              }}
            >
              Submit Update
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
