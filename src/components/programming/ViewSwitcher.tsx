/**
 * ViewSwitcher — pill-style tab bar for toggling between
 * List and Month calendar views on the programming page.
 *
 * Visually mirrors the MonthNavigator's selected-state treatment:
 * teal fill on active, subtle hover on inactive, rounded-xl pills.
 */

import { List, CalendarDays } from "lucide-react";
import { cn } from "../ui/utils";

export type ProgrammingView = "list" | "month";

interface ViewSwitcherProps {
  active: ProgrammingView;
  onChange: (view: ProgrammingView) => void;
}

const VIEWS: { id: ProgrammingView; label: string; Icon: typeof List }[] = [
  { id: "list", label: "List", Icon: List },
  { id: "month", label: "Month", Icon: CalendarDays },
];

export function ViewSwitcher({ active, onChange }: ViewSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {VIEWS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
              isActive
                ? "bg-white text-teal-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
