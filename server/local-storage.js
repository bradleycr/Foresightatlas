"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { geocodeCity } = require("./geocoding");
const {
  DEFAULT_DIRECTORY_PASSWORD,
  issueDirectorySession,
  verifyPasswordHash,
  hashPassword,
} = require("./directory-auth");

const MOCK_DIR = path.resolve(__dirname, "../mock");
const DATABASE_FILE = path.join(MOCK_DIR, "database.local.json");
const AUTH_FILE = path.join(MOCK_DIR, "auth.local.json");
const LUMA_FILE = path.join(MOCK_DIR, "luma-events.local.json");

function hasServiceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return true;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) return false;
  return fs.existsSync(path.resolve(keyPath));
}

function hasReadOnlySheetsCredentials() {
  return Boolean(process.env.GOOGLE_SHEETS_API_KEY || process.env.GOOGLE_API_KEY);
}

function isLocalMockMode() {
  if (process.env.VERCEL) return false;
  return !hasServiceAccountCredentials() && !hasReadOnlySheetsCredentials();
}

function normalizeLocalDatabase(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  return {
    people: Array.isArray(base.people) ? base.people : [],
    travelWindows: Array.isArray(base.travelWindows) ? base.travelWindows : [],
    suggestions: Array.isArray(base.suggestions) ? base.suggestions : [],
    adminUsers: Array.isArray(base.adminUsers) ? base.adminUsers : [],
    rsvps: Array.isArray(base.rsvps) ? base.rsvps : [],
    events: Array.isArray(base.events) ? base.events : [],
    checkins: Array.isArray(base.checkins) ? base.checkins : [],
    meta: {
      updatedAt:
        base.meta && typeof base.meta === "object" && typeof base.meta.updatedAt === "string"
          ? base.meta.updatedAt
          : new Date().toISOString(),
    },
  };
}

function defaultPeople() {
  return [
    {
      id: "mock-person-alice",
      fullName: "Alice Example",
      roleType: "Fellow",
      fellowshipCohortYear: 2025,
      fellowshipEndYear: null,
      affiliationOrInstitution: "Foresight Testing",
      focusTags: ["Biosecurity", "AI Alignment"],
      currentCity: "Berlin",
      currentCountry: "Germany",
      currentCoordinates: { lat: 52.52, lng: 13.405 },
      primaryNode: "Berlin Node",
      profileUrl: "",
      profileImageUrl: null,
      contactUrlOrHandle: "@alice",
      shortProjectTagline: "Testing mock-backed local flows.",
      expandedProjectDescription: "This profile exists for local mock mode.",
      isAlumni: false,
    },
    {
      id: "mock-person-bob",
      fullName: "Bob Example",
      roleType: "Grantee",
      fellowshipCohortYear: 2024,
      fellowshipEndYear: null,
      affiliationOrInstitution: "Foresight Testing",
      focusTags: ["Longevity"],
      currentCity: "San Francisco",
      currentCountry: "United States",
      currentCoordinates: { lat: 37.7749, lng: -122.4194 },
      primaryNode: "Bay Area Node",
      profileUrl: "",
      profileImageUrl: null,
      contactUrlOrHandle: "@bob",
      shortProjectTagline: "Local storage and API integration checks.",
      expandedProjectDescription: "Second seed profile for local mock mode.",
      isAlumni: false,
    },
  ];
}

function defaultEvents() {
  return [
    {
      id: "mock-sheet-berlin-linked",
      nodeSlug: "berlin",
      title: "Berlin Coworking (Sheet Placeholder)",
      description: "This sheet row is linked to a mock Luma event.",
      location: "Foresight House Berlin",
      startAt: "2026-05-07T09:00:00.000Z",
      endAt: "2026-05-07T17:00:00.000Z",
      type: "coworking",
      tags: ["mock", "berlin"],
      visibility: "public",
      capacity: 40,
      externalLink: null,
      coverImageUrl: null,
      recurrenceGroupId: null,
      _lumaEventId: "mock-luma-berlin-1",
    },
    {
      id: "mock-sheet-sf-linked",
      nodeSlug: "sf",
      title: "SF Programming Salon (Sheet Placeholder)",
      description: "This sheet row is linked to a mock Luma event.",
      location: "Foresight House SF",
      startAt: "2026-05-15T01:00:00.000Z",
      endAt: "2026-05-15T03:00:00.000Z",
      type: "social",
      tags: ["mock", "sf"],
      visibility: "public",
      capacity: 60,
      externalLink: null,
      coverImageUrl: null,
      recurrenceGroupId: null,
      _lumaEventId: "mock-luma-sf-1",
    },
  ];
}

