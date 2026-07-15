"use client";

import { create } from "zustand";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import type { WorldRegionId } from "@/lib/map-scene/schema";

export interface WorldCameraState {
  x: number;
  y: number;
  zoomRatio: number;
}

interface WorldMapState {
  camera: WorldCameraState;
  selectedId: WorldRegionId | null;
  hoveredId: WorldRegionId | null;
  /** Click-ripple: a monotonic sequence plus the world-space point that was tapped. */
  ripple: { sequence: number; position: [number, number] };
  suppressClickUntil: number;
  setCamera: (camera: WorldCameraState) => void;
  select: (id: WorldRegionId | null) => void;
  hover: (id: WorldRegionId | null) => void;
  triggerRipple: (position: [number, number]) => void;
  suppressClicks: (milliseconds?: number) => void;
  restore: (camera: WorldCameraState, selectedId: WorldRegionId | null) => void;
  reset: () => void;
}

const HOME_CAMERA: WorldCameraState = {
  x: WORLD_MANIFEST.home.target[0],
  y: WORLD_MANIFEST.home.target[1],
  zoomRatio: WORLD_MANIFEST.home.zoomRatio,
};

export const useWorldMapStore = create<WorldMapState>((set) => ({
  camera: HOME_CAMERA,
  selectedId: null,
  hoveredId: null,
  ripple: { sequence: 0, position: [0, 0] },
  suppressClickUntil: 0,
  setCamera: (camera) => set({ camera }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  triggerRipple: (position) =>
    set((state) => ({ ripple: { sequence: state.ripple.sequence + 1, position } })),
  suppressClicks: (milliseconds = 260) =>
    set({ suppressClickUntil: Date.now() + milliseconds }),
  restore: (camera, selectedId) => set({ camera, selectedId, hoveredId: null }),
  reset: () => set({ camera: HOME_CAMERA, selectedId: null, hoveredId: null }),
}));
