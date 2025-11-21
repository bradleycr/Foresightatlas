import { useState } from "react";
import { X, Check, XCircle, Clock } from "lucide-react";
import { LocationSuggestion } from "../types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface AdminPanelProps {
  suggestions: LocationSuggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
}

export function AdminPanel({
  suggestions,
  onAccept,
  onReject,
  onClose,
}: AdminPanelProps) {
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<LocationSuggestion | null>(null);

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

  const renderPayloadSummary = (suggestion: LocationSuggestion) => {
    const payload = suggestion.requestedPayload;

    if (suggestion.requestedChangeType === "New entry") {
      return (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-gray-600">Project:</span>{" "}
            <span className="text-gray-900">{payload.projectTagline}</span>
          </p>
          <p>
            <span className="text-gray-600">Focus:</span>{" "}
            <span className="text-gray-900">{payload.focusAreas?.join(", ")}</span>
          </p>
          <p>
            <span className="text-gray-600">Home base:</span>{" "}
            <span className="text-gray-900">
              {payload.homeBaseCity}, {payload.homeBaseCountry}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-gray-900">Admin Panel</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve location update requests
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="size-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Pending Suggestions */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="size-5 text-amber-500" />
              <h3 className="text-gray-900">Pending Requests</h3>
              <Badge variant="secondary">{pendingSuggestions.length}</Badge>
            </div>

            {pendingSuggestions.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                No pending requests
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
                            <p className="text-gray-900">{suggestion.personName}</p>
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

          {/* Processed Suggestions */}
          {processedSuggestions.length > 0 && (
            <div>
              <h3 className="text-gray-900 mb-4">Processed Requests</h3>
              <div className="space-y-2">
                {processedSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`bg-gray-50 rounded-lg p-4 ${
                      suggestion.status === "Rejected" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm text-gray-900">
                            {suggestion.personName}
                          </p>
                          <Badge
                            variant={
                              suggestion.status === "Accepted" ? "default" : "secondary"
                            }
                            className={
                              suggestion.status === "Accepted"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-700"
                            }
                          >
                            {suggestion.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          {suggestion.requestedChangeType} ·{" "}
                          {formatDate(suggestion.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> When you accept a suggestion in this prototype, it
            updates the in-memory data. In production, this would:
            <br />
            • Call a Supabase API to update the database
            <br />
            • Send a notification email to the submitter
            <br />• Log the admin action for audit purposes
          </p>
        </div>
      </div>
    </div>
  );
}
