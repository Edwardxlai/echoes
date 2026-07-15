"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import type { WorldRegionId } from "@/lib/map-scene/schema";
import { useWorldMapStore, worldPointer, type WorldCameraState } from "./world-map-store";
import type { WorldMapCanvasItem } from "./WorldMapCanvas";

const WorldMapCanvas = dynamic(() => import("./WorldMapCanvas"), {
  ssr: false,
  loading: () => <div className="worldMapLoading">正在展开世界地图</div>,
});

export interface WorldMapItem extends WorldMapCanvasItem {
  desc: string;
  route: string;
  routeLabel: string;
  accessibleLabel: string;
}

interface WorldMapStageProps {
  items: WorldMapItem[];
}

interface PointerSample {
  x: number;
  y: number;
  type: string;
}

interface DragGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startCamera: WorldCameraState;
  moved: boolean;
}

interface PinchGesture {
  distance: number;
  zoomRatio: number;
  camera: WorldCameraState;
  midpointX: number;
  midpointY: number;
}

const STORAGE_KEY = "echoes:world-map:r3f:v4";
const DRAG_THRESHOLD = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cameraScale(rect: DOMRect, zoomRatio: number) {
  const padding = rect.width <= 560 ? WORLD_MANIFEST.fitPadding.mobile : WORLD_MANIFEST.fitPadding.desktop;
  return Math.min(
    rect.width / WORLD_MANIFEST.worldSize[0],
    rect.height / WORLD_MANIFEST.worldSize[1],
  ) * padding * zoomRatio;
}

function constrainCamera(camera: WorldCameraState, rect: DOMRect): WorldCameraState {
  const zoomRatio = clamp(camera.zoomRatio, ...WORLD_MANIFEST.zoomRange);
  const scale = cameraScale(rect, zoomRatio);
  const visibleHalfWidth = rect.width / scale / 2;
  const visibleHalfHeight = rect.height / scale / 2;
  const oceanMaxX = Math.max(0, WORLD_MANIFEST.environmentSize[0] / 2 - visibleHalfWidth - 4);
  const oceanMaxY = Math.max(0, WORLD_MANIFEST.environmentSize[1] / 2 - visibleHalfHeight - 4);
  const maxX = Math.min(WORLD_MANIFEST.cameraBounds[0], oceanMaxX);
  const maxY = Math.min(WORLD_MANIFEST.cameraBounds[1], oceanMaxY);
  return {
    zoomRatio,
    x: clamp(camera.x, -maxX, maxX),
    y: clamp(camera.y, -maxY, maxY),
  };
}