function defaultMockDatabase() {
  return {
    people: defaultPeople(),
    travelWindows: [],
    suggestions: [],
    adminUsers: [],
    rsvps: [],
    events: defaultEvents(),
    checkins: [],
    meta: { updatedAt: new Date().toISOString() },
  };
}

function defaultMockAuthRecords(database) {
  const auth = {};
  for (const person of database.people || []) {
    auth[person.id] = {
      passwordHash: "",
      mustChangePassword: true,
      claimedAt: "",
      lastProfileUpdatedAt: "",
      lastPasswordChangedAt: "",
    };
  }
  return auth;
}

function defaultMockLumaEvents() {
  return [
    {
      _lumaApiId: "mock-luma-berlin-1",
      id: "luma-mock-luma-berlin-1",
      nodeSlug: "berlin",
      title: "Mock Luma Berlin Coworking Day",
      description: "Mock Luma event for local testing (Berlin).",
      location: "Foresight House Berlin, Germany",
      startAt: "2026-05-07T09:30:00.000Z",
      endAt: "2026-05-07T17:30:00.000Z",
      type: "coworking",
      tags: ["mock-luma", "berlin"],
      visibility: "public",
      capacity: 55,
      externalLink: "https://lu.ma/mock-luma-berlin-1",
      coverImageUrl: null,
      recurrenceGroupId: null,
    },
    {
      _lumaApiId: "mock-luma-sf-1",
      id: "luma-mock-luma-sf-1",
      nodeSlug: "sf",
      title: "Mock Luma SF Salon",
      description: "Mock Luma event for local testing (SF).",
      location: "Foresight House SF, United States",
      startAt: "2026-05-15T01:30:00.000Z",
      endAt: "2026-05-15T03:30:00.000Z",
      type: "social",
      tags: ["mock-luma", "sf"],
      visibility: "public",
      capacity: 80,
      externalLink: "https://lu.ma/mock-luma-sf-1",
      coverImageUrl: null,
      recurrenceGroupId: null,
    },
  ];
}

async function ensureMockFiles() {
  await fsp.mkdir(MOCK_DIR, { recursive: true });

  if (!fs.existsSync(DATABASE_FILE)) {
    await fsp.writeFile(
      DATABASE_FILE,
      JSON.stringify(defaultMockDatabase(), null, 2) + "\n",
      "utf8",
    );
  }

  if (!fs.existsSync(AUTH_FILE)) {
    let database = defaultMockDatabase();
    try {
      const databaseText = await fsp.readFile(DATABASE_FILE, "utf8");
      database = normalizeLocalDatabase(JSON.parse(databaseText));
    } catch {
      // Keep default database if file cannot be read.
    }
    await fsp.writeFile(
      AUTH_FILE,
      JSON.stringify(defaultMockAuthRecords(database), null, 2) + "\n",
      "utf8",
    );
  }

  if (!fs.existsSync(LUMA_FILE)) {
    await fsp.writeFile(
      LUMA_FILE,
      JSON.stringify(defaultMockLumaEvents(), null, 2) + "\n",
      "utf8",
    );
  }
}

