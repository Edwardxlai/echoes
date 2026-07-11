"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export interface HotspotDef {
  id: string;
  x: number;
  y: number;
  title: string;
  meta?: ReactNode;
  desc?: ReactNode;
  route: string;
  routeLabel?: string;
  secondaryRoute?: string;
  secondaryLabel?: string;
  echo?: boolean;
  dim?: boolean;
  /** Percentage coordinates (0–100) to centre when this hotspot is selected. */
  focusX?: number;
  focusY?: number;
  /** Requested camera zoom for this hotspot. Values are clamped to the stage limits. */
  focusZoom?: number;
  eyebrow?: ReactNode;
  /** Full spoken label for the semantic button when the visible title is too terse. */
  accessibleLabel?: string;
  /** Stable configured hit proxy id from MapItem.hitArea. */
  hitArea?: string;
  /** Optional 0–100 SVG path used as a precise pointer proxy for a map region. */
  hitPath?: string;
  hitBox?: {
    shape: "ellipse" | "rounded";
    width: number;
    height: number;
    mobileWidth: number;
    mobileHeight: number;
  };
}

interface MapStageProps {
  background: ReactNode;
  items: HotspotDef[];
  className?: string;
  /** Changes the persistence namespace when the scene coordinate system changes. */
  storageRevision?: string;
  /** Fixes the camera canvas to the supplied artwork ratio. */
  sceneAspectRatio?: number;
  /** Keep the selected scene visible while the pointer crosses another region. */
  lockVisualOnSelection?: boolean;
}

export interface MapCameraState {
  x: number;
  y: number;
  zoom: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCameraX: number;
  startCameraY: number;
  dragging: boolean;
}

interface StoredMapStageState {
  version: 1;
  camera: MapCameraState;
  selected: string | null;
  viewport?: ViewportSize;
  scene?: ViewportSize;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.4;
const DEFAULT_FOCUS_ZOOM = 1.35;
const BUTTON_ZOOM_STEP = 0.2;
const KEYBOARD_PAN_STEP = 44;
const DRAG_THRESHOLD = 7;
const BASE_PAN_RATIO = 0.08;
const STORAGE_PREFIX = "echoes:map-stage:";
const CAMERA_EPSILON = 0.001;
const DEFAULT_CAMERA: MapCameraState = { x: 0, y: 0, zoom: MIN_ZOOM };

/**
 * The visually active map object. Hover and keyboard focus take precedence over
 * the persistent selection so terrain can respond without opening the panel.
 */
export const MapActiveContext = createContext<string | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function camerasMatch(a: MapCameraState, b: MapCameraState) {
  return (
    Math.abs(a.x - b.x) < CAMERA_EPSILON &&
    Math.abs(a.y - b.y) < CAMERA_EPSILON &&
    Math.abs(a.zoom - b.zoom) < CAMERA_EPSILON
  );
}

function constrainCamera(
  camera: MapCameraState,
  viewport: ViewportSize,
  scene: ViewportSize = viewport,
): MapCameraState {
  const zoom = clamp(isFiniteNumber(camera.zoom) ? camera.zoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const x = isFiniteNumber(camera.x) ? camera.x : 0;
  const y = isFiniteNumber(camera.y) ? camera.y : 0;

  // Before the ResizeObserver has measured the viewport, retain restored pan.
  // The first measurement will scale and clamp it to the real dimensions.
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { x, y, zoom };
  }

  // A small base envelope keeps drag-pan meaningful at 100%. The viewport's
  // own background can remain visible at the extreme edge; zoom adds the usual
  // half-overflow allowance on top of it.
  const maxX =
    Math.max(0, (scene.width * zoom - viewport.width) / 2) + viewport.width * BASE_PAN_RATIO;
  const maxY =
    Math.max(0, (scene.height * zoom - viewport.height) / 2) + viewport.height * BASE_PAN_RATIO;

  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
    zoom,
  };
}

