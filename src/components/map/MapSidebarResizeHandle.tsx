/**
 * Draggable split between map and fellows list on desktop.
 * Subtle seam handle — visible on hover, centered on the divider.
 */

import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";
import { cn } from "../ui/utils";

interface MapSidebarResizeHandleProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging: boolean;
  onResizeStart: (event: React.MouseEvent<HTMLElement>, measuredWidth: number) => void;
  onResizeKeyDown: (event: React.KeyboardEvent) => void;
  onResizeDoubleClick: () => void;
  sidebarRef: React.RefObject<HTMLDivElement | null>;
}

export function MapSidebarResizeHandle({
  width,
  minWidth,
  maxWidth,
  isDragging,
  onResizeStart,
  onResizeKeyDown,
  onResizeDoubleClick,
  sidebarRef,
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
      onMouseDown={(event) => {
        const measuredWidth = sidebarRef.current?.getBoundingClientRect().width ?? width;
        onResizeStart(event, measuredWidth);
      }}
      onDoubleClick={onResizeDoubleClick}
      onKeyDown={onResizeKeyDown}
      title="Drag to resize · double-click to reset"
      style={{ zIndex: Z_INDEX_MAP_CONTROLS }}
      className={cn(
        "absolute left-0 top-0 bottom-0 -translate-x-1/2",
        "flex w-2 cursor-col-resize touch-none items-center justify-center",
        "outline-none",
        "focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:ring-offset-1",
      )}
    >
      <div
        className={cn(
          "h-16 w-px rounded-full transition-all duration-150",
          isDragging
            ? "h-full bg-gray-400"
            : "bg-transparent group-hover/sidebar:bg-gray-300 group-hover/sidebar:h-24",
          "group-focus-within/sidebar:bg-gray-300",
        )}
      />
    </div>
  );
}
