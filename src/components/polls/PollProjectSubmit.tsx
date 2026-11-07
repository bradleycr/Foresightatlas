/**
 * Pitchers add themselves to the slate before voting opens.
 * Name, the people on it, and an optional link. A link gets a small QR
 * so a demo can be opened from the room without becoming the pitch deck.
 */

import { useState } from "react";
import { Github, Loader2 } from "lucide-react";
import type { PollOption } from "../../types/polls";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface PollProjectSubmitProps {
  options: PollOption[];
  saving: boolean;
  onSubmit: (project: { label: string; people: string; url: string }) => Promise<void>;
}

export function PollProjectSubmit({ options, saving, onSubmit }: PollProjectSubmitProps) {
  const [label, setLabel] = useState("");
  const [people, setPeople] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = async () => {
    try {
      await onSubmit({ label: label.trim(), people: people.trim(), url: url.trim() });
    } catch {
      return;
    }
    setLabel("");
    setPeople("");
    setUrl("");
  };

  return (
    <div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="project-name">Project</Label>
          <Input
            id="project-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Name of the project"
            className="mt-1.5 min-h-[44px]"
            maxLength={120}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="project-people">Names, separated by commas</Label>
          <Input
            id="project-people"
            value={people}
            onChange={(event) => setPeople(event.target.value)}
            placeholder="Ada Lovelace, Grace Hopper"
            className="mt-1.5 min-h-[44px]"
            maxLength={160}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="project-url">GitHub repo</Label>
          <Input
            id="project-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="github.com/org/project"
            className="mt-1.5 min-h-[44px]"
            maxLength={400}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <Button
          type="button"
          disabled={saving || label.trim().length < 2 || people.trim().length < 2 || url.trim().length < 3}
          onClick={() => void handleSubmit()}
          className="min-h-[48px] w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Add project
        </Button>
      </div>

      <ul className="mt-6 space-y-3">
        {options.length === 0 ? (
          <li className="text-sm text-neutral-500">Nothing on the slate yet.</li>
        ) : (
          options.map((option) => (
            <li
              key={option.id}
              className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/80 px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-neutral-900">{option.label}</p>
                {option.people ? (
                  <p className="mt-0.5 text-sm text-neutral-600">{option.people}</p>
                ) : null}
              </div>
              {option.url ? (
                <a
                  href={option.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-900"
                  aria-label={`${option.label} on GitHub`}
                >
                  <Github className="size-6" />
                </a>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