function cameraFromStoredValue(value: unknown): MapCameraState | null {
  if (!value || typeof value !== "object") return null;

  const camera = value as Partial<MapCameraState>;
  if (!isFiniteNumber(camera.x) || !isFiniteNumber(camera.y) || !isFiniteNumber(camera.zoom)) {
    return null;
  }

  return {
    x: camera.x,
    y: camera.y,
    zoom: clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM),
  };
}

function readStoredState(
  storageKey: string,
  validIds: Set<string>,
  viewport: ViewportSize,
  scene: ViewportSize,
): Pick<StoredMapStageState, "camera" | "selected"> | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredMapStageState>;
    if (!parsed || parsed.version !== 1) return null;

    let camera = cameraFromStoredValue(parsed.camera);
    if (!camera) return null;

    // Preserve the same relative pan if Back is used after the viewport resized.
    const storedBasis = parsed.scene ?? parsed.viewport;
    const nextBasis = scene.width > 0 && scene.height > 0 ? scene : viewport;
    if (
      storedBasis &&
      isFiniteNumber(storedBasis.width) &&
      isFiniteNumber(storedBasis.height) &&
      storedBasis.width > 0 &&
      storedBasis.height > 0 &&
      nextBasis.width > 0 &&
      nextBasis.height > 0
    ) {
      camera = {
        ...camera,
        x: camera.x * (nextBasis.width / storedBasis.width),
        y: camera.y * (nextBasis.height / storedBasis.height),
      };
    }

    camera = constrainCamera(camera, viewport, scene);

    const selected =
      typeof parsed.selected === "string" && validIds.has(parsed.selected)
        ? parsed.selected
        : null;

    return { camera, selected };
  } catch {
    // Storage can be unavailable in privacy modes, and stale JSON should never
    // make the map unusable.
    return null;
  }
}

function writeStoredState(
  storageKey: string,
  camera: MapCameraState,
  selected: string | null,
  viewport: ViewportSize,
  scene: ViewportSize,
) {
  try {
    const state: StoredMapStageState = {
      version: 1,
      camera,
      selected,
      viewport,
      scene,
    };
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Persistence is an enhancement; interaction must continue if storage is
    // blocked or its quota is exhausted.
  }
}