export function WorldMapStage({ items }: WorldMapStageProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, PointerSample>());
  const dragRef = useRef<DragGesture | null>(null);
  const pinchRef = useRef<PinchGesture | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const camera = useWorldMapStore((state) => state.camera);
  const selectedId = useWorldMapStore((state) => state.selectedId);
  const setCamera = useWorldMapStore((state) => state.setCamera);
  const select = useWorldMapStore((state) => state.select);
  const restore = useWorldMapStore((state) => state.restore);
  const reset = useWorldMapStore((state) => state.reset);
  const suppressClicks = useWorldMapStore((state) => state.suppressClicks);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const activeItem = selectedId ? itemById.get(selectedId) ?? null : null;
  const zoomPercent = Math.round(camera.zoomRatio * 100);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { camera?: WorldCameraState; selectedId?: WorldRegionId };
        const validSelected = parsed.selectedId && itemById.has(parsed.selectedId) ? parsed.selectedId : null;
        const rect = stageRef.current?.getBoundingClientRect();
        if (parsed.camera && rect) restore(constrainCamera(parsed.camera, rect), validSelected);
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    const unsubscribe = useWorldMapStore.subscribe((state) => {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ camera: state.camera, selectedId: state.selectedId }),
      );
    });
    return unsubscribe;
  }, [itemById, restore]);

  const commitCamera = useCallback(
    (next: WorldCameraState) => {
      const rect = stageRef.current?.getBoundingClientRect();
      setCamera(rect ? constrainCamera(next, rect) : next);
    },
    [setCamera],
  );

  const activateRegion = useCallback(
    (id: WorldRegionId) => {
      const state = useWorldMapStore.getState();
      if (Date.now() < state.suppressClickUntil) return;
      const item = itemById.get(id);
      const region = WORLD_MANIFEST.regions.find((candidate) => candidate.id === id);
      if (!item || !region) return;

      if (state.selectedId === id) {
        router.push(item.route);
        return;
      }

      select(id);
      commitCamera({
        x: region.focus.target[0],
        y: region.focus.target[1],
        zoomRatio: region.focus.zoomRatio,
      });
    },
    [commitCamera, itemById, router, select],
  );

  const resetMap = useCallback(() => {
    reset();
  }, [reset]);

  // Translate a screen point into water-plane UV so the sea can ripple under the
  // cursor. `boost` sets the ripple energy (a firm pulse on press, gentle on move).
  const trackPointer = (clientX: number, clientY: number, boost: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = cameraScale(rect, camera.zoomRatio);
    const worldX = camera.x + (clientX - rect.left - rect.width / 2) / scale;
    const worldY = camera.y - (clientY - rect.top - rect.height / 2) / scale;
    const env = WORLD_MANIFEST.environmentSize[0];
    worldPointer.u = worldX / env + 0.5;
    worldPointer.v = worldY / env + 0.5;
    worldPointer.strength = Math.max(worldPointer.strength, boost);
  };

  const beginPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,a,.infoPanel")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    trackPointer(event.clientX, event.clientY, 2.6);

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    event.currentTarget.setPointerCapture(event.pointerId);

    const pointers = [...pointersRef.current.values()].filter((pointer) => pointer.type === "touch");
    if (pointers.length >= 2) {
      const [a, b] = pointers;
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        zoomRatio: camera.zoomRatio,
        camera,
        midpointX: (a.x + b.x) / 2,
        midpointY: (a.y + b.y) / 2,
      };
      dragRef.current = null;
      setIsDragging(true);
      suppressClicks();
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCamera: camera,
      moved: false,
    };
  };

  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const sample = pointersRef.current.get(event.pointerId);
    if (sample) {
      sample.x = event.clientX;
      sample.y = event.clientY;
    }

    trackPointer(event.clientX, event.clientY, 1);

    const touchPointers = [...pointersRef.current.values()].filter((pointer) => pointer.type === "touch");
    if (pinchRef.current && touchPointers.length >= 2) {
      const [a, b] = touchPointers;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pinch = pinchRef.current;
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const nextZoom = clamp(
        pinch.zoomRatio * (distance / pinch.distance),
        ...WORLD_MANIFEST.zoomRange,
      );
      const midpointX = (a.x + b.x) / 2;
      const midpointY = (a.y + b.y) / 2;
      const oldScale = cameraScale(rect, pinch.zoomRatio);
      const nextScale = cameraScale(rect, nextZoom);
      const px = pinch.midpointX - rect.left - rect.width / 2;
      const py = pinch.midpointY - rect.top - rect.height / 2;
      const anchorX = pinch.camera.x + px / oldScale;
      const anchorY = pinch.camera.y - py / oldScale;
      commitCamera({
        zoomRatio: nextZoom,
        x: anchorX - (midpointX - rect.left - rect.width / 2) / nextScale,
        y: anchorY + (midpointY - rect.top - rect.height / 2) / nextScale,
      });
      event.preventDefault();
      suppressClicks();
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setIsDragging(true);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = cameraScale(rect, drag.startCamera.zoomRatio);
    commitCamera({
      ...drag.startCamera,
      x: drag.startCamera.x - dx / scale,
      y: drag.startCamera.y + dy / scale,
    });
    suppressClicks();
    event.preventDefault();
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (pointersRef.current.size === 0) setIsDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = clamp(event.deltaY, -180, 180);
    const requested = clamp(camera.zoomRatio * Math.exp(-delta * 0.0018), ...WORLD_MANIFEST.zoomRange);
    if (Math.abs(requested - camera.zoomRatio) < 0.001) return;
    event.preventDefault();
    const oldScale = cameraScale(rect, camera.zoomRatio);
    const newScale = cameraScale(rect, requested);
    const px = event.clientX - rect.left - rect.width / 2;
    const py = event.clientY - rect.top - rect.height / 2;
    const anchorX = camera.x + px / oldScale;
    const anchorY = camera.y - py / oldScale;
    commitCamera({
      zoomRatio: requested,
      x: anchorX - px / newScale,
      y: anchorY + py / newScale,
    });
  };

  const zoomFromCenter = (amount: number) => {
    commitCamera({ ...camera, zoomRatio: camera.zoomRatio + amount });
  };

  return (
    <div
      ref={stageRef}
      className={`worldMapStage${isDragging ? " is-dragging" : ""}${selectedId ? " has-selection" : ""}`}
      role="region"
      aria-label="知识世界地图。拖动平移，滚轮或双指缩放，第一次选择区域，第二次进入。"
      tabIndex={0}
      onPointerDown={beginPointer}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={handleWheel}
      onKeyDown={(event) => {
        if (event.key === "Escape") resetMap();
        if (event.key === "Home" || event.key === "0") resetMap();
        if (event.key === "+" || event.key === "=") zoomFromCenter(0.1);
        if (event.key === "-" || event.key === "_") zoomFromCenter(-0.1);
        if (event.key === "ArrowLeft") commitCamera({ ...camera, x: camera.x - 4 });
        if (event.key === "ArrowRight") commitCamera({ ...camera, x: camera.x + 4 });
        if (event.key === "ArrowUp") commitCamera({ ...camera, y: camera.y + 4 });
        if (event.key === "ArrowDown") commitCamera({ ...camera, y: camera.y - 4 });
      }}
    >
      <div className="worldMapStage__canvas" aria-hidden="true">
        <WorldMapCanvas
          items={items.map(({ id, title, meta, echo }) => ({ id, title, meta, echo }))}
          onRegionActivate={activateRegion}
        />
      </div>

      <div className="worldMapStage__ambient" aria-hidden="true" />
      <p className="worldMapStage__hint">拖动探索 · 滚轮缩放 · 再次点击进入</p>

      <div className="worldMapControls" role="group" aria-label="地图缩放控制">
        <button
          type="button"
          aria-label="缩小地图"
          disabled={camera.zoomRatio <= WORLD_MANIFEST.zoomRange[0] + 0.001}
          onClick={() => zoomFromCenter(-0.1)}
        >
          −
        </button>
        <output aria-label="当前地图缩放比例">{zoomPercent}%</output>
        <button
          type="button"
          aria-label="放大地图"
          disabled={camera.zoomRatio >= WORLD_MANIFEST.zoomRange[1] - 0.001}
          onClick={() => zoomFromCenter(0.1)}
        >
          ＋
        </button>
        <button type="button" className="worldMapControls__reset" onClick={resetMap}>
          复位
        </button>
      </div>

      {activeItem && (
        <aside className="worldMapInfo is-open" aria-live="polite" aria-label={`${activeItem.title}区域信息`}>
          <button
            type="button"
            className="worldMapInfo__close"
            aria-label="关闭区域信息"
            onClick={resetMap}
          >
            ×
          </button>
          <div className="worldMapInfo__eyebrow">内容大类</div>
          <h2>{activeItem.title}</h2>
          <p className="worldMapInfo__meta">{activeItem.meta}</p>
          <p className="worldMapInfo__desc">{activeItem.desc}</p>
          <Link className="worldMapInfo__enter" href={activeItem.route}>
            <span>{activeItem.routeLabel}</span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      )}

      <nav className="worldMapA11yList" aria-label="世界地图区域列表">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => activateRegion(item.id)}>
            {item.accessibleLabel}
          </button>
        ))}
      </nav>

      <noscript>
        <div className="worldMapStaticFallback">
          <Image src={WORLD_MANIFEST.assets.preview} alt="回响知识世界地图" fill sizes="100vw" />
        </div>
      </noscript>
    </div>
  );
}
