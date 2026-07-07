/**
 * Draggable split between map and fellows list on desktop.
 * Sits on the sidebar's left edge so it's always easy to find and grab.
 */

import { GripVertical } from "lucide-react";
import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";
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
      style={{ zIndex: Z_INDEX_MAP_CONTROLS }}
      className={cn(
        "absolute left-0 top-0 bottom-0 -translate-x-1/2",
        "flex w-5 cursor-col-resize touch-none items-center justify-center",
        "group outline-none",
        "focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-4 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors duration-150",
          isDragging ? "bg-teal-500" : "bg-gray-300 group-hover:bg-teal-400",
        )}
      />
      <div
        className={cn(
          "relative flex h-12 w-5 items-center justify-center rounded-full border shadow-md transition-all duration-150",
          isDragging
            ? "border-teal-400 bg-white text-teal-600 shadow-lg scale-105"
            : "border-gray-200 bg-white text-gray-400 group-hover:border-teal-300 group-hover:text-teal-600 group-hover:shadow-lg",
        )}
        title="Drag to resize · double-click to reset"
      >
        <GripVertical className="size-4" aria-hidden />
      </div>
    </div>
  );
}