export function MapStage({
  background,
  items,
  className,
  storageRevision,
  sceneAspectRatio,
  lockVisualOnSelection = false,
}: MapStageProps) {
  const pathname = usePathname();
  const storageKey = `${STORAGE_PREFIX}${pathname}${storageRevision ? `:${storageRevision}` : ""}`;
  const itemSignature = items.map((item) => item.id).join("\u001f");
  const validIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items],
  );

  const [camera, setCamera] = useState<MapCameraState>(DEFAULT_CAMERA);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportSizeRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const cameraElementRef = useRef<HTMLDivElement>(null);
  const sceneSizeRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const cameraRef = useRef(camera);
  const selectedRef = useRef(selected);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const hotspotRefs = useRef(new Map<string, HTMLButtonElement>());
  const primaryActionRef = useRef<HTMLAnchorElement>(null);

  const reactId = useId().replace(/:/g, "");
  const panelId = `map-info-${reactId}`;
  const panelTitleId = `${panelId}-title`;

  const active = selected ? (itemById.get(selected) ?? null) : null;
  const visualActiveId =
    lockVisualOnSelection && selected ? selected : (hovered ?? focused ?? selected);
  const zoomPercent = Math.round(camera.zoom * 100);

  const commitCamera = useCallback(
    (update: MapCameraState | ((current: MapCameraState) => MapCameraState)) => {
      const proposed = typeof update === "function" ? update(cameraRef.current) : update;
      const next = constrainCamera(proposed, viewportSizeRef.current, sceneSizeRef.current);
      if (camerasMatch(cameraRef.current, next)) return;

      cameraRef.current = next;
      setCamera(next);
    },
    [],
  );

  const commitSelection = useCallback((id: string | null) => {
    selectedRef.current = id;
    setSelected(id);
  }, []);

  const persistSnapshot = useCallback(() => {
    writeStoredState(
      storageKey,
      cameraRef.current,
      selectedRef.current,
      viewportSizeRef.current,
      sceneSizeRef.current,
    );
  }, [storageKey]);

  // Restore only after hydration. Tracking the restored key separately avoids
  // the initial default state overwriting the saved state in a sibling effect.
  useEffect(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      viewportSizeRef.current = { width: rect.width, height: rect.height };
    }
    const sceneElement = cameraElementRef.current;
    if (sceneElement && sceneElement.offsetWidth > 0 && sceneElement.offsetHeight > 0) {
      sceneSizeRef.current = { width: sceneElement.offsetWidth, height: sceneElement.offsetHeight };
    }

    const restored = readStoredState(
      storageKey,
      validIds,
      viewportSizeRef.current,
      sceneSizeRef.current,
    );
    const nextCamera = restored?.camera ?? DEFAULT_CAMERA;
    const nextSelected = restored?.selected ?? null;

    cameraRef.current = nextCamera;
    selectedRef.current = nextSelected;
    setCamera(nextCamera);
    setSelected(nextSelected);
    setHovered(null);
    setFocused(null);
    setRestoredStorageKey(storageKey);
  }, [itemSignature, storageKey, validIds]);

  // Keep pan proportional on responsive resizes, then enforce the no-empty-edge
  // bounds at the new viewport size.
  useEffect(() => {
    const viewport = viewportRef.current;
    const sceneElement = cameraElementRef.current;
    if (!viewport || !sceneElement) return;

    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const previousSceneSize = sceneSizeRef.current;
      const nextSize = { width: rect.width, height: rect.height };
      const nextSceneSize = {
        width: sceneElement.offsetWidth,
        height: sceneElement.offsetHeight,
      };
      viewportSizeRef.current = nextSize;
      sceneSizeRef.current = nextSceneSize;

      const current = cameraRef.current;
      const resized =
        previousSceneSize.width > 0 && previousSceneSize.height > 0
          ? {
              ...current,
              x: current.x * (nextSceneSize.width / previousSceneSize.width),
              y: current.y * (nextSceneSize.height / previousSceneSize.height),
            }
          : current;
      const next = constrainCamera(resized, nextSize, nextSceneSize);

      if (!camerasMatch(current, next)) {
        cameraRef.current = next;
        setCamera(next);
      }
    };

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(sceneElement);
    return () => observer.disconnect();
  }, []);

  // Session storage is synchronous, so coalesce high-frequency drag and wheel
  // updates. pagehide and Link.onNavigate below also force an immediate save.
  useEffect(() => {
    if (restoredStorageKey !== storageKey) return;

    const timeout = window.setTimeout(persistSnapshot, 80);
    return () => window.clearTimeout(timeout);
  }, [camera, persistSnapshot, restoredStorageKey, selected, storageKey]);

  useEffect(() => {
    if (restoredStorageKey !== storageKey) return;

    const handlePageHide = () => persistSnapshot();
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      persistSnapshot();
    };
  }, [persistSnapshot, restoredStorageKey, storageKey]);

  const zoomAroundPoint = useCallback(
    (requestedZoom: number, pointX: number, pointY: number) => {
      commitCamera((current) => {
        const zoom = clamp(requestedZoom, MIN_ZOOM, MAX_ZOOM);
        if (Math.abs(zoom - current.zoom) < CAMERA_EPSILON) return current;

        const ratio = zoom / current.zoom;
        return {
          zoom,
          x: pointX - (pointX - current.x) * ratio,
          y: pointY - (pointY - current.y) * ratio,
        };
      });
    },
    [commitCamera],
  );

  // A native non-passive listener is intentional: React/browser passive wheel
  // delegation is not consistent enough for a map that must prevent page scroll
  // only while it can actually consume the gesture.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      const current = cameraRef.current;
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? Math.max(1, viewportSizeRef.current.height)
            : 1;
      const delta = clamp(event.deltaY * unit, -240, 240);
      const requestedZoom = clamp(current.zoom * Math.exp(-delta * 0.0018), MIN_ZOOM, MAX_ZOOM);

      if (Math.abs(requestedZoom - current.zoom) < CAMERA_EPSILON) return;

      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoomAroundPoint(
        requestedZoom,
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
      );
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomAroundPoint]);

  const focusHotspot = useCallback(
    (item: HotspotDef) => {
      const viewport = viewportSizeRef.current;
      const scene = sceneSizeRef.current;
      if (viewport.width <= 0 || viewport.height <= 0 || scene.width <= 0 || scene.height <= 0) return;

      commitCamera((current) => {
        const zoom = clamp(
          item.focusZoom ?? Math.max(current.zoom, DEFAULT_FOCUS_ZOOM),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        const focusX = clamp(item.focusX ?? item.x, 0, 100) / 100;
        const focusY = clamp(item.focusY ?? item.y, 0, 100) / 100;

        return {
          zoom,
          x: (0.5 - focusX) * scene.width * zoom,
          y: (0.5 - focusY) * scene.height * zoom,
        };
      });
    },
    [commitCamera],
  );

  const selectHotspot = useCallback(
    (item: HotspotDef, focusPanelAction = false) => {
      commitSelection(item.id);
      focusHotspot(item);

      if (focusPanelAction) {
        window.requestAnimationFrame(() => {
          primaryActionRef.current?.focus({ preventScroll: true });
        });
      }
    },
    [commitSelection, focusHotspot],
  );

  const closeSelection = useCallback(
    (restoreHotspotFocus: boolean) => {
      const previousId = selectedRef.current;
      commitSelection(null);

      if (restoreHotspotFocus && previousId) {
        window.requestAnimationFrame(() => {
          hotspotRefs.current.get(previousId)?.focus({ preventScroll: true });
        });
      }
    },
    [commitSelection],
  );

  const resetStage = useCallback(() => {
    commitCamera(DEFAULT_CAMERA);
    commitSelection(null);
    setHovered(null);
    setFocused(null);
  }, [commitCamera, commitSelection]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCameraX: cameraRef.current.x,
      startCameraY: cameraRef.current.y,
      dragging: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (!drag.dragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
      drag.dragging = true;
      setIsDragging(true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer may have ended between the move and capture calls.
      }
    }

    event.preventDefault();
    commitCamera({
      ...cameraRef.current,
      x: drag.startCameraX + deltaX,
      y: drag.startCameraY + deltaY,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.dragging) {
      // Suppress the synthetic click that can follow pointerup on touch devices.
      suppressClickUntilRef.current = Date.now() + 300;
    }

    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.dragging) suppressClickUntilRef.current = Date.now() + 300;
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntilRef.current) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".hotspot, .mapRegionHit")) return;

    // An intentional tap on empty terrain dismisses the panel without resetting
    // the user's camera. Moving focus to the viewport also clears stale :focus.
    closeSelection(false);
    setFocused(null);
    viewportRef.current?.focus({ preventScroll: true });
  };

  const handleViewportKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;

    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        commitCamera((current) => ({ ...current, x: current.x + KEYBOARD_PAN_STEP }));
        break;
      case "ArrowRight":
        commitCamera((current) => ({ ...current, x: current.x - KEYBOARD_PAN_STEP }));
        break;
      case "ArrowUp":
        commitCamera((current) => ({ ...current, y: current.y + KEYBOARD_PAN_STEP }));
        break;
      case "ArrowDown":
        commitCamera((current) => ({ ...current, y: current.y - KEYBOARD_PAN_STEP }));
        break;
      case "+":
      case "=":
        zoomAroundPoint(cameraRef.current.zoom + BUTTON_ZOOM_STEP, 0, 0);
        break;
      case "-":
      case "_":
        zoomAroundPoint(cameraRef.current.zoom - BUTTON_ZOOM_STEP, 0, 0);
        break;
      case "0":
        commitCamera(DEFAULT_CAMERA);
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  };

  const handleStageKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || selectedRef.current === null) return;
    event.preventDefault();
    event.stopPropagation();
    closeSelection(true);
  };

  const cameraStyle: CSSProperties = {
    transform: sceneAspectRatio
      ? `translate3d(calc(-50% + ${camera.x}px), calc(-50% + ${camera.y}px), 0) scale(${camera.zoom})`
      : `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
    transformOrigin: "50% 50%",
    willChange: "transform",
    ...(sceneAspectRatio
      ? ({ "--scene-aspect-ratio": sceneAspectRatio } as CSSProperties)
      : null),
  };

  const stageClassName = [
    "mapStage",
    className,
    active ? "has-selection" : "",
    isDragging ? "is-dragging" : "",
    camera.zoom > MIN_ZOOM + CAMERA_EPSILON ? "is-zoomed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={stageClassName}
      data-selected-id={selected ?? undefined}
      data-zoom={camera.zoom.toFixed(2)}
      onKeyDownCapture={handleStageKeyDownCapture}
    >
      <MapActiveContext.Provider value={visualActiveId}>
        <div
          ref={viewportRef}
          className="mapStage__viewport"
          role="region"
          aria-label="知识地图。拖动可平移，滚轮或加减按钮可缩放，使用 Tab 键浏览地点。"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onLostPointerCapture={handleLostPointerCapture}
          onClick={handleViewportClick}
          onKeyDown={handleViewportKeyDown}
          onDragStart={(event) => event.preventDefault()}
        >
          <div
            ref={cameraElementRef}
            className={`mapStage__camera${sceneAspectRatio ? " has-fixed-scene" : ""}`}
            style={cameraStyle}
          >
            <div
              className="mapStage__background"
              aria-hidden="true"
              style={{ pointerEvents: "none" }}
            >
              {background}
            </div>

            <div className="mapStage__hotspots" role="group" aria-label="地图地点">
              {items.some((item) => item.hitPath) && (
                <svg
                  className="mapStage__regionHits"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  {items.map((item) =>
                    item.hitPath ? (
                      <path
                        key={item.id}
                        className={`mapRegionHit${visualActiveId === item.id ? " is-active" : ""}`}
                        d={item.hitPath}
                        data-region-id={item.id}
                        onPointerEnter={(event) => {
                          if (event.pointerType !== "touch") setHovered(item.id);
                        }}
                        onPointerLeave={() => {
                          setHovered((current) => (current === item.id ? null : current));
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (Date.now() < suppressClickUntilRef.current) {
                            event.preventDefault();
                            return;
                          }
                          selectHotspot(item);
                        }}
                      />
                    ) : null,
                  )}
                </svg>
              )}
              {items.map((item) => {
                const isSelected = selected === item.id;
                const isHovered = hovered === item.id;
                const isFocused = focused === item.id;
                const isVisuallyActive = visualActiveId === item.id;
                const hotspotClassName = [
                  "hotspot",
                  item.echo ? "hotspot--echo" : "",
                  item.dim ? "is-dim" : "",
                  isSelected ? "is-selected" : "",
                  isHovered ? "is-hovered" : "",
                  isFocused ? "is-focused" : "",
                  isVisuallyActive ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) hotspotRefs.current.set(item.id, node);
                      else hotspotRefs.current.delete(item.id);
                    }}
                    type="button"
                    className={hotspotClassName}
                    style={
                      {
                        left: `${item.x}%`,
                        top: `${item.y}%`,
                        "--hit-width": `${item.hitBox?.width ?? 150}px`,
                        "--hit-height": `${item.hitBox?.height ?? 100}px`,
                        "--hit-mobile-width": `${item.hitBox?.mobileWidth ?? 110}px`,
                        "--hit-mobile-height": `${item.hitBox?.mobileHeight ?? 72}px`,
                      } as CSSProperties
                    }
                    data-hotspot-id={item.id}
                    data-hit-area={item.hitArea}
                    data-hit-shape={item.hitBox?.shape}
                    aria-label={item.accessibleLabel ?? item.title}
                    aria-pressed={isSelected}
                    aria-expanded={isSelected}
                    aria-controls={panelId}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "touch") setHovered(item.id);
                    }}
                    onPointerLeave={() => {
                      setHovered((current) => (current === item.id ? null : current));
                    }}
                    onFocus={() => {
                      setFocused(item.id);
                      focusHotspot({ ...item, focusZoom: cameraRef.current.zoom });
                    }}
                    onBlur={() => {
                      setFocused((current) => (current === item.id ? null : current));
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      selectHotspot(item, true);
                    }}
                    onClick={(event) => {
                      if (Date.now() < suppressClickUntilRef.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      selectHotspot(item, event.detail === 0);
                    }}
                  >
                    <span className="hotspot__hitArea" aria-hidden="true" />
                    <span className="hotspot__marker" aria-hidden="true" />
                    <span className="hotspot__label">{item.title}</span>
                    {item.meta && <span className="hotspot__meta">{item.meta}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </MapActiveContext.Provider>

      <aside
        id={panelId}
        className={`infoPanel${active ? " is-open" : ""}`}
        aria-hidden={!active}
        aria-live="polite"
        aria-atomic="true"
        aria-labelledby={active ? panelTitleId : undefined}
      >
        {active && (
          <div className="infoPanel__content">
            <button
              type="button"
              className="infoPanel__close"
              aria-label={`关闭“${active.title}”信息面板`}
              onClick={() => closeSelection(true)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="infoPanel__eyebrow">{active.eyebrow ?? "已选中"}</div>
            <h2 id={panelTitleId} className="infoPanel__title">
              {active.title}
            </h2>
            {active.meta && <div className="infoPanel__meta">{active.meta}</div>}
            {active.desc && <div className="infoPanel__desc">{active.desc}</div>}
            <div className="infoPanel__actions">
              <Link
                ref={primaryActionRef}
                className="infoPanel__enter"
                href={active.route}
                onClick={persistSnapshot}
                onNavigate={persistSnapshot}
              >
                <span>{active.routeLabel ?? "进入"}</span>
                <span aria-hidden="true">→</span>
              </Link>
              {active.secondaryRoute && (
                <Link
                  className="infoPanel__enter infoPanel__enter--secondary"
                  href={active.secondaryRoute}
                  onClick={persistSnapshot}
                  onNavigate={persistSnapshot}
                >
                  <span>{active.secondaryLabel ?? "看全貌"}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </aside>

      <div className="mapStage__controls mapControls" role="group" aria-label="地图缩放控制">
        <button
          type="button"
          className="mapControls__button mapControls__button--zoom-in"
          aria-label="放大地图"
          title="放大地图"
          disabled={camera.zoom >= MAX_ZOOM - CAMERA_EPSILON}
          onClick={() => zoomAroundPoint(cameraRef.current.zoom + BUTTON_ZOOM_STEP, 0, 0)}
        >
          <span aria-hidden="true">＋</span>
        </button>
        <output className="mapControls__value" aria-label="当前地图缩放比例">
          {zoomPercent}%
        </output>
        <button
          type="button"
          className="mapControls__button mapControls__button--zoom-out"
          aria-label="缩小地图"
          title="缩小地图"
          disabled={camera.zoom <= MIN_ZOOM + CAMERA_EPSILON}
          onClick={() => zoomAroundPoint(cameraRef.current.zoom - BUTTON_ZOOM_STEP, 0, 0)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          className="mapControls__button mapControls__button--reset"
          aria-label="重置地图视图和选择"
          title="重置地图视图和选择"
          onClick={resetStage}
        >
          复位
        </button>
      </div>
    </div>
  );
}
