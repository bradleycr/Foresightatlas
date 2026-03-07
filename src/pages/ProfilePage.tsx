import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, KeyRound, Loader2, Link2, LogOut, MapPin, Save, Sparkles, User, UserPlus, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { Identity } from "../services/identity";
import { createPerson, updatePerson } from "../services/database";
import { changeDirectoryPassword } from "../services/memberAuth";
import { geocodeCity } from "../services/geocoding";
import type { Person, PrimaryNode, RoleType } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { DirectoryLoginForm } from "../components/auth/DirectoryLoginForm";
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

/** Parse focus-tags string: split on comma, trim each part, drop empties. Spaces within a tag are kept. */
function parseFocusTags(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

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
  /** Raw focus-tags string so users can type commas and spaces without them disappearing. */
  const [createFocusTagsStr, setCreateFocusTagsStr] = useState("");
  /** Same for edit form. */
  const [editFocusTagsStr, setEditFocusTagsStr] = useState("");
  /** Live geocode feedback so people can fix city/country before saving. */
  const [locationCheck, setLocationCheck] = useState<LocationCheckState>({
    status: "idle",
    message: "",
  });

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

  /** Sync create-form focus-tags string from draft when entering create mode or draft tags change from elsewhere. */
  useEffect(() => {
    if (createMode && !identity && draft) {
      setCreateFocusTagsStr((prev) => {
        const fromDraft = draft.focusTags.join(", ");
        return fromDraft === prev ? prev : fromDraft;
      });
    }
  }, [createMode, identity, draft?.focusTags]);

  /** Sync edit-form focus-tags string from draft when in edit mode. */
  useEffect(() => {
    if (identity && draft && !createMode) {
      setEditFocusTagsStr(draft.focusTags.join(", "));
    }
  }, [identity, createMode, draft?.id, draft?.focusTags]);

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
            focusTags: parseFocusTags(createFocusTagsStr),
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
            <div className="border-b border-gray-200/80 bg-[linear-gradient(135deg,rgba(250,250,255,0.98),rgba(248,250,252,0.98))] px-6 py-8 sm:px-8">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <UserPlus className="size-6" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
                Add yourself to the directory
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Not in the list? Fill in your details below and set a password. Your profile will be added to the map and directory.
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
                  label="Focus tags"
                  description="Separate with commas; spaces within a tag are kept (e.g. Longevity Biotechnology, Secure AI)."
                >
                  <Input
                    value={createFocusTagsStr}
                    onChange={(e) => setCreateFocusTagsStr(e.target.value)}
                    onBlur={() =>
                      updateCreateDraft("focusTags", parseFocusTags(createFocusTagsStr))
                    }
                    placeholder="Longevity Biotechnology, Secure AI, Neurotechnology"
                  />
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
                description="Use your full name and password. If this is your first sign-in, your temporary password is password123."
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
        focusTags: parseFocusTags(editFocusTagsStr),
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
          <div className="border-b border-gray-200/80 bg-[linear-gradient(135deg,rgba(250,250,255,0.98),rgba(248,250,252,0.98))] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-base font-semibold text-sky-700 sm:size-16">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-sky-600/90 sm:text-sm">
                  Your directory profile
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                  {draft.fullName}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                  Edit the fields below; save and sign out are at the bottom of the page.
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
                  label="Focus tags"
                  description="Separate with commas; spaces within a tag are kept (e.g. Longevity Biotechnology, Secure AI)."
                >
                  <Input
                    value={editFocusTagsStr}
                    onChange={(e) => setEditFocusTagsStr(e.target.value)}
                    onBlur={() =>
                      updateDraft("focusTags", parseFocusTags(editFocusTagsStr))
                    }
                    placeholder="Longevity Biotechnology, Secure AI, Neurotechnology"
                  />
                </Field>
              </ProfileSection>

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
                icon={<MapPin className="size-4 text-sky-500" />}
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
                    This is your first sign-in. Use <span className="font-semibold">password123</span> as the current password, then choose a new one below.
                  </div>
                ) : null}
                <div className="grid gap-4">
                  <Field
                    label="Current password"
                    required
                    description={
                      identity.mustChangePassword
                        ? "Your temporary password is password123."
                        : undefined
                    }
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

              <section className="rounded-2xl border border-sky-100/80 bg-sky-50/50 p-4 text-sm leading-5 break-words sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-700/80">
                  Sync notes
                </h2>
                <ul className="mt-2 space-y-1.5 text-sky-900/70">
                  <li>Card and map update in this session after save.</li>
                  <li>Your profile saves back to the canonical RealData row.</li>
                  <li>City-based coordinates are refreshed on the backend when possible.</li>
                </ul>
              </section>
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
