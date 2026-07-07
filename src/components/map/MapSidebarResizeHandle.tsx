/**
 * Draggable split between map and fellows list on desktop.
 */

import { GripVertical } from "lucide-react";
import { cn } from "../ui/utils";

interface MapSidebarResizeHandleProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onResizeStart: (event: React.MouseEvent) => void;
  onResizeKeyDown: (event: React.KeyboardEvent) => void;
  onResizeDoubleClick: () => void;
}

export function MapSidebarResizeHandle({
  width,
  minWidth,
  maxWidth,
  isDragging,
  onResizeStart,
  onResizeKeyDown,
  onResizeDoubleClick,
}: MapSidebarResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize fellows list"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onMouseDown={onResizeStart}
      onDoubleClick={onResizeDoubleClick}
      onKeyDown={onResizeKeyDown}
      className={cn(
        "relative z-20 hidden shrink-0 lg:flex",
        "w-3 cursor-col-resize touch-none",
        "items-center justify-center",
        "group outline-none",
        "focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-3 left-1/2 w-px -translate-x-1/2 rounded-full transition-all duration-150",
          isDragging
            ? "bg-teal-500/70 inset-y-2"
            : "bg-gray-200 group-hover:bg-teal-400/80 group-focus-visible:bg-teal-500/70",
        )}
      />
      <div
        className={cn(
          "relative flex h-10 w-4 items-center justify-center rounded-md border shadow-sm transition-all duration-150",
          isDragging
            ? "border-teal-300/80 bg-white text-teal-600 shadow-md scale-105"
            : "border-gray-200/90 bg-white/95 text-gray-400 group-hover:border-teal-200 group-hover:text-teal-600 group-hover:shadow-md",
        )}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </div>
    </div>
  );
}
