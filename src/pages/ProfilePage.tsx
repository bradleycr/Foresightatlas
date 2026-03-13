import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, KeyRound, Loader2, Link2, LogOut, Save, Sparkles, User, UserPlus, CheckCircle, AlertCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { Identity } from "../services/identity";
import { createPerson, updatePerson } from "../services/database";
import { changeDirectoryPassword } from "../services/memberAuth";
import { geocodeCity } from "../services/geocoding";
import type { Person, PrimaryNode, RoleType } from "../types";
import { PRESET_FOCUS_AREAS, getPresetFocusTags, getCustomFocusTags, parseFocusTags } from "../data/focusAreas";
import { getPersonRSVPs } from "../services/rsvp";
import { fetchRSVPsFromAPI } from "../services/rsvp";
import { getEventById } from "../data/events";
import { getNode } from "../data/nodes";
import { buildFullPath } from "../utils/router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { DirectoryLoginForm } from "../components/auth/DirectoryLoginForm";
// Foresight pin icon (same as map markers)
import foresightIconUrl from "../assets/Foresight_RGB_Icon_Black.png?url";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const ROLE_OPTIONS: RoleType[] = [
  "Fellow",
  "Senior Fellow",
  "Grantee",
  "Prize Winner",
  "Nodee",
];

/** Location-only nodes for the form; "Alumni" is a separate program-status field. */
const LOCATION_NODE_OPTIONS: PrimaryNode[] = [
  "Global",
  "Berlin Node",
  "Bay Area Node",
];

const NODE_OPTIONS: PrimaryNode[] = [
  ...LOCATION_NODE_OPTIONS,
  "Alumni",
];

/** Cohort years from 2017 to current, plus 0 for Unknown. */
const COHORT_YEAR_OPTIONS: number[] = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [0];
  for (let y = 2017; y <= current; y++) years.push(y);
  return years;
})();

