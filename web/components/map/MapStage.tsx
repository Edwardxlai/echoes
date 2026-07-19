"use client";

import Image from "next/image";
import Link from "next/link";
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
  /** Cover thumbnail shown in the info panel (PRD V1.2 change #14; mandatory for videos). */
  cover?: string;
  coverAlt?: string;
  /** External source-platform URL. Rendered as a low-weight link; omitted → no entry at all. */
  sourceHref?: string;
  sourceLabel?: string;
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
  /** Full-stage visual layer that must not inherit the fixed scene rectangle. */
  stageBackground?: ReactNode;
  items: HotspotDef[];
  className?: string;
  /** Server-rendered home zoom before the viewport can be measured. */
  initialZoom?: number;
  /** Fixes the camera canvas to the supplied artwork ratio. */
  sceneAspectRatio?: number;
  /** Chooses whether the initial/reset view shows the whole scene or fills the viewport. */
  fitMode?: "contain" | "cover";
  /** Matches a scene's authored breathing room at desktop and mobile widths. */
  fitPadding?: { desktop: number; mobile: number };
  /** Returns to the fitted scene when the panel close action is used. */
  resetViewOnPanelClose?: boolean;
  /** Keep the selected scene visible while the pointer crosses another region. */
  lockVisualOnSelection?: boolean;
  /** Persist seen data ids and reveal only ids added after the first visit. */
  discoveryNamespace?: string;
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

interface PointerSample {
  clientX: number;
  clientY: number;
  pointerType: string;
}

interface PinchState {
  pointerIds: [number, number];
  startDistance: number;
  startZoom: number;
  anchorSceneX: number;
  anchorSceneY: number;
}

interface StoredDiscoveryState {
  version: 1;
  discoveredIds: string[];
}

interface MapDiscoveryValue {
  enabled: boolean;
  ready: boolean;
  discoveredIds: ReadonlySet<string>;
  revealingIds: ReadonlySet<string>;
}

const MIN_ZOOM = 0.65;
const BASE_ZOOM = 1;
const MAX_ZOOM = 2.4;
const DEFAULT_FOCUS_ZOOM = 1.35;
const BUTTON_ZOOM_STEP = 0.1;
const KEYBOARD_PAN_STEP = 44;
const DRAG_THRESHOLD = 7;
const BASE_PAN_RATIO = 0.12;
// Selecting a landmark is an explicit camera move: even landmarks authored near
// a scene edge must be allowed to reach the viewport centre. Free dragging keeps
// the tighter base envelope so users cannot accidentally lose the whole map.
const FOCUS_PAN_RATIO = 0.5;
const DISCOVERY_STORAGE_PREFIX = "echoes:map-discovery:";
const CAMERA_EPSILON = 0.001;
const DEFAULT_CAMERA: MapCameraState = { x: 0, y: 0, zoom: BASE_ZOOM };

/**
 * The visually active map object. Hover and keyboard focus take precedence over
 * the persistent selection so terrain can respond without opening the panel.
 */
export const MapActiveContext = createContext<string | null>(null);

export const MapDiscoveryContext = createContext<MapDiscoveryValue>({
  enabled: false,
  ready: true,
  discoveredIds: new Set<string>(),
  revealingIds: new Set<string>(),
});

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
  panRatio = BASE_PAN_RATIO,
): MapCameraState {
  const zoom = clamp(isFiniteNumber(camera.zoom) ? camera.zoom : BASE_ZOOM, MIN_ZOOM, MAX_ZOOM);
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
    Math.max(0, (scene.width * zoom - viewport.width) / 2) + viewport.width * panRatio;
  const maxY =
    Math.max(0, (scene.height * zoom - viewport.height) / 2) + viewport.height * panRatio;

  return {
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
    zoom,
  };
}

function getFitZoom(
  viewport: ViewportSize,
  scene: ViewportSize,
  fitMode: "contain" | "cover" = "contain",
  fitPadding = 1,
) {
  if (
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    scene.width <= 0 ||
    scene.height <= 0
  ) {
    return BASE_ZOOM;
  }

  const widthRatio = viewport.width / scene.width;
  const heightRatio = viewport.height / scene.height;
  const requested =
    fitMode === "cover"
      ? Math.max(widthRatio, heightRatio)
      : Math.min(BASE_ZOOM, widthRatio, heightRatio);

  return clamp(requested * fitPadding, MIN_ZOOM, MAX_ZOOM);
}

