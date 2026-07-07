/**
 * Desktop map sidebar width — draggable split, persisted in localStorage.
 * Default layout uses Tailwind `lg:w-96`; custom width only after the user drags.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

const STORAGE_KEY = "foresightatlas_map_sidebar_width";
const CUSTOMIZED_KEY = "foresightatlas_map_sidebar_customized";
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

function readHasCustomWidth(): boolean {
  try {
    return localStorage.getItem(CUSTOMIZED_KEY) === "1";
  } catch {
    return false;
  }
}

interface UseResizableMapSidebarOptions {
  /** Only active on large desktop split view (lg+). */
  enabled: boolean;
}

export function useResizableMapSidebar({ enabled }: UseResizableMapSidebarOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(readStoredWidth);
  const [hasCustomWidth, setHasCustomWidth] = useState(readHasCustomWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const useCustomLayout = hasCustomWidth || isDragging;

  const clampToContainer = useCallback((next: number) => {
    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 1200;
    return clampWidth(next, containerWidth);
  }, []);

  useEffect(() => {
    if (!enabled || !useCustomLayout) return;
    setWidth((prev) => clampToContainer(prev));
  }, [enabled, useCustomLayout, clampToContainer]);

  useEffect(() => {
    if (!enabled || !useCustomLayout) return;
    const onResize = () => setWidth((prev) => clampToContainer(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, useCustomLayout, clampToContainer]);

  const persistWidth = useCallback(
    (next: number) => {
      const clamped = clampToContainer(next);
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped));
        localStorage.setItem(CUSTOMIZED_KEY, "1");
      } catch {
        // ignore
      }
      setHasCustomWidth(true);
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
    (event: MouseEvent<HTMLElement>, measuredWidth: number) => {
      if (!enabled) return;
      event.preventDefault();
      const startWidth = useCustomLayout ? width : measuredWidth;
      dragRef.current = { startX: event.clientX, startWidth };
      if (!useCustomLayout) {
        setWidth(clampToContainer(startWidth));
      }
      setIsDragging(true);
    },
    [enabled, width, useCustomLayout, clampToContainer],
  );

  const clearStoredWidth = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CUSTOMIZED_KEY);
    } catch {
      // ignore
    }
    setHasCustomWidth(false);
    setWidth(MAP_SIDEBAR_DEFAULT_WIDTH);
  }, []);

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
        clearStoredWidth();
      }
    },
    [enabled, persistWidth, clearStoredWidth],
  );

  const maxWidth = clampToContainer(9999);

  return {
    containerRef,
    width,
    hasCustomWidth: useCustomLayout,
    isDragging,
    onResizeStart,
    onResizeKeyDown,
    onResizeDoubleClick: clearStoredWidth,
    minWidth: MIN_WIDTH,
    maxWidth,
  };
}
