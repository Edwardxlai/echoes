"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  ShaderMaterial,
  Texture,
  Vector2,
} from "three";
import { WORLD_MANIFEST } from "@/lib/map-scene/manifests/world";
import { WATER_FRAGMENT_SHADER, WATER_VERTEX_SHADER } from "./water-shader";

// The world water plane is 560 units with the base tile repeating every 35,
// which lands around 470 screen px at the world's default fit zoom. uUvScale
// converts this canvas's pixel size into the same on-screen tile density.
const TILE_SCREEN_PX = 470;

function prepareTexture(texture: Texture, srgb: boolean) {
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
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

function RegionWaterSurface({ reducedMotion }: { reducedMotion: boolean }) {
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
        prepareTexture(texture, index === 0);
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
      uNormalStrength: { value: 0.22 },
      uUvScale: { value: new Vector2(1, 1) },
    }),
    [reducedMotion, textures],
  );

  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    // The canvas is oversized to ~210% of the stage, so a 560px-wide viewport
    // still maps to a ~1180px canvas — mirror the world's mobile threshold.
    material.uniforms.uNormalStrength.value = size.width <= 1200 ? 0.14 : 0.22;
    material.uniforms.uUvScale.value.set(
      size.width / (16 * TILE_SCREEN_PX),
      size.height / (16 * TILE_SCREEN_PX),
    );
  });

  return (
    <mesh scale={[size.width, size.height, 1]}>
      <planeGeometry args={[1, 1]} />
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

export default function RegionWaterCanvas() {
  const reducedMotion = useReducedMotionPreference();

  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], near: 0.1, far: 50, zoom: 1 }}
      dpr={[1, 1.65]}
      gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      fallback={null}
      onCreated={({ gl }) => {
        gl.domElement.setAttribute("aria-hidden", "true");
      }}
    >
      <color attach="background" args={["#e3f2ef"]} />
      <Suspense fallback={null}>
        <RegionWaterSurface reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