async function readJsonFile(filePath, fallbackFactory) {
  await ensureMockFiles();
  try {
    const text = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    const fallback = fallbackFactory();
    await fsp.writeFile(filePath, JSON.stringify(fallback, null, 2) + "\n", "utf8");
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function getLocalDatabase() {
  const raw = await readJsonFile(DATABASE_FILE, defaultMockDatabase);
  return normalizeLocalDatabase(raw);
}

async function saveLocalDatabase(database) {
  const next = normalizeLocalDatabase(database);
  next.meta.updatedAt = new Date().toISOString();
  await writeJsonFile(DATABASE_FILE, next);
}

async function getLocalAuth() {
  const database = await getLocalDatabase();
  const raw = await readJsonFile(AUTH_FILE, () => defaultMockAuthRecords(database));
  const auth = raw && typeof raw === "object" ? raw : {};
  let changed = false;

  for (const person of database.people) {
    if (!auth[person.id] || typeof auth[person.id] !== "object") {
      auth[person.id] = {
        passwordHash: "",
        mustChangePassword: true,
        claimedAt: "",
        lastProfileUpdatedAt: "",
        lastPasswordChangedAt: "",
      };
      changed = true;
    }
  }

  if (changed) await writeJsonFile(AUTH_FILE, auth);
  return auth;
}

async function saveLocalAuth(auth) {
  await writeJsonFile(AUTH_FILE, auth);
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateNewPasswordForRegister(password) {
  const p = String(password || "").trim();
  if (p.length < 8) {
    throw new Error("Choose a password with at least 8 characters.");
  }
  if (p === DEFAULT_DIRECTORY_PASSWORD) {
    throw new Error("Choose a password different from the default temporary password.");
  }
  return p;
}

function toIsoDateString(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return {
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
  };
}

async function enrichCoordinates(person) {
  const city = String(person.currentCity || "").trim();
  if (!city) {
    return {
      ...person,
      currentCity: "",
      currentCountry: "",
      currentCoordinates: { lat: 0, lng: 0 },
    };
  }
  const geocoded = await geocodeCity(city, person.currentCountry || undefined);
  if (!geocoded) {
    return {
      ...person,
      currentCoordinates: normalizeCoordinates(person.currentCoordinates),
    };
  }
  return {
    ...person,
    currentCountry: person.currentCountry || geocoded.country || "",
    currentCoordinates: { lat: geocoded.lat, lng: geocoded.lng },
  };
}

function normalizePersonForCreate(input) {
  const person = {
    id: String(input?.id || "").trim() || generateId("mock-person"),
    fullName: String(input?.fullName || "").trim(),
    roleType: String(input?.roleType || "Fellow").trim() || "Fellow",
    fellowshipCohortYear: Number.isFinite(Number(input?.fellowshipCohortYear))
      ? Number(input?.fellowshipCohortYear)
      : 0,
    fellowshipEndYear:
      input?.fellowshipEndYear === null ||
      input?.fellowshipEndYear === undefined ||
      input?.fellowshipEndYear === ""
        ? null
        : Number.isFinite(Number(input?.fellowshipEndYear))
          ? Number(input?.fellowshipEndYear)
          : null,
    affiliationOrInstitution:
      input?.affiliationOrInstitution == null ? null : String(input.affiliationOrInstitution).trim() || null,
    focusTags: Array.isArray(input?.focusTags)
      ? input.focusTags.map((v) => String(v).trim()).filter(Boolean)
      : [],
    currentCity: String(input?.currentCity || "").trim(),
    currentCountry: String(input?.currentCountry || "").trim(),
    currentCoordinates: normalizeCoordinates(input?.currentCoordinates),
    primaryNode: String(input?.primaryNode || "Global").trim() || "Global",
    profileUrl: String(input?.profileUrl || "").trim(),
    profileImageUrl:
      input?.profileImageUrl == null ? null : String(input.profileImageUrl).trim() || null,
    contactUrlOrHandle:
      input?.contactUrlOrHandle == null ? null : String(input.contactUrlOrHandle).trim() || null,
    shortProjectTagline: String(input?.shortProjectTagline || "").trim(),
    expandedProjectDescription: String(input?.expandedProjectDescription || "").trim(),
    isAlumni: Boolean(input?.isAlumni),
  };

  if (!person.fullName) throw new Error("Full name is required.");
  return person;
}

async function authenticateLocalMember(fullName, password) {
  const submittedName = String(fullName || "").trim();
  const submittedPassword = String(password || "");
  if (!submittedName) throw new Error("Full name is required.");

  const db = await getLocalDatabase();
  const auth = await getLocalAuth();
  const person = db.people.find(
    (entry) => normalizeName(entry.fullName) === normalizeName(submittedName),
  );
  if (!person) {
    throw new Error("We could not find a directory profile with that full name.");
  }

  const authEntry = auth[person.id] || {};
  const hasHash = Boolean(authEntry.passwordHash);
  const isValid = hasHash
    ? await verifyPasswordHash(submittedPassword, authEntry.passwordHash)
    : submittedPassword === DEFAULT_DIRECTORY_PASSWORD;
  if (!isValid) throw new Error("Incorrect password.");

  const session = issueDirectorySession({
    person,
    auth: { mustChangePassword: !hasHash },
  });
  return { person, auth: session };
}

async function changeLocalMemberPassword(session, currentPassword, newPassword) {
  const auth = await getLocalAuth();
  const db = await getLocalDatabase();
  const person = db.people.find((entry) => entry.id === session.personId);
  if (!person) throw new Error("We could not find your local profile.");

  const entry = auth[person.id] || {};
  const hasHash = Boolean(entry.passwordHash);
  const current = String(currentPassword || "");
  const validCurrent = hasHash
    ? await verifyPasswordHash(current, entry.passwordHash)
    : current === DEFAULT_DIRECTORY_PASSWORD;
  if (!validCurrent) throw new Error("Current password is incorrect.");

  const validatedNew = validateNewPasswordForRegister(newPassword);
  const now = new Date().toISOString();
  auth[person.id] = {
    ...entry,
    passwordHash: await hashPassword(validatedNew),
    mustChangePassword: false,
    claimedAt: entry.claimedAt || now,
    lastPasswordChangedAt: now,
  };
  await saveLocalAuth(auth);

  return {
    person,
    auth: issueDirectorySession({
      person,
      auth: { mustChangePassword: false },
    }),
  };
}

async function createLocalProfile(personInput, password) {
  const validatedPassword = validateNewPasswordForRegister(password);
  const db = await getLocalDatabase();
  const auth = await getLocalAuth();
  let person = normalizePersonForCreate(personInput);
  person = await enrichCoordinates(person);

  db.people.push(person);
  await saveLocalDatabase(db);

  const now = new Date().toISOString();
  auth[person.id] = {
    passwordHash: await hashPassword(validatedPassword),
    mustChangePassword: false,
    claimedAt: now,
    lastProfileUpdatedAt: now,
    lastPasswordChangedAt: now,
  };
  await saveLocalAuth(auth);

  return {
    person,
    auth: issueDirectorySession({
      person,
      auth: { mustChangePassword: false },
    }),
    sheet: {
      attempted: true,
      synced: true,
      targetSheets: ["local-mock"],
    },
  };
}

async function saveLocalProfile(personInput, session) {
  if (!session?.personId) throw new Error("A valid directory session is required.");
  const db = await getLocalDatabase();
  const auth = await getLocalAuth();
  const id = String(personInput?.id || "").trim();
  if (!id) throw new Error("Profile update requires a person id.");
  if (id !== session.personId) throw new Error("You can only update your own directory profile.");

  const index = db.people.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("We could not find your local profile.");

  const existing = db.people[index];
  const merged = normalizePersonForCreate({
    ...existing,
    ...personInput,
    id,
  });
  const person = await enrichCoordinates(merged);
  db.people[index] = person;
  await saveLocalDatabase(db);

  const now = new Date().toISOString();
  auth[id] = {
    ...(auth[id] || {}),
    passwordHash: auth[id]?.passwordHash || "",
    mustChangePassword: Boolean(auth[id]?.mustChangePassword),
    claimedAt: auth[id]?.claimedAt || "",
    lastProfileUpdatedAt: now,
    lastPasswordChangedAt: auth[id]?.lastPasswordChangedAt || "",
  };
  await saveLocalAuth(auth);

  return {
    person,
    auth: issueDirectorySession({
      person,
      auth: { mustChangePassword: Boolean(auth[id]?.mustChangePassword) },
    }),
    sheet: {
      attempted: true,
      synced: true,
      targetSheets: ["local-mock"],
    },
  };
}

function dedupeLatest(records, keyFn) {
  const byKey = new Map();
  for (const row of records) {
    const key = keyFn(row);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || new Date(row.updatedAt) > new Date(existing.updatedAt)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

async function listLocalRsvps() {
  const db = await getLocalDatabase();
  return dedupeLatest(db.rsvps, (r) => `${r.eventId}\t${r.personId}`);
}

async function appendLocalRsvp(input) {
  const db = await getLocalDatabase();
  const now = new Date().toISOString();
  const status =
    input.status === "interested" || input.status === "not-going" ? input.status : "going";
  const row = {
    eventId: String(input.eventId || "").trim(),
    eventTitle: String(input.eventTitle || "").trim(),
    personId: String(input.personId || "").trim(),
    fullName: String(input.fullName || "").trim(),
    status,
    createdAt: now,
    updatedAt: now,
  };
  if (!row.eventId || !row.personId) {
    throw new Error("eventId and personId required");
  }
  db.rsvps.push(row);
  await saveLocalDatabase(db);
  return row;
}

async function listLocalCheckins(filters) {
  const db = await getLocalDatabase();
  const latest = dedupeLatest(
    db.checkins,
    (r) => `${r.personId}\t${r.nodeSlug}\t${r.date}`,
  );
  return latest.filter((r) => {
    if (filters.nodeSlug && r.nodeSlug !== filters.nodeSlug) return false;
    if (filters.startDate && r.date < filters.startDate) return false;
    if (filters.endDate && r.date > filters.endDate) return false;
    return true;
  });
}

async function appendLocalCheckin(input) {
  const db = await getLocalDatabase();
  const now = new Date().toISOString();
  const row = {
    personId: String(input.personId || "").trim(),
    fullName: String(input.fullName || "").trim(),
    nodeSlug: String(input.nodeSlug || "").trim(),
    date: String(input.date || "").trim(),
    type: input.type === "planned" ? "planned" : "checkin",
    createdAt: now,
    updatedAt: now,
  };
  if (!row.personId || !row.nodeSlug || !row.date) {
    throw new Error("personId, nodeSlug, and date required");
  }
  db.checkins.push(row);
  await saveLocalDatabase(db);
  return row;
}

async function appendLocalSuggestion(input) {
  const db = await getLocalDatabase();
  const row = {
    id: generateId("suggestion"),
    personName: String(input.personName || "").trim(),
    personEmailOrHandle: String(input.personEmailOrHandle || "").trim(),
    requestedChangeType: String(input.requestedChangeType || "").trim(),
    requestedPayload:
      input.requestedPayload && typeof input.requestedPayload === "object"
        ? input.requestedPayload
        : {},
    createdAt: toIsoDateString(new Date()),
    status: "Pending",
  };
  if (!row.personName || !row.personEmailOrHandle || !row.requestedChangeType) {
    throw new Error("personName, personEmailOrHandle, and requestedChangeType required");
  }
  db.suggestions.push(row);
  await saveLocalDatabase(db);
  return row;
}

async function getMockLumaEvents() {
  const raw = await readJsonFile(LUMA_FILE, defaultMockLumaEvents);
  return Array.isArray(raw) ? raw : defaultMockLumaEvents();
}

module.exports = {
  DATABASE_FILE,
  AUTH_FILE,
  LUMA_FILE,
  isLocalMockMode,
  getLocalDatabase,
  authenticateLocalMember,
  changeLocalMemberPassword,
  createLocalProfile,
  saveLocalProfile,
  listLocalRsvps,
  appendLocalRsvp,
  listLocalCheckins,
  appendLocalCheckin,
  appendLocalSuggestion,
  getMockLumaEvents,
};

