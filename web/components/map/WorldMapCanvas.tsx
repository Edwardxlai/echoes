"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { easing } from "maath";
import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  OrthographicCamera,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
} from "three";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import type { WorldRegionId, WorldRegionManifest } from "@/lib/map-scene/schema";
import { useWorldMapStore } from "./world-map-store";

export interface WorldMapCanvasItem {
  id: WorldRegionId;
  title: string;
  meta: string;
  echo: boolean;
}

interface WorldMapCanvasProps {
  items: WorldMapCanvasItem[];
  onRegionActivate: (id: WorldRegionId) => void;
}

const [WORLD_WIDTH, WORLD_HEIGHT] = WORLD_MANIFEST.worldSize;

function prepareTexture(texture: Texture, repeat = false, srgb = true) {
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  texture.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

const WATER_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uBaseColor;
  uniform sampler2D uNormal;
  uniform sampler2D uRoughness;
  uniform sampler2D uFlow;
  uniform float uTime;
  uniform float uMotion;
  uniform float uNormalStrength;
  varying vec2 vUv;

  void main() {
    float time = uTime * uMotion;

    // Keep the watercolour crisp and pretty — only a very slow drift so it never
    // looks frozen, and NO refraction warping (that muddied the artwork).
    vec3 water = texture2D(uBaseColor, vUv * 16.0 + vec2(time * 0.0022, time * 0.0013)).rgb;

    // Movement comes from light, not from distorting the texture: an animated
    // surface normal drives a travelling sparkle.
    vec2 nUvA = vUv * 22.0 + vec2(time * 0.012, time * 0.007);
    vec2 nUvB = vec2(1.0 - vUv.x, vUv.y) * 28.0 + vec2(-time * 0.009, time * 0.013);
    vec3 normal = normalize(mix(
      texture2D(uNormal, nUvA).rgb * 2.0 - 1.0,
      texture2D(uNormal, nUvB).rgb * 2.0 - 1.0,
      0.5
    ));
    vec3 lightDir = normalize(vec3(-0.26, 0.4, 1.0));
    float roughness = texture2D(uRoughness, nUvB * 0.8).r;
    float glint = pow(max(dot(normal, lightDir), 0.0), 9.0) * (1.0 - roughness);

    // Soft caustic light bands slowly drifting across the sea — the main, calm
    // sense of a living surface.
    float c1 = texture2D(uFlow, vUv * 4.0 + vec2(time * 0.006, time * 0.0022)).r;
    float c2 = texture2D(uFlow, vUv * 6.5 + vec2(-time * 0.004, time * 0.005)).r;
    float caustic = pow(max(c1 * c2, 0.0), 1.4);

    vec3 paperSea = vec3(0.890, 0.949, 0.937);
    vec3 color = mix(paperSea, water, 0.55);
    color += glint * 0.10 * (0.6 + uNormalStrength);
    color += caustic * 0.09;
    color += (c1 - 0.5) * 0.045;
    gl_FragColor = vec4(color, 1.0);
  }
`;

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
  opacity = 1,
  renderOrder = 1,
  introDelay,
  reducedMotion = false,
}: {
  url: string;
  position: [number, number, number];
  size?: [number, number];
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
        transparent
        opacity={hasIntro ? 0 : opacity}
        depthWrite={false}
      />
    </mesh>
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
  region: WorldRegionManifest;
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

function WorldScene({ items, onRegionActivate }: WorldMapCanvasProps) {
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const reducedMotion = useReducedMotionPreference();

  return (
    <>
      <color attach="background" args={["#e3f2ef"]} />
      <WaterLayer reducedMotion={reducedMotion} />
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
