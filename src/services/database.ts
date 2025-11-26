/**
 * Database Service
 * 
 * Handles all API calls to the backend database server.
 * The server runs on port 3001 and provides a simple JSON-based database.
 */

import { Person, TravelWindow, LocationSuggestion, AdminUser } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

/**
 * Fetch the entire database from the server
 */
async function fetchDatabase(): Promise<{
  people: Person[];
  travelWindows: TravelWindow[];
  suggestions: LocationSuggestion[];
  adminUsers: AdminUser[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/database`);
  if (!response.ok) {
    throw new Error(`Failed to fetch database: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Save the entire database to the server
 */
async function saveDatabase(database: {
  people: Person[];
  travelWindows: TravelWindow[];
  suggestions: LocationSuggestion[];
  adminUsers: AdminUser[];
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/database`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(database),
  });
  if (!response.ok) {
    throw new Error(`Failed to save database: ${response.statusText}`);
  }
}

// People operations
export async function getAllPeople(): Promise<Person[]> {
  const database = await fetchDatabase();
  return database.people || [];
}

export async function addPerson(person: Person): Promise<void> {
  const database = await fetchDatabase();
  database.people.push(person);
  await saveDatabase(database);
}

export async function updatePerson(id: string, updates: Partial<Person>): Promise<void> {
  const database = await fetchDatabase();
  const index = database.people.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Person with id ${id} not found`);
  }
  database.people[index] = { ...database.people[index], ...updates };
  await saveDatabase(database);
}

export async function deletePerson(id: string): Promise<void> {
  const database = await fetchDatabase();
  database.people = database.people.filter((p) => p.id !== id);
  // Also delete associated travel windows
  database.travelWindows = database.travelWindows.filter((tw) => tw.personId !== id);
  await saveDatabase(database);
}

// Travel Windows operations
export async function getAllTravelWindows(): Promise<TravelWindow[]> {
  const database = await fetchDatabase();
  return database.travelWindows || [];
}

export async function addTravelWindow(travelWindow: TravelWindow): Promise<void> {
  const database = await fetchDatabase();
  database.travelWindows.push(travelWindow);
  await saveDatabase(database);
}

export async function updateTravelWindow(
  id: string,
  updates: Partial<TravelWindow>
): Promise<void> {
  const database = await fetchDatabase();
  const index = database.travelWindows.findIndex((tw) => tw.id === id);
  if (index === -1) {
    throw new Error(`Travel window with id ${id} not found`);
  }
  database.travelWindows[index] = {
    ...database.travelWindows[index],
    ...updates,
  };
  await saveDatabase(database);
}

export async function deleteTravelWindow(id: string): Promise<void> {
  const database = await fetchDatabase();
  database.travelWindows = database.travelWindows.filter((tw) => tw.id !== id);
  await saveDatabase(database);
}

// Suggestions operations
export async function getAllSuggestions(): Promise<LocationSuggestion[]> {
  const database = await fetchDatabase();
  return database.suggestions || [];
}

export async function addSuggestion(suggestion: LocationSuggestion): Promise<void> {
  // Validate suggestion structure
  if (!suggestion.id || !suggestion.personName || !suggestion.personEmailOrHandle) {
    throw new Error("Invalid suggestion: missing required fields");
  }
  if (!suggestion.requestedChangeType || !suggestion.requestedPayload) {
    throw new Error("Invalid suggestion: missing change type or payload");
  }
  if (!['Pending', 'Accepted', 'Rejected'].includes(suggestion.status)) {
    throw new Error("Invalid suggestion: invalid status");
  }

  const database = await fetchDatabase();
  if (!database.suggestions) {
    database.suggestions = [];
  }
  
  // Check for duplicate IDs (shouldn't happen with proper ID generation, but safety check)
  if (database.suggestions.some(s => s.id === suggestion.id)) {
    throw new Error("Suggestion with this ID already exists");
  }
  
  database.suggestions.push(suggestion);
  await saveDatabase(database);
}

export async function updateSuggestionStatus(
  id: string,
  status: LocationSuggestion["status"]
): Promise<void> {
  const database = await fetchDatabase();
  const index = database.suggestions.findIndex((s) => s.id === id);
  if (index === -1) {
    throw new Error(`Suggestion with id ${id} not found`);
  }
  database.suggestions[index].status = status;
  await saveDatabase(database);
}

// Admin Users operations
export async function getAdminUsers(): Promise<AdminUser[]> {
  const database = await fetchDatabase();
  return database.adminUsers || [];
}

// ID generation helpers
export const generatePersonId = (): string => {
  return `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateTravelWindowId = (): string => {
  return `tw${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateSuggestionId = (): string => {
  return `s${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