/** Blank person for the "Add yourself" create flow. */
const EMPTY_PERSON: Person = {
  id: "",
  fullName: "",
  roleType: "Fellow",
  fellowshipCohortYear: 0,
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

interface ProfilePageProps {
  identity: Identity | null;
  people: Person[];
  person: Person | null;
  createMode: boolean;
  onNavigateHome: () => void;
  onSignIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => void;
  onProfileSaved: (
    person: Person,
    auth?: { token: string; expiresAt: string; mustChangePassword: boolean },
  ) => void;
  /** After creating a new profile, leave create mode (e.g. navigate to /profile). */
  onExitCreateMode: () => void;
  /** User chose "Add yourself" from the login form. */
  onAddYourself?: () => void;
}

type LocationCheckState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/**
 * ProfilePage
 *
 * A focused self-service editor for the currently selected directory identity.
 * The page keeps the form generous and mobile-friendly while still exposing
 * the full record shape that powers the map, cards, and person modal.
 */
export function ProfilePage({
  identity,
  people,
  person,
  createMode,
  onNavigateHome,
  onSignIn,
  onSignOut,
  onProfileSaved,
  onExitCreateMode,
  onAddYourself,
}: ProfilePageProps) {
  const [draft, setDraft] = useState<Person | null>(person);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  /** For create mode: password and confirm. */
  const [createPassword, setCreatePassword] = useState({ password: "", confirm: "" });
  /** Selected preset focus areas (used for map filtering). */
  const [createSelectedPresets, setCreateSelectedPresets] = useState<string[]>([]);
  /** Custom focus tags (profile-only; comma-separated). */
  const [createCustomFocusStr, setCreateCustomFocusStr] = useState("");
  /** Same for edit form. */
  const [editSelectedPresets, setEditSelectedPresets] = useState<string[]>([]);
  const [editCustomFocusStr, setEditCustomFocusStr] = useState("");
  /** Live geocode feedback so people can fix city/country before saving. */
  const [locationCheck, setLocationCheck] = useState<LocationCheckState>({
    status: "idle",
    message: "",
  });
  /** Tick to refresh "Events I'm attending" after RSVP fetch (e.g. on profile load). */
  const [rsvpTick, setRsvpTick] = useState(0);

  useEffect(() => {
    if (createMode && !identity) return;
    setDraft(person);
  }, [person, createMode, identity]);

  /** In create mode without identity, keep draft as empty person (or user edits). Don’t overwrite with null. */
  useEffect(() => {
    if (createMode && !identity && !draft) {
      setDraft(EMPTY_PERSON);
    }
  }, [createMode, identity, draft]);

  /** Sync create-form focus from draft when entering create mode or draft tags change. */
  useEffect(() => {
    if (createMode && !identity && draft) {
      setCreateSelectedPresets(getPresetFocusTags(draft.focusTags));
      setCreateCustomFocusStr(getCustomFocusTags(draft.focusTags).join(", "));
    }
  }, [createMode, identity, draft?.focusTags]);

  /** Sync edit-form focus from draft when in edit mode. */
  useEffect(() => {
    if (identity && draft && !createMode) {
      setEditSelectedPresets(getPresetFocusTags(draft.focusTags));
      setEditCustomFocusStr(getCustomFocusTags(draft.focusTags).join(", "));
    }
  }, [identity, createMode, draft?.id, draft?.focusTags]);

  /** Fetch RSVPs when viewing profile so "Events I'm attending" is up to date. */
  useEffect(() => {
    if (!identity?.personId) return;
    fetchRSVPsFromAPI().then(() => setRsvpTick((t) => t + 1));
  }, [identity?.personId]);

  /**
   * Validate the map location as the user types.
   * We keep the message lightweight but specific so people can fix spelling
   * or add a clearer country before saving.
   */
  useEffect(() => {
    if (!draft) return;

    const city = draft.currentCity.trim();
    const country = draft.currentCountry.trim();

    if (!city) {
      setLocationCheck({ status: "idle", message: "" });
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLocationCheck({
        status: "checking",
        message: "Checking whether we can place your map pin…",
      });

      const result = await geocodeCity(city, country || undefined);
      if (!result) {
        setLocationCheck({
          status: "error",
          message:
            "We could not place this location. Try a more specific city and country, and check the spelling.",
        });
        return;
      }

      setDraft((current) =>
        current && current.currentCity === draft.currentCity && current.currentCountry === draft.currentCountry
          ? {
              ...current,
              currentCoordinates: {
                lat: result.lat,
                lng: result.lng,
              },
            }
          : current,
      );

      const resolvedLabel = [result.city || city, result.country || country]
        .filter(Boolean)
        .join(", ");
      setLocationCheck({
        status: "success",
        message: `Map pin found near ${resolvedLabel}.`,
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [draft?.currentCity, draft?.currentCountry]);

  const initials = useMemo(() => {
    const source = draft?.fullName || identity?.fullName || "";
    return source
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [draft?.fullName, identity?.fullName]);

  if (!identity) {
    /* Create mode: "Add yourself" flow — full form + password, then create and sign in. */
    if (createMode) {
      const createDraft = draft ?? EMPTY_PERSON;
      const updateCreateDraft = <K extends keyof Person>(key: K, value: Person[K]) => {
        setDraft((current) => (current ? { ...current, [key]: value } : current));
      };
      const handleCreate = async () => {
        if (!createDraft.fullName.trim()) {
          toast.error("Full name is required.");
          return;
        }
        if (createPassword.password.length < 8) {
          toast.error("Choose a password with at least 8 characters.");
          return;
        }
        if (createPassword.password !== createPassword.confirm) {
          toast.error("Password and confirmation do not match.");
          return;
        }
        setIsSaving(true);
        try {
          const payload = {
            ...createDraft,
            focusTags: [...createSelectedPresets, ...parseFocusTags(createCustomFocusStr)],
          };
          const result = await createPerson(payload, createPassword.password);
          onProfileSaved(result.person, result.auth);
          onExitCreateMode();
          toast.success("Profile created", {
            description: "You’re signed in. Your profile is on the map and in the directory.",
          });
        } catch (error) {
          toast.error("Could not create profile", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        } finally {
          setIsSaving(false);
        }
      };

      return (
        <ProfilePageShell maxWidth="max-w-3xl">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex min-h-[44px] w-fit touch-manipulation items-center gap-2 rounded-lg py-2.5 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-2 active:bg-gray-100 sm:min-h-0"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </button>

          <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow">
            <div
              className="border-b border-gray-200/80 px-6 py-8 sm:px-8"
              style={{ background: `linear-gradient(135deg, ${"#f0f9ff"} 0%, ${"#ecfdf5"} 50%, ${"#faf5ff"} 100%)` }}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-gray-200/80">
                <img src={foresightIconUrl} alt="" className="size-8 object-contain opacity-30" aria-hidden />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
                Add yourself to the directory
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Not in the list? Add your details below; you&apos;ll appear on the map and in the directory.
              </p>
            </div>

            <div className="space-y-8 px-6 py-8 sm:px-8">

              <ProfileSection
                title="Core profile"
                description="Required for the directory and map."
                icon={<User className="size-4 text-sky-500" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name" required>
                    <Input
                      value={createDraft.fullName}
                      onChange={(e) => updateCreateDraft("fullName", e.target.value)}
                      placeholder="First and last name"
                    />
                  </Field>
                  <Field label="Role type" required>
                    <Select
                      value={createDraft.roleType}
                      onValueChange={(v: RoleType) => updateCreateDraft("roleType", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cohort year" required>
                    <Select
                      value={String(createDraft.fellowshipCohortYear)}
                      onValueChange={(v) =>
                        updateCreateDraft("fellowshipCohortYear", v === "0" ? 0 : Number(v))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Unknown</SelectItem>
                        {COHORT_YEAR_OPTIONS.filter((y) => y !== 0).map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Primary node (location)" required>
                    <Select
                      value={createDraft.primaryNode === "Alumni" ? "Global" : createDraft.primaryNode}
                      onValueChange={(v: PrimaryNode) => updateCreateDraft("primaryNode", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOCATION_NODE_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Program status">
                    <Select
                      value={createDraft.isAlumni ? "Alumni" : "Current"}
                      onValueChange={(v) =>
                        updateCreateDraft("isAlumni", v === "Alumni")
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Current">Current participant</SelectItem>
                        <SelectItem value="Alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Affiliation / institution">
                    <Input
                      value={createDraft.affiliationOrInstitution ?? ""}
                      onChange={(e) =>
                        updateCreateDraft(
                          "affiliationOrInstitution",
                          e.target.value.trim() || null,
                        )
                      }
                      placeholder="University, company, lab"
                    />
                  </Field>
                  <Field
                    label="City"
                    description="Use one city only, not multiple places."
                  >
                    <Input
                      value={createDraft.currentCity}
                      onChange={(e) => updateCreateDraft("currentCity", e.target.value)}
                      placeholder="e.g. Berlin"
                    />
                  </Field>
                  <Field
                    label="Country"
                    description="Add the country so we can place the pin reliably."
                  >
                    <Input
                      value={createDraft.currentCountry}
                      onChange={(e) => updateCreateDraft("currentCountry", e.target.value)}
                      placeholder="e.g. Germany"
                    />
                  </Field>
                </div>
                <LocationCheckNotice state={locationCheck} />
                <Field
                  label="Focus areas"
                  description="Select one or more main focus areas (used for map filtering). You can add custom areas under Other."
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-y-3">
                      {PRESET_FOCUS_AREAS.map((tag) => (
                        <label
                          key={tag}
                          className="flex min-h-[44px] touch-manipulation cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-800 sm:min-h-0"
                        >
                          <input
                            type="checkbox"
                            checked={createSelectedPresets.includes(tag)}
                            onChange={() =>
                              setCreateSelectedPresets((prev) =>
                                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                              )
                            }
                            className="size-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Other (optional)</Label>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Custom focus areas appear on your profile but are not used for map filtering.
                      </p>
                      <Input
                        value={createCustomFocusStr}
                        onChange={(e) => setCreateCustomFocusStr(e.target.value)}
                        placeholder="e.g. Quantum computing, Policy"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </Field>
              </ProfileSection>

              <ProfileSection
                title="Optional"
                description="Project tagline, description, and links."
                icon={<Sparkles className="size-4 text-sky-500" />}
              >
                <Field label="Short project tagline">
                  <Input
                    value={createDraft.shortProjectTagline}
                    onChange={(e) => updateCreateDraft("shortProjectTagline", e.target.value)}
                    placeholder="One sentence about your work"
                  />
                </Field>
                <Field label="Profile URL">
                  <Input
                    type="url"
                    value={createDraft.profileUrl}
                    onChange={(e) => updateCreateDraft("profileUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </Field>
              </ProfileSection>

              <ProfileSection
                title="How to contact you"
                description="How would you like others to reach you? Email, URL, or LinkedIn profile."
                icon={<Link2 className="size-4 text-sky-500" />}
              >
                <Field label="Preferred contact (email, URL, or LinkedIn)">
                  <Input
                    value={createDraft.contactUrlOrHandle ?? ""}
                    onChange={(e) =>
                      updateCreateDraft(
                        "contactUrlOrHandle",
                        e.target.value.trim() || null,
                      )
                    }
                    placeholder="you@example.com, https://linkedin.com/in/you, or profile URL"
                  />
                </Field>
              </ProfileSection>

              <ProfileSection
                title="Set your password"
                description="You'll use this to sign in and edit your profile later."
                icon={<KeyRound className="size-4 text-sky-500" />}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" required>
                    <Input
                      type="password"
                      value={createPassword.password}
                      onChange={(e) =>
                        setCreatePassword((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder="At least 8 characters"
                    />
                  </Field>
                  <Field label="Confirm password" required>
                    <Input
                      type="password"
                      value={createPassword.confirm}
                      onChange={(e) =>
                        setCreatePassword((p) => ({ ...p, confirm: e.target.value }))
                      }
                      placeholder="Repeat password"
                    />
                  </Field>
                </div>
              </ProfileSection>
            </div>

            <div className="border-t border-gray-200 bg-gray-50/80 px-6 py-5 sm:px-8">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={onNavigateHome} className="min-h-[48px]">
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="min-h-[48px] px-6"
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Create profile
                </Button>
              </div>
            </div>
          </section>
        </ProfilePageShell>
      );
    }

    /* Sign-in form with optional "Add yourself" link. */
    return (
      <ProfilePageShell maxWidth="max-w-3xl">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex min-h-[44px] w-fit touch-manipulation items-center gap-2 rounded-lg py-2.5 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-2 active:bg-gray-100 sm:min-h-0"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </button>

          <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow">
            <div className="mx-auto max-w-xl">
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Sparkles className="size-6" />
              </div>
              <DirectoryLoginForm
                people={people}
                title="Sign in to edit your directory profile"
                description="Use your full name and password."
                submitLabel="Sign in"
                onSubmit={onSignIn}
                onAddYourself={onAddYourself}
              />
            </div>
          </section>
      </ProfilePageShell>
    );
  }

  if (!draft) {
    return (
      <ProfilePageShell maxWidth="max-w-3xl">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex min-h-[44px] w-fit touch-manipulation items-center gap-2 rounded-lg py-2.5 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-2 active:bg-gray-100 sm:min-h-0"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </button>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              We could not find your profile record
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              The current identity is signed in, but its person record is missing from the
              loaded directory. Signing out and choosing your name again usually resolves this.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={onNavigateHome}
                className="min-h-[44px]"
              >
                Go back
              </Button>
              <Button onClick={onSignOut} className="min-h-[44px]">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </section>
      </ProfilePageShell>
    );
  }

  const updateDraft = <K extends keyof Person>(key: K, value: Person[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!identity) return;

    if (identity.mustChangePassword) {
      toast.error("Change your password before saving your profile.");
      return;
    }

    if (!draft.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    if (
      draft.fellowshipCohortYear !== 0 &&
      draft.fellowshipCohortYear != null &&
      (draft.fellowshipCohortYear < 1900 || draft.fellowshipCohortYear > 2100)
    ) {
      toast.error("Please enter a valid cohort year (1900–2100), or 0 for unknown.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        focusTags: [...editSelectedPresets, ...parseFocusTags(editCustomFocusStr)],
      };
      const result = await updatePerson(draft.id, payload, identity.token);
      setDraft(result.person);
      onProfileSaved(result.person, result.auth);
      toast.success("Profile updated", {
        description: "Your map card and directory details were refreshed immediately.",
      });
    } catch (error) {
      toast.error("Failed to save profile", {
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!identity) return;
    if (!passwordForm.currentPassword.trim()) {
      toast.error("Current password is required.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Choose a password with at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changeDirectoryPassword(
        identity.token,
        passwordForm.currentPassword,
        passwordForm.newPassword,
      );
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      onProfileSaved(result.person, result.auth);
      toast.success(
        identity.mustChangePassword
          ? "Password set. You can now save profile changes."
          : "Password updated.",
      );
    } catch (error) {
      toast.error("Failed to change password", {
        description:
          error instanceof Error ? error.message : "Please try again in a moment.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <ProfilePageShell maxWidth="max-w-6xl">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex min-h-[44px] w-fit touch-manipulation items-center gap-2 rounded-lg py-2.5 pr-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:ring-offset-2 active:bg-gray-100 sm:min-h-0"
        >
          <ArrowLeft className="size-4" />
          Back to map
        </button>

        <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow">
          {/* Header: identity only, no actions */}
          {/* Header: Foresight icon + initials, then name */}
          <div
            className="border-b border-gray-200/80 px-6 py-8 sm:px-8 lg:px-10 lg:py-10"
            style={{ background: `linear-gradient(135deg, ${"#f0f9ff"} 0%, ${"#ecfdf5"} 50%, ${"#faf5ff"} 100%)` }}
          >
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-gray-200/80 sm:size-16">
                <img src={foresightIconUrl} alt="" className="absolute inset-0 size-full object-contain p-0.5 opacity-50 scale-125" aria-hidden />
                <span className="relative z-10 text-sm font-medium text-sky-700/85 sm:text-base">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-sky-600/90 sm:text-sm">
                  Your directory profile
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                  {draft.fullName}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                  Edit below; Save and Sign out are at the bottom.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)] lg:px-10 lg:py-10 lg:gap-12">
            <section className="space-y-8">
              <ProfileSection
                title="Core profile"
                description="Essentials for the list, modal, and filters."
                icon={<User className="size-4 text-sky-500" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name" required>
                    <Input
                      value={draft.fullName}
                      onChange={(event) => updateDraft("fullName", event.target.value)}
                      placeholder="Dr. Jane Doe"
                    />
                  </Field>

                  <Field label="Role type" required>
                    <Select
                      value={draft.roleType}
                      onValueChange={(value: RoleType) => updateDraft("roleType", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Cohort year" required>
                    <Select
                      value={String(draft.fellowshipCohortYear)}
                      onValueChange={(v) =>
                        updateDraft("fellowshipCohortYear", v === "0" ? 0 : Number(v))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Unknown</SelectItem>
                        {COHORT_YEAR_OPTIONS.filter((y) => y !== 0).map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="End year">
                    <Input
                      type="number"
                      value={draft.fellowshipEndYear ?? ""}
                      placeholder="Leave blank if ongoing"
                      onChange={(event) => {
                        const next = event.target.value.trim();
                        updateDraft(
                          "fellowshipEndYear",
                          next ? Number(next) || null : null,
                        );
                      }}
                    />
                  </Field>

                  <Field label="Affiliation / institution">
                    <Input
                      value={draft.affiliationOrInstitution ?? ""}
                      onChange={(event) =>
                        updateDraft(
                          "affiliationOrInstitution",
                          event.target.value.trim() || null,
                        )
                      }
                      placeholder="University, company, lab, or institute"
                    />
                  </Field>

                  <Field label="Primary node (location)" required>
                    <Select
                      value={draft.primaryNode === "Alumni" ? "Global" : draft.primaryNode}
                      onValueChange={(value: PrimaryNode) =>
                        updateDraft("primaryNode", value)
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LOCATION_NODE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Program status">
                    <Select
                      value={draft.isAlumni ? "Alumni" : "Current"}
                      onValueChange={(v) => updateDraft("isAlumni", v === "Alumni")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Current">Current participant</SelectItem>
                        <SelectItem value="Alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field
                  label="Focus areas"
                  description="Select one or more main focus areas (used for map filtering). You can add custom areas under Other."
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-y-3">
                      {PRESET_FOCUS_AREAS.map((tag) => (
                        <label
                          key={tag}
                          className="flex min-h-[44px] touch-manipulation cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50 has-[:checked]:text-sky-800 sm:min-h-0"
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedPresets.includes(tag)}
                            onChange={() =>
                              setEditSelectedPresets((prev) =>
                                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                              )
                            }
                            className="size-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500">Other (optional)</Label>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Custom focus areas appear on your profile but are not used for map filtering.
                      </p>
                      <Input
                        value={editCustomFocusStr}
                        onChange={(e) => setEditCustomFocusStr(e.target.value)}
                        placeholder="e.g. Quantum computing, Policy"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </Field>
              </ProfileSection>

              {/* Events I'm attending — only "going" (confirmed), not "interested" */}
              {identity?.personId && (
                <ProfileSection
                  title="Events I'm attending"
                  description={'Events you\'ve confirmed you\'re going to. (Choosing "Interested" does not add you here — only "Going" counts.) Manage on Berlin or SF Programming.'}
                  icon={<CalendarDays className="size-4 text-sky-500" />}
                >
                  <ProfileEventsAttending
                    personId={identity.personId}
                    rsvpTick={rsvpTick}
                  />
                </ProfileSection>
              )}

              <ProfileSection
                title="Project and public presence"
                description="What people see when they open your card."
                icon={<Sparkles className="size-4 text-sky-500" />}
              >
                <Field label="Short project tagline">
                  <Input
                    value={draft.shortProjectTagline}
                    onChange={(event) =>
                      updateDraft("shortProjectTagline", event.target.value)
                    }
                    placeholder="One clear sentence about your work"
                  />
                </Field>

                <Field label="Expanded project description">
                  <Textarea
                    rows={7}
                    value={draft.expandedProjectDescription}
                    onChange={(event) =>
                      updateDraft("expandedProjectDescription", event.target.value)
                    }
                    placeholder="Add the fuller context behind your project, research direction, or work."
                  />
                </Field>
              </ProfileSection>
            </section>

            <section className="space-y-8">
              <ProfileSection
                title="Location and map"
                description="Add a precise city and country so your map pin lands in the right place."
                icon={<img src={foresightIconUrl} alt="" className="size-4 object-contain opacity-90" aria-hidden />}
              >
                <Field
                  label="City"
                  description="Use one city only, not multiple places."
                >
                  <Input
                    value={draft.currentCity}
                    onChange={(event) =>
                      updateDraft("currentCity", event.target.value)
                    }
                    placeholder="e.g. Berlin"
                  />
                </Field>
                <Field
                  label="Country"
                  description="Add the country so we can place the pin reliably."
                >
                  <Input
                    value={draft.currentCountry}
                    onChange={(event) =>
                      updateDraft("currentCountry", event.target.value)
                    }
                    placeholder="e.g. Germany"
                  />
                </Field>
                <LocationCheckNotice state={locationCheck} />
              </ProfileSection>

              <ProfileSection
                title="Password and access"
                description={
                  identity.mustChangePassword
                    ? "Set a personal password before saving profile edits."
                    : "Update your password whenever you want."
                }
                icon={<KeyRound className="size-4 text-sky-500" />}
              >
                {identity.mustChangePassword ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Use <span className="font-semibold">password123</span> as current password below, then set a new one.
                  </div>
                ) : null}
                <div className="grid gap-4">
                  <Field
                    label="Current password"
                    required
                  >
                    <Input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))
                      }
                      placeholder="Current password"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="New password" required>
                      <Input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            newPassword: event.target.value,
                          }))
                        }
                        placeholder="At least 8 characters"
                      />
                    </Field>
                    <Field label="Confirm new password" required>
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                        placeholder="Repeat new password"
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword}
                      className="min-h-[44px]"
                    >
                      {isChangingPassword ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      {identity.mustChangePassword ? "Set password" : "Update password"}
                    </Button>
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection
                title="Contact and links"
                description="How would you like to be contacted? Email, URL, or LinkedIn."
                icon={<Link2 className="size-4 text-sky-500" />}
              >
                <Field label="Preferred contact (email, URL, or LinkedIn)">
                  <Input
                    value={draft.contactUrlOrHandle ?? ""}
                    onChange={(event) =>
                      updateDraft(
                        "contactUrlOrHandle",
                        event.target.value.trim() || null,
                      )
                    }
                    placeholder="you@example.com, https://linkedin.com/in/you, or profile URL"
                  />
                </Field>

                <Field label="Profile URL">
                  <Input
                    type="url"
                    value={draft.profileUrl}
                    onChange={(event) => updateDraft("profileUrl", event.target.value)}
                    placeholder="https://your-site-or-profile"
                  />
                </Field>
              </ProfileSection>
            </section>
          </div>

          {/* Bottom actions: Sign out and Save profile */}
          <div className="border-t border-gray-200 bg-gray-50/80 px-6 py-5 sm:px-8 lg:px-10">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <Button
                variant="outline"
                onClick={onSignOut}
                className="min-h-[48px] justify-center border-gray-300 px-6 font-medium sm:min-w-[10rem]"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || identity.mustChangePassword}
                className="min-h-[48px] justify-center px-6 font-medium sm:min-w-[11rem]"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save profile
              </Button>
            </div>
            {identity.mustChangePassword ? (
              <p className="mt-3 text-sm text-amber-700">
                Save is locked until you choose a personal password.
              </p>
            ) : null}
          </div>
        </section>
    </ProfilePageShell>
  );
}

function ProfilePageShell({
  children,
  maxWidth,
}: {
  children: ReactNode;
  maxWidth: string;
}) {
  return (
    <div className="flex-1 overflow-auto overflow-x-hidden bg-[linear-gradient(to_bottom,#f0f2f5_0%,#f1f3f6_100%)]">
      <div className={`mx-auto flex min-w-0 ${maxWidth} flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8`}>
        {children}
      </div>
    </div>
  );
}

function ProfileSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow sm:p-5 lg:p-6">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-gray-100 p-2 text-gray-600">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-gray-900 sm:text-lg">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4 sm:mt-6">{children}</div>
    </section>
  );
}

/** Lists events the user is attending (going RSVPs only — not "interested"). */
function ProfileEventsAttending({
  personId,
  rsvpTick,
}: {
  personId: string;
  rsvpTick: number;
}) {
  void rsvpTick; // refresh when RSVPs are re-fetched
  const attending = useMemo(() => {
    const rsvps = getPersonRSVPs(personId).filter((r) => r.status === "going");
    return rsvps
      .map((r) => getEventById(r.eventId))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [personId, rsvpTick]);

  if (attending.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600">
        <p>You haven&apos;t said you&apos;re <strong>going</strong> to any events yet. Use &quot;Going&quot; (not just &quot;Interested&quot;) on the programming page to confirm.</p>
        <p className="mt-2">
          Visit{" "}
          <a
            href={buildFullPath("/berlin")}
            className="font-medium text-sky-600 underline hover:text-sky-700"
          >
            Berlin node
          </a>
          ,{" "}
          <a
            href={buildFullPath("/sf")}
            className="font-medium text-sky-600 underline hover:text-sky-700"
          >
            SF node
          </a>
          , or{" "}
          <a
            href={buildFullPath("/global")}
            className="font-medium text-sky-600 underline hover:text-sky-700"
          >
            Global programming
          </a>{" "}
          to RSVP to Vision Weekends, workshops, and node events. Choose <strong>Going</strong> (not just Interested) and it&apos;ll show here and on your profile card.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {attending.map((event) => {
          const node = getNode(event.nodeSlug);
          const nodeLabel = node ? `${node.city}` : event.location;
          const dateStr = new Date(event.startAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const programPath = event.nodeSlug === "global" ? "global" : event.nodeSlug === "berlin" ? "berlin" : "sf";
          return (
            <li key={event.id}>
              <a
                href={buildFullPath(`/${programPath}`)}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-sky-200 hover:bg-sky-50/80"
              >
                <span className="font-medium text-gray-900">{event.title}</span>
                <span className="text-gray-500">
                  {dateStr} · {nodeLabel}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-gray-500">
        To change attendance, go to{" "}
        <a href={buildFullPath("berlin")} className="text-sky-600 underline hover:text-sky-700">Berlin</a>
        {" or "}
        <a href={buildFullPath("sf")} className="text-sky-600 underline hover:text-sky-700">SF Programming</a>.
      </p>
    </div>
  );
}

function Field({
  label,
  required = false,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {description ? (
        <p className="text-xs leading-5 text-gray-500">{description}</p>
      ) : null}
    </div>
  );
}

function LocationCheckNotice({ state }: { state: LocationCheckState }) {
  if (state.status === "idle" || !state.message) return null;

  const tone =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : state.status === "error"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-900";

  const Icon =
    state.status === "success"
      ? CheckCircle
      : state.status === "error"
        ? AlertCircle
        : Loader2;

  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-relaxed break-words ${tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`size-5 shrink-0 mt-0.5 ${state.status === "checking" ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span>{state.message}</span>
    </div>
  );
}
