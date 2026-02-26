/**
 * Shared schema for the Foresight Map Google Sheet.
 * Sheet ID: 1kE0ogroOgXFBEH8y1qREU940ux41RUiLNE_rowXXAnQ
 *
 * Four tabs: People, TravelWindows, Suggestions, AdminUsers.
 * Row 1 = headers; data from row 2. Arrays/objects stored as JSON strings.
 */

const SHEET_NAMES = {
  PEOPLE: "People",
  TRAVEL_WINDOWS: "TravelWindows",
  SUGGESTIONS: "Suggestions",
  ADMIN_USERS: "AdminUsers",
  RSVPS: "RSVPs",
  EVENTS: "Events",
};

const PEOPLE_HEADERS = [
  "id",
  "fullName",
  "roleType",
  "fellowshipCohortYear",
  "fellowshipEndYear",
  "affiliationOrInstitution",
  "focusTags",
  "currentCity",
  "currentCountry",
  "lat",
  "lng",
  "primaryNode",
  "profileUrl",
  "contactUrlOrHandle",
  "shortProjectTagline",
  "expandedProjectDescription",
  "isAlumni",
];

const TRAVEL_WINDOWS_HEADERS = [
  "id",
  "personId",
  "title",
  "city",
  "country",
  "lat",
  "lng",
  "startDate",
  "endDate",
  "type",
  "notes",
];

const SUGGESTIONS_HEADERS = [
  "id",
  "personName",
  "personEmailOrHandle",
  "requestedChangeType",
  "requestedPayload",
  "createdAt",
  "status",
];

const ADMIN_USERS_HEADERS = ["id", "displayName", "email", "passwordPlaceholder"];

const RSVPS_HEADERS = [
  "eventId",
  "eventTitle",
  "personId",
  "fullName",
  "status",
  "createdAt",
  "updatedAt",
];

const EVENTS_HEADERS = [
  "id",
  "nodeSlug",
  "title",
  "description",
  "location",
  "startAt",
  "endAt",
  "type",
  "tags",
  "visibility",
  "capacity",
  "externalLink",
  "recurrenceGroupId",
  "lumaEventId",
];

module.exports = {
  SHEET_NAMES,
  PEOPLE_HEADERS,
  TRAVEL_WINDOWS_HEADERS,
  SUGGESTIONS_HEADERS,
  ADMIN_USERS_HEADERS,
  RSVPS_HEADERS,
  EVENTS_HEADERS,
};