export function MapStage({
  background,
  stageBackground,
  items,
  className,
  initialZoom,
  sceneAspectRatio,
  fitMode = "contain",
  fitPadding,
  resetViewOnPanelClose = false,
  lockVisualOnSelection = false,
  discoveryNamespace,
}: MapStageProps) {
  const desktopFitPadding = fitPadding?.desktop ?? 1;
  const mobileFitPadding = fitPadding?.mobile ?? desktopFitPadding;
  const discoveryStorageKey = discoveryNamespace
    ? `${DISCOVERY_STORAGE_PREFIX}${discoveryNamespace}:v1`
    : null;
  const itemSignature = items.map((item) => item.id).join("\u001f");
  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items],
  );

  const [camera, setCamera] = useState<MapCameraState>(() => ({
    ...DEFAULT_CAMERA,
    zoom: clamp(initialZoom ?? DEFAULT_CAMERA.zoom, MIN_ZOOM, MAX_ZOOM),
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [discoveryState, setDiscoveryState] = useState<{
    storageKey: string | null;
    discoveredIds: string[];
    revealingIds: string[];
  }>({ storageKey: null, discoveredIds: [], revealingIds: [] });

  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportSizeRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const cameraElementRef = useRef<HTMLDivElement>(null);
  const sceneSizeRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const cameraRef = useRef(camera);
  const selectedRef = useRef(selected);
  const dragRef = useRef<DragState | null>(null);
  const activePointersRef = useRef(new Map<number, PointerSample>());
  const pinchRef = useRef<PinchState | null>(null);
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
  const discoveryReady =
    discoveryStorageKey === null || discoveryState.storageKey === discoveryStorageKey;
  const discoveredIds = useMemo(
    () => new Set(discoveryState.discoveredIds),
    [discoveryState.discoveredIds],
  );
  const revealingIds = useMemo(
    () => new Set(discoveryState.revealingIds),
    [discoveryState.revealingIds],
  );
  const discoveryValue = useMemo<MapDiscoveryValue>(
    () => ({
      enabled: discoveryStorageKey !== null,
      ready: discoveryReady,
      discoveredIds,
      revealingIds,
    }),
    [discoveredIds, discoveryReady, discoveryStorageKey, revealingIds],
  );

  useEffect(() => {
    if (!discoveryStorageKey) return;

    const currentIds = itemSignature ? itemSignature.split("\u001f") : [];
    let previousIds: string[] | null = null;

    try {
      const raw = window.localStorage.getItem(discoveryStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredDiscoveryState>;
        if (parsed.version === 1 && Array.isArray(parsed.discoveredIds)) {
          previousIds = parsed.discoveredIds.filter(
            (id): id is string => typeof id === "string",
          );
        }
      }
    } catch {
      previousIds = null;
    }

    // The first visit establishes a baseline. Only ids added on later visits
    // count as discoveries, which makes a newly ingested collection visible.
    if (previousIds === null) {
      const initializeTimer = window.setTimeout(() => {
        setDiscoveryState({
          storageKey: discoveryStorageKey,
          discoveredIds: currentIds,
          revealingIds: [],
        });
      }, 0);
      try {
        window.localStorage.setItem(
          discoveryStorageKey,
          JSON.stringify({ version: 1, discoveredIds: currentIds } satisfies StoredDiscoveryState),
        );
      } catch {
        // The map remains usable when persistent storage is unavailable.
      }
      return () => window.clearTimeout(initializeTimer);
    }

    const previousSet = new Set(previousIds);
    const revealing = currentIds.filter((id) => !previousSet.has(id));
    const initializeTimer = window.setTimeout(() => {
      setDiscoveryState({
        storageKey: discoveryStorageKey,
        discoveredIds: previousIds,
        revealingIds: revealing,
      });
    }, 0);

    if (revealing.length === 0) {
      return () => window.clearTimeout(initializeTimer);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      const nextIds = [...new Set([...previousIds, ...currentIds])];
      setDiscoveryState({
        storageKey: discoveryStorageKey,
        discoveredIds: nextIds,
        revealingIds: [],
      });
      try {
        window.localStorage.setItem(
          discoveryStorageKey,
          JSON.stringify({ version: 1, discoveredIds: nextIds } satisfies StoredDiscoveryState),
        );
      } catch {
        // The reveal already completed visually, persistence is best effort.
      }
    }, reducedMotion ? 80 : 2300);

    return () => {
      window.clearTimeout(initializeTimer);
      window.clearTimeout(timer);
    };
  }, [discoveryStorageKey, itemSignature]);

  const commitCamera = useCallback(
    (
      update: MapCameraState | ((current: MapCameraState) => MapCameraState),
      panRatio = BASE_PAN_RATIO,
    ) => {
      const proposed = typeof update === "function" ? update(cameraRef.current) : update;
      const next = constrainCamera(
        proposed,
        viewportSizeRef.current,
        sceneSizeRef.current,
        panRatio,
      );
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

  // Every mount is treated as a fresh entry into the region: always open on
  // the computed home/fit view rather than whatever pan/zoom was left over
  // from an earlier visit in the same session.
  useEffect(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      viewportSizeRef.current = { width: rect.width, height: rect.height };
    }
    const sceneElement = cameraElementRef.current;
    if (sceneElement && sceneElement.offsetWidth > 0 && sceneElement.offsetHeight > 0) {
      sceneSizeRef.current = { width: sceneElement.offsetWidth, height: sceneElement.offsetHeight };
    }

    const nextCamera = {
      x: 0,
      y: 0,
      zoom: getFitZoom(
        viewportSizeRef.current,
        sceneSizeRef.current,
        fitMode,
        viewportSizeRef.current.width <= 560 ? mobileFitPadding : desktopFitPadding,
      ),
    };

    cameraRef.current = nextCamera;
    selectedRef.current = null;
    setCamera(nextCamera);
    setSelected(null);
    setHovered(null);
    setFocused(null);

    // Fixed-ratio scenes can receive their final responsive width one frame
    // after hydration. Re-measure cover views so mobile does not open letterboxed.
    if (fitMode === "cover" || desktopFitPadding !== 1 || mobileFitPadding !== 1) {
      const frame = window.requestAnimationFrame(() => {
        const viewportRect = viewportRef.current?.getBoundingClientRect();
        const sceneNode = cameraElementRef.current;
        if (!viewportRect || !sceneNode || sceneNode.offsetWidth <= 0 || sceneNode.offsetHeight <= 0) {
          return;
        }

        const nextViewport = { width: viewportRect.width, height: viewportRect.height };
        const nextScene = { width: sceneNode.offsetWidth, height: sceneNode.offsetHeight };
        viewportSizeRef.current = nextViewport;
        sceneSizeRef.current = nextScene;
        const next = constrainCamera(
          {
            x: 0,
            y: 0,
            zoom: getFitZoom(
              nextViewport,
              nextScene,
              fitMode,
              nextViewport.width <= 560 ? mobileFitPadding : desktopFitPadding,
            ),
          },
          nextViewport,
          nextScene,
        );
        cameraRef.current = next;
        setCamera(next);
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [desktopFitPadding, fitMode, itemSignature, mobileFitPadding]);

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

  useEffect(() => {
    const clearGesture = () => {
      activePointersRef.current.clear();
      pinchRef.current = null;
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("blur", clearGesture);
    return () => window.removeEventListener("blur", clearGesture);
  }, []);

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
      }, FOCUS_PAN_RATIO);
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

  const fitStage = useCallback(() => {
    const viewport = viewportSizeRef.current;
    commitCamera({
      x: 0,
      y: 0,
      zoom: getFitZoom(
        viewport,
        sceneSizeRef.current,
        fitMode,
        viewport.width <= 560 ? mobileFitPadding : desktopFitPadding,
      ),
    });
  }, [commitCamera, desktopFitPadding, fitMode, mobileFitPadding]);

  const closeSelection = useCallback(
    (restoreHotspotFocus: boolean, resetView = false) => {
      const previousId = selectedRef.current;
      if (resetView) fitStage();
      commitSelection(null);

      if (restoreHotspotFocus && previousId) {
        window.requestAnimationFrame(() => {
          hotspotRefs.current.get(previousId)?.focus({ preventScroll: true });
        });
      }
    },
    [commitSelection, fitStage],
  );

  // Reset returns to the fit view: with a frameless full-bleed stage, "100%"
  // is no longer a meaningful home position.
  const resetStage = useCallback(() => {
    fitStage();
    commitSelection(null);
    setHovered(null);
    setFocused(null);
  }, [commitSelection, fitStage]);

  const startPinch = (viewport: HTMLDivElement) => {
    const touchPointers = [...activePointersRef.current.entries()]
      .filter(([, sample]) => sample.pointerType === "touch")
      .slice(0, 2);
    if (touchPointers.length < 2) return false;

    const [[firstId, first], [secondId, second]] = touchPointers;
    const rect = viewport.getBoundingClientRect();
    const midpointX = (first.clientX + second.clientX) / 2 - rect.left - rect.width / 2;
    const midpointY = (first.clientY + second.clientY) / 2 - rect.top - rect.height / 2;
    const distance = Math.max(
      1,
      Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
    );
    const current = cameraRef.current;

    pinchRef.current = {
      pointerIds: [firstId, secondId],
      startDistance: distance,
      startZoom: current.zoom,
      anchorSceneX: (midpointX - current.x) / current.zoom,
      anchorSceneY: (midpointY - current.y) / current.zoom,
    };
    dragRef.current = null;
    suppressClickUntilRef.current = Date.now() + 300;
    setIsDragging(true);

    for (const pointerId of [firstId, secondId]) {
      try {
        viewport.setPointerCapture(pointerId);
      } catch {
        // A pointer can end while the second contact is being registered.
      }
    }
    return true;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    });

    if (event.pointerType === "touch" && pinchRef.current === null) {
      const touchCount = [...activePointersRef.current.values()].filter(
        (sample) => sample.pointerType === "touch",
      ).length;
      if (touchCount >= 2) {
        event.preventDefault();
        startPinch(event.currentTarget);
        return;
      }
    }

    if (pinchRef.current) return;

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
    const pointer = activePointersRef.current.get(event.pointerId);
    if (pointer) {
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
    }

    const pinch = pinchRef.current;
    if (pinch) {
      const first = activePointersRef.current.get(pinch.pointerIds[0]);
      const second = activePointersRef.current.get(pinch.pointerIds[1]);
      if (!first || !second) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const midpointX = (first.clientX + second.clientX) / 2 - rect.left - rect.width / 2;
      const midpointY = (first.clientY + second.clientY) / 2 - rect.top - rect.height / 2;
      const distance = Math.max(
        1,
        Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
      );
      const zoom = clamp(
        pinch.startZoom * (distance / pinch.startDistance),
        MIN_ZOOM,
        MAX_ZOOM,
      );

      event.preventDefault();
      commitCamera({
        zoom,
        x: midpointX - pinch.anchorSceneX * zoom,
        y: midpointY - pinch.anchorSceneY * zoom,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (!drag.dragging) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
      if (event.pointerType === "touch" && Math.abs(deltaY) > Math.abs(deltaX)) return;
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
    const pinch = pinchRef.current;
    const endedPinchPointer = pinch?.pointerIds.includes(event.pointerId) ?? false;
    const drag = dragRef.current;
    const endedDragPointer = drag?.pointerId === event.pointerId;

    activePointersRef.current.delete(event.pointerId);

    if (endedPinchPointer || (endedDragPointer && drag?.dragging)) {
      // Suppress the synthetic click that can follow pointerup on touch devices.
      suppressClickUntilRef.current = Date.now() + 300;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (endedPinchPointer) {
      pinchRef.current = null;
      const touchPointers = [...activePointersRef.current.entries()].filter(
        ([, sample]) => sample.pointerType === "touch",
      );
      if (touchPointers.length >= 2) {
        startPinch(event.currentTarget);
        return;
      }

      const remaining = touchPointers[0];
      dragRef.current = remaining
        ? {
            pointerId: remaining[0],
            startClientX: remaining[1].clientX,
            startClientY: remaining[1].clientY,
            startCameraX: cameraRef.current.x,
            startCameraY: cameraRef.current.y,
            dragging: false,
          }
        : null;
      setIsDragging(false);
      return;
    }

    if (!endedDragPointer) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    finishPointer(event);
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
        resetStage();
        break;
      case "Home":
        fitStage();
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
    closeSelection(true, resetViewOnPanelClose);
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
    discoveryStorageKey ? "has-discovery" : "",
    discoveryStorageKey && !discoveryReady ? "is-discovery-pending" : "",
    revealingIds.size > 0 ? "is-discovery-revealing" : "",
    camera.zoom > BASE_ZOOM + CAMERA_EPSILON ? "is-zoomed-in" : "",
    camera.zoom < BASE_ZOOM - CAMERA_EPSILON ? "is-zoomed-out" : "",
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
      <MapDiscoveryContext.Provider value={discoveryValue}>
      <MapActiveContext.Provider value={visualActiveId}>
        {stageBackground && (
          <div className="mapStage__stageBackground" aria-hidden="true">
            {stageBackground}
          </div>
        )}
        <div
          ref={viewportRef}
          className="mapStage__viewport"
          role="region"
          aria-label="知识地图。拖动可平移，滚轮、双指或加减按钮可缩放，复位按钮显示完整地图，使用 Tab 键浏览地点。"
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
                const isRevealing = revealingIds.has(item.id);
                const hotspotClassName = [
                  "hotspot",
                  item.echo ? "hotspot--echo" : "",
                  item.dim ? "is-dim" : "",
                  isSelected ? "is-selected" : "",
                  isHovered ? "is-hovered" : "",
                  isFocused ? "is-focused" : "",
                  isVisuallyActive ? "is-active" : "",
                  isRevealing ? "is-discovering" : "",
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
                    disabled={!discoveryReady || isRevealing}
                    onPointerEnter={(event) => {
                      if (event.pointerType !== "touch") setHovered(item.id);
                    }}
                    onPointerLeave={() => {
                      setHovered((current) => (current === item.id ? null : current));
                    }}
                    onFocus={(event) => {
                      setFocused(item.id);
                      if (event.currentTarget.matches(":focus-visible")) {
                        focusHotspot({ ...item, focusZoom: cameraRef.current.zoom });
                      }
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
      </MapDiscoveryContext.Provider>

      <p className="mapDiscoveryAnnouncement" aria-live="polite">
        {revealingIds.size > 0 ? `${revealingIds.size} 处新的地图区域正在显影` : ""}
      </p>

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
              onClick={() => closeSelection(true, resetViewOnPanelClose)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className={`infoPanel__head${active.cover ? " has-cover" : ""}`}>
              {active.cover && (
                <Image
                  className="infoPanel__cover"
                  src={active.cover}
                  alt={active.coverAlt ?? ""}
                  width={82}
                  height={109}
                  draggable={false}
                />
              )}
              <div className="infoPanel__headText">
                <div className="infoPanel__eyebrow">{active.eyebrow ?? "已选中"}</div>
                <h2 id={panelTitleId} className="infoPanel__title">
                  {active.title}
                </h2>
                {active.meta && <div className="infoPanel__meta">{active.meta}</div>}
              </div>
            </div>
            {active.desc && <div className="infoPanel__desc">{active.desc}</div>}
            <div className="infoPanel__actions">
              <Link
                ref={primaryActionRef}
                className="infoPanel__enter"
                href={active.route}
              >
                <span>{active.routeLabel ?? "进入"}</span>
                <span aria-hidden="true">→</span>
              </Link>
              {active.secondaryRoute && (
                <Link
                  className="infoPanel__enter infoPanel__enter--secondary"
                  href={active.secondaryRoute}
                >
                  <span>{active.secondaryLabel ?? "看全貌"}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
              {active.sourceHref && (
                <a
                  className="infoPanel__source"
                  href={active.sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{active.sourceLabel ?? "查看原视频"}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>
        )}
      </aside>

      <div className="mapStage__controls mapControls" role="group" aria-label="地图缩放控制">
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
        <output className="mapControls__value" aria-label="当前地图缩放比例">
          {zoomPercent}%
        </output>
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
