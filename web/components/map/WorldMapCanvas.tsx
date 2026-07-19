"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { easing } from "maath";
import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  OrthographicCamera,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  Vector2,
} from "three";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import type {
  WorldExpansionIslandManifest,
  WorldRegionId,
  WorldRegionManifest,
} from "@/lib/map-scene/schema";
import { useWorldMapStore } from "./world-map-store";
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from "./water-shader";

export interface WorldMapCanvasItem {
  id: WorldRegionId;
  title: string;
  meta: string;
  echo: boolean;
}

interface WorldMapCanvasProps {
  items: WorldMapCanvasItem[];
  regionFogStates: Partial<Record<WorldRegionId, WorldRegionFogState>>;
  onRegionActivate: (id: WorldRegionId) => void;
}

export type WorldRegionFogState = "hidden" | "locked" | "revealing" | "unlocked";

type WorldInteractiveRegion = Pick<WorldRegionManifest, "id" | "anchor" | "hitSize">;

const [WORLD_WIDTH, WORLD_HEIGHT] = WORLD_MANIFEST.worldSize;

function prepareTexture(texture: Texture, repeat = false, srgb = true) {
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

function revealEase(elapsed: number, delay: number, duration: number) {
  const t = Math.min(1, Math.max(0, (elapsed - delay) / duration));
  return t * t * (3 - 2 * t);
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function CameraRig() {
  const cameraState = useWorldMapStore((state) => state.camera);
  const { camera, size } = useThree();

  useFrame((_, delta) => {
    const orthographic = camera as OrthographicCamera;
    const padding = size.width <= 560 ? WORLD_MANIFEST.fitPadding.mobile : WORLD_MANIFEST.fitPadding.desktop;
    const fit = Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT) * padding;
    easing.damp(orthographic.position, "x", cameraState.x, 0.2, delta);
    easing.damp(orthographic.position, "y", cameraState.y, 0.2, delta);
    easing.damp(orthographic, "zoom", fit * cameraState.zoomRatio, 0.2, delta);
    orthographic.updateProjectionMatrix();
  });

  return null;
}

function WaterLayer({ reducedMotion }: { reducedMotion: boolean }) {
  const sources = useTexture([
    WORLD_MANIFEST.assets.water.baseColor,
    WORLD_MANIFEST.assets.water.normal,
    WORLD_MANIFEST.assets.water.roughness,
    WORLD_MANIFEST.assets.water.flow,
  ]);
  const materialRef = useRef<ShaderMaterial>(null);
  const { size } = useThree();
  const textures = useMemo(
    () =>
      sources.map((source, index) => {
        const texture = source.clone();
        prepareTexture(texture, true, index === 0);
        return texture;
      }),
    [sources],
  );
  const uniforms = useMemo(
    () => ({
      uBaseColor: { value: textures[0] },
      uNormal: { value: textures[1] },
      uRoughness: { value: textures[2] },
      uFlow: { value: textures[3] },
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uNormalStrength: { value: size.width <= 560 ? 0.14 : 0.22 },
      uUvScale: { value: new Vector2(1, 1) },
    }),
    [reducedMotion, size.width, textures],
  );

  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    material.uniforms.uNormalStrength.value = size.width <= 560 ? 0.14 : 0.22;
  });

  return (
    <mesh position={[0, 0, 0]} renderOrder={0}>
      <planeGeometry args={WORLD_MANIFEST.environmentSize} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
        fragmentShader={WATER_FRAGMENT_SHADER}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function TexturePlane({
  url,
  position,
  size = WORLD_MANIFEST.worldSize,
  color = "#ffffff",
  opacity = 1,
  renderOrder = 1,
  introDelay,
  reducedMotion = false,
}: {
  url: string;
  position: [number, number, number];
  size?: [number, number];
  color?: string;
  opacity?: number;
  renderOrder?: number;
  /** When set, the layer fades and rises into place shortly after mount. */
  introDelay?: number;
  reducedMotion?: boolean;
}) {
  const texture = useTexture(url);
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  useMemo(() => prepareTexture(texture), [texture]);

  const hasIntro = introDelay !== undefined && !reducedMotion;
  const settledRef = useRef(false);

  useFrame(({ clock }) => {
    if (!hasIntro || settledRef.current || !meshRef.current || !materialRef.current) return;
    const progress = revealEase(clock.elapsedTime, introDelay, 0.72);
    materialRef.current.opacity = opacity * progress;
    // Rise out of the sea rather than snapping in flat.
    meshRef.current.position.y = position[1] - (1 - progress) * 0.85;
    if (progress >= 1) settledRef.current = true;
  });

  return (
    <mesh ref={meshRef} position={position} renderOrder={renderOrder}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        color={color}
        transparent
        opacity={hasIntro ? 0 : opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

const REGION_FOG_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uHeight;
  uniform sampler2D uMask;
  uniform vec2 uRevealOrigin;
  uniform vec3 uFogDark;
  uniform vec3 uFogLight;
  uniform vec3 uRimColor;
  uniform float uProgress;
  uniform float uAspect;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;

  float maskAt(vec2 uv) {
    return smoothstep(0.12, 0.88, texture2D(uMask, uv).r);
  }

  float blurredHeight(vec2 uv) {
    vec2 spread = vec2(0.018, 0.018);
    float height = texture2D(uHeight, uv).r * 0.20;
    height += texture2D(uHeight, uv + vec2(spread.x, 0.0)).r * 0.10;
    height += texture2D(uHeight, uv - vec2(spread.x, 0.0)).r * 0.10;
    height += texture2D(uHeight, uv + vec2(0.0, spread.y)).r * 0.10;
    height += texture2D(uHeight, uv - vec2(0.0, spread.y)).r * 0.10;
    height += texture2D(uHeight, uv + spread).r * 0.10;
    height += texture2D(uHeight, uv - spread).r * 0.10;
    height += texture2D(uHeight, uv + vec2(spread.x, -spread.y)).r * 0.10;
    height += texture2D(uHeight, uv + vec2(-spread.x, spread.y)).r * 0.10;
    return height;
  }

  void main() {
    float regionMask = maskAt(vUv);
    if (regionMask < 0.002) discard;

    float height = blurredHeight(vUv);
    float relief = smoothstep(0.28, 0.88, height);
    float paperGrain = sin(vUv.x * 71.0 + vUv.y * 29.0) *
      sin(vUv.y * 83.0 - vUv.x * 17.0) * 0.008;
    vec3 lockedColor = mix(uFogDark, uFogLight, 0.46 + relief * 0.32);
    lockedColor += paperGrain;

    vec2 edgeStep = vec2(0.0045, 0.0045);
    float innerMask = min(
      min(maskAt(vUv + vec2(edgeStep.x, 0.0)), maskAt(vUv - vec2(edgeStep.x, 0.0))),
      min(maskAt(vUv + vec2(0.0, edgeStep.y)), maskAt(vUv - vec2(0.0, edgeStep.y)))
    );
    float coastOutline = clamp(regionMask - innerMask, 0.0, 1.0);
    lockedColor = mix(lockedColor, uFogLight * 1.05, coastOutline * 0.42);

    float progress = uProgress * uProgress * (3.0 - 2.0 * uProgress);
    vec2 revealDelta = (vUv - uRevealOrigin) * vec2(uAspect, 1.0);
    float revealNoise = (
      sin(vUv.x * 37.0 + vUv.y * 21.0 + uTime * 0.34 * uMotion) +
      sin(vUv.y * 43.0 - vUv.x * 19.0 - uTime * 0.25 * uMotion)
    ) * 0.010;
    float distanceFromOrigin = length(revealDelta) + revealNoise;
    float revealRadius = mix(-0.08, 0.96, progress);
    float revealed = 1.0 - smoothstep(revealRadius - 0.042, revealRadius + 0.042, distanceFromOrigin);
    float hidden = regionMask * (1.0 - revealed);

    float revealRim = 1.0 - smoothstep(0.0, 0.030, abs(distanceFromOrigin - revealRadius));
    revealRim *= regionMask * step(0.01, uProgress) * (1.0 - step(0.995, uProgress));
    vec3 finalColor = mix(lockedColor, uRimColor, revealRim * 0.82);
    float alpha = clamp(hidden * 0.992 + revealRim * 0.32, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function RegionFogPlane({
  heightUrl,
  maskUrl,
  size,
  state,
  reducedMotion,
}: {
  heightUrl: string;
  maskUrl: string;
  size: [number, number];
  state: WorldRegionFogState;
  reducedMotion: boolean;
}) {
  const [heightTexture, maskTexture] = useTexture([heightUrl, maskUrl]);
  const materialRef = useRef<ShaderMaterial>(null);
  const revealStartedAt = useRef<number | null>(null);
  useMemo(() => {
    prepareTexture(heightTexture, false, false);
    prepareTexture(maskTexture, false, false);
  }, [heightTexture, maskTexture]);
  const uniforms = useMemo(
    () => ({
      uHeight: { value: heightTexture },
      uMask: { value: maskTexture },
      uRevealOrigin: { value: new Vector2(0.5, 0.5) },
      uFogDark: { value: new Color("#879393") },
      uFogLight: { value: new Color("#c2c9c4") },
      uRimColor: { value: new Color("#f4ead0") },
      uProgress: { value: state === "unlocked" ? 1 : 0 },
      uAspect: { value: size[0] / size[1] },
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : 1 },
    }),
    [heightTexture, maskTexture, reducedMotion, size, state],
  );

  useEffect(() => {
    revealStartedAt.current = null;
  }, [state]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uMotion.value = reducedMotion ? 0 : 1;

    if (state === "locked") {
      material.uniforms.uProgress.value = 0;
      return;
    }
    if (state === "unlocked" || reducedMotion) {
      material.uniforms.uProgress.value = 1;
      return;
    }
    if (state === "revealing") {
      if (revealStartedAt.current === null) revealStartedAt.current = clock.elapsedTime;
      material.uniforms.uProgress.value = revealEase(
        clock.elapsedTime - revealStartedAt.current,
        0,
        1.35,
      );
    }
  });

  if (state === "hidden" || state === "unlocked") return null;

  return (
    <mesh position={[0, 0, 1.035]} renderOrder={7}>
      <planeGeometry args={size} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX_SHADER}
        fragmentShader={REGION_FOG_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function ExpansionIsland({
  island,
  state,
  reducedMotion,
}: {
  island: WorldExpansionIslandManifest;
  state: WorldRegionFogState;
  reducedMotion: boolean;
}) {
  if (state === "hidden") return null;

  if (island.assets.flatTerrain) {
    return (
      <group position={island.position}>
        <TexturePlane
          url={island.assets.flatTerrain}
          position={[0, 0, 0.8]}
          size={island.size}
          renderOrder={5}
          introDelay={0.14}
          reducedMotion={reducedMotion}
        />
      </group>
    );
  }

  return (
    <group position={island.position}>
      <TexturePlane
        url={island.assets.coast.shallow}
        position={[0, 0, 0.22]}
        size={island.size}
        opacity={0.88}
        renderOrder={2}
      />
      <TexturePlane
        url={island.assets.coast.wetContact}
        position={[0, -0.08, 0.34]}
        size={island.size}
        opacity={0.78}
        renderOrder={3}
      />
      <TexturePlane
        url={island.assets.contactShadow}
        position={[0, -0.25, 0.45]}
        size={island.size}
        opacity={0.58}
        renderOrder={4}
      />
      <TexturePlane
        url={island.assets.terrain}
        position={[0, 0, 0.8]}
        size={island.size}
        renderOrder={5}
      />
      <TexturePlane
        url={island.assets.coast.foam}
        position={[0, 0, 1.01]}
        size={island.size}
        opacity={0.68}
        renderOrder={6}
      />
      <RegionFogPlane
        heightUrl={island.assets.height}
        maskUrl={island.assets.mask}
        size={island.size}
        state={state}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

function RegionGlow({ region }: { region: WorldRegionManifest }) {
  const materialRef = useRef<MeshBasicMaterial>(null);
  const texture = useTexture(region.mask);
  const selectedId = useWorldMapStore((state) => state.selectedId);
  const hoveredId = useWorldMapStore((state) => state.hoveredId);
  useMemo(() => prepareTexture(texture), [texture]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    const active = selectedId === region.id || hoveredId === region.id;
    const target = selectedId === region.id ? 0.09 : active ? 0.06 : 0;
    easing.damp(materialRef.current, "opacity", target, 0.18, delta);
  });

  return (
    <mesh position={[0, 0, 1.1]} renderOrder={8}>
      <planeGeometry args={WORLD_MANIFEST.worldSize} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        color={region.tint}
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function RegionInteraction({
  region,
  item,
  onActivate,
}: {
  region: WorldInteractiveRegion;
  item: WorldMapCanvasItem;
  onActivate: (id: WorldRegionId) => void;
}) {
  const selectedId = useWorldMapStore((state) => state.selectedId);
  const hoveredId = useWorldMapStore((state) => state.hoveredId);
  const hover = useWorldMapStore((state) => state.hover);

  return (
    <group>
      <mesh
        position={region.anchor}
        onPointerEnter={(event) => {
          event.stopPropagation();
          hover(region.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          hover(null);
          document.body.style.cursor = "";
        }}
        onClick={(event) => {
          event.stopPropagation();
          onActivate(region.id);
        }}
      >
        <planeGeometry args={region.hitSize} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>

      <Html position={region.anchor} center zIndexRange={[6, 6]}>
        <button
          type="button"
          className={`worldMapLabel${selectedId === region.id ? " is-selected" : ""}${hoveredId === region.id ? " is-hovered" : ""}`}
          data-region-id={region.id}
          aria-pressed={selectedId === region.id}
          onPointerEnter={() => hover(region.id)}
          onPointerLeave={() => hover(null)}
          onClick={(event) => {
            event.stopPropagation();
            onActivate(region.id);
          }}
        >
          <span className="worldMapLabel__dot" aria-hidden="true" />
          <span className="worldMapLabel__text">
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
          </span>
          {item.echo && <span className="worldMapLabel__echo" aria-label="有回响">✦</span>}
        </button>
      </Html>
    </group>
  );
}

// A soft watercolour ring that blooms from the tapped point, using the ripple
// artwork (not a shader wave). The sprite is a light lavender stroke, drawn with
// normal blending so it reads over the bright sea without ever going dark.
function RippleBurst({ reducedMotion }: { reducedMotion: boolean }) {
  const ring = useTexture(WORLD_MANIFEST.assets.water.ripples[0]);
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const startedAt = useRef(-100);
  const seenSequence = useRef(0);
  useMemo(() => prepareTexture(ring), [ring]);

  // Read the store inside the frame loop rather than subscribing: a new tap bumps
  // the sequence, which restarts the bloom at the tapped point.
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;

    const ripple = useWorldMapStore.getState().ripple;
    if (ripple.sequence !== seenSequence.current) {
      seenSequence.current = ripple.sequence;
      startedAt.current = clock.elapsedTime;
      mesh.position.set(ripple.position[0], ripple.position[1], 1.06);
    }

    const duration = reducedMotion ? 0.01 : 1.15;
    const progress = (clock.elapsedTime - startedAt.current) / duration;
    const visible = seenSequence.current > 0 && progress >= 0 && progress <= 1;
    mesh.visible = visible;
    if (!visible) return;
    mesh.scale.setScalar(0.4 + progress * 1.05);
    material.opacity = Math.pow(1 - progress, 1.6) * 0.8;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 1.06]} renderOrder={7} visible={false}>
      <planeGeometry args={[13, 8.2]} />
      <meshBasicMaterial ref={materialRef} map={ring} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function WorldScene({ items, regionFogStates, onRegionActivate }: WorldMapCanvasProps) {
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const reducedMotion = useReducedMotionPreference();

  return (
    <>
      <color attach="background" args={["#e3f2ef"]} />
      <WaterLayer reducedMotion={reducedMotion} />
      {WORLD_MANIFEST.expansionIslands.map((island) => (
        <ExpansionIsland
          key={island.id}
          island={island}
          state={regionFogStates[island.regionId] ?? (island.state === "hidden" ? "hidden" : "locked")}
          reducedMotion={reducedMotion}
        />
      ))}
      <TexturePlane
        url={WORLD_MANIFEST.assets.coast.shallow}
        position={[0, 0, 0.22]}
        opacity={0.88}
        renderOrder={2}
        introDelay={0.1}
        reducedMotion={reducedMotion}
      />
      <TexturePlane
        url={WORLD_MANIFEST.assets.coast.wetContact}
        position={[0, -0.08, 0.34]}
        opacity={0.78}
        renderOrder={3}
        introDelay={0.1}
        reducedMotion={reducedMotion}
      />
      <TexturePlane
        url={WORLD_MANIFEST.assets.contactShadow}
        position={[0, -0.25, 0.45]}
        opacity={0.58}
        renderOrder={4}
        introDelay={0.1}
        reducedMotion={reducedMotion}
      />
      <TexturePlane
        url={WORLD_MANIFEST.assets.terrain}
        position={[0, 0, 0.8]}
        renderOrder={5}
        introDelay={0.1}
        reducedMotion={reducedMotion}
      />
      <TexturePlane
        url={WORLD_MANIFEST.assets.coast.foam}
        position={[0, 0, 1.01]}
        opacity={0.72}
        renderOrder={6}
        introDelay={0.16}
        reducedMotion={reducedMotion}
      />
      <RippleBurst reducedMotion={reducedMotion} />

      {WORLD_MANIFEST.regions.map((region) => (
        <RegionGlow key={`glow-${region.id}`} region={region} />
      ))}
      {WORLD_MANIFEST.regions.map((region) => {
        const item = itemById.get(region.id);
        return item ? (
          <RegionInteraction
            key={`interaction-${region.id}`}
            region={region}
            item={item}
            onActivate={onRegionActivate}
          />
        ) : null;
      })}
      {WORLD_MANIFEST.expansionIslands.map((island) => {
        const item = itemById.get(island.regionId);
        return item && regionFogStates[island.regionId] === "unlocked" ? (
          <RegionInteraction
            key={`interaction-${island.regionId}`}
            region={{ id: island.regionId, anchor: island.anchor, hitSize: island.hitSize }}
            item={item}
            onActivate={onRegionActivate}
          />
        ) : null;
      })}
      <CameraRig />
    </>
  );
}

export default function WorldMapCanvas(props: WorldMapCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 100], near: 0.1, far: 200, zoom: 10 }}
      dpr={[1, 1.65]}
      gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      fallback={<div className="worldMapCanvasFallback">当前设备无法启动地图渲染</div>}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute("aria-hidden", "true");
      }}
    >
      <Suspense fallback={null}>
        <WorldScene {...props} />
      </Suspense>
    </Canvas>
  );
}
