/**
 * Desktop map sidebar width — draggable split, persisted in localStorage.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

const STORAGE_KEY = "foresightatlas_map_sidebar_width";
export const MAP_SIDEBAR_DEFAULT_WIDTH = 384;
const MIN_WIDTH = 300;
const MAX_WIDTH_RATIO = 0.58;

function clampWidth(width: number, containerWidth: number): number {
  const max = Math.max(MIN_WIDTH, Math.floor(containerWidth * MAX_WIDTH_RATIO));
  return Math.min(max, Math.max(MIN_WIDTH, Math.round(width)));
}

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= MIN_WIDTH) return parsed;
  } catch {
    // ignore
  }
  return MAP_SIDEBAR_DEFAULT_WIDTH;
}

interface UseResizableMapSidebarOptions {
  /** Only active on large desktop split view (lg+). */
  enabled: boolean;
}

export function useResizableMapSidebar({ enabled }: UseResizableMapSidebarOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(readStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const clampToContainer = useCallback((next: number) => {
    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 1200;
    return clampWidth(next, containerWidth);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setWidth((prev) => clampToContainer(prev));
  }, [enabled, clampToContainer]);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setWidth((prev) => clampToContainer(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, clampToContainer]);

  const persistWidth = useCallback(
    (next: number) => {
      const clamped = clampToContainer(next);
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
      return clamped;
    },
    [clampToContainer],
  );

  useEffect(() => {
    if (!isDragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startX - event.clientX;
      setWidth(clampToContainer(drag.startWidth + delta));
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      setWidth((prev) => persistWidth(prev));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isDragging, clampToContainer, persistWidth]);

  const onResizeStart = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: width };
      setIsDragging(true);
    },
    [enabled, width],
  );

  const resetWidth = useCallback(() => {
    setWidth(persistWidth(MAP_SIDEBAR_DEFAULT_WIDTH));
  }, [persistWidth]);

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      const step = event.shiftKey ? 48 : 16;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setWidth((prev) => persistWidth(prev + step));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setWidth((prev) => persistWidth(prev - step));
      } else if (event.key === "Home") {
        event.preventDefault();
        resetWidth();
      }
    },
    [enabled, persistWidth, resetWidth],
  );

  const maxWidth = clampToContainer(9999);

  return {
    containerRef,
    width,
    isDragging,
    onResizeStart,
    onResizeKeyDown,
    onResizeDoubleClick: resetWidth,
    minWidth: MIN_WIDTH,
    maxWidth,
  };
}
