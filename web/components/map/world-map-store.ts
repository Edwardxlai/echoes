"use client";

import { create } from "zustand";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import type { WorldRegionId } from "@/lib/map-scene/schema";

export interface WorldCameraState {
  x: number;
  y: number;
  zoomRatio: number;
}

/**
 * Cursor position over the sea, in water-plane UV space, plus a decaying strength.
 * Shared as a plain mutable object so high-frequency pointer moves drive the water
 * shader without triggering React re-renders.
 */
export const worldPointer = { u: 0.5, v: 0.5, strength: 0 };

interface WorldMapState {
  camera: WorldCameraState;
  selectedId: WorldRegionId | null;
  hoveredId: WorldRegionId | null;
  suppressClickUntil: number;
  setCamera: (camera: WorldCameraState) => void;
  select: (id: WorldRegionId | null) => void;
  hover: (id: WorldRegionId | null) => void;
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
  suppressClickUntil: 0,
  setCamera: (camera) => set({ camera }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  suppressClicks: (milliseconds = 260) =>
    set({ suppressClickUntil: Date.now() + milliseconds }),
  restore: (camera, selectedId) => set({ camera, selectedId, hoveredId: null }),
  reset: () => set({ camera: HOME_CAMERA, selectedId: null, hoveredId: null }),
}));
