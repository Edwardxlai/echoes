export type WorldRegionId = "region-eco" | "region-his" | "region-tech";

export interface WorldCameraPreset {
  target: [number, number];
  zoomRatio: number;
}

export interface WorldRegionManifest {
  id: WorldRegionId;
  entityId: "eco" | "his" | "tech";
  anchor: [number, number, number];
  hitSize: [number, number];
  rippleAnchor: [number, number];
  focus: WorldCameraPreset;
  mask: string;
  landmark: string;
  tint: string;
}

export type WorldExpansionIslandState = "locked" | "available" | "hidden";

export interface WorldExpansionIslandManifest {
  id: string;
  state: WorldExpansionIslandState;
  position: [number, number, number];
  size: [number, number];
  assets: {
    terrain: string;
    contactShadow: string;
    height: string;
    mask: string;
    coast: {
      shallow: string;
      wetContact: string;
      foam: string;
    };
  };
}

export interface WorldSceneManifest {
  id: "world";
  version: 1;
  aspectRatio: number;
  worldSize: [number, number];
  environmentSize: [number, number];
  cameraBounds: [number, number];
  home: WorldCameraPreset;
  fitPadding: { desktop: number; mobile: number };
  zoomRange: [number, number];
  assets: {
    preview: string;
    environment: string;
    terrain: string;
    contactShadow: string;
    height: string;
    water: {
      baseColor: string;
      normal: string;
      roughness: string;
      flow: string;
      ripples: [string, string, string, string, string, string];
    };
    coast: {
      shallow: string;
      wetContact: string;
      foam: string;
    };
    clouds: {
      far: [string, string, string, string];
      mid: [string, string, string, string];
      front: [string, string, string, string];
    };
  };
  regions: WorldRegionManifest[];
  expansionIslands: WorldExpansionIslandManifest[];
}
