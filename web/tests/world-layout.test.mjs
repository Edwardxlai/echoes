import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const page = read("../app/page.tsx");
const mapCss = read("../app/styles/map.css");
const worldStage = read("../components/map/WorldMapStage.tsx");
const worldCanvas = read("../components/map/WorldMapCanvas.tsx");
const manifest = read("../lib/map-scene/manifests/world.ts");

test("world page keeps the product entry and mounts the R3F world scene", () => {
  assert.match(page, /className="worldMasthead mapShell"/);
  assert.match(page, /<BrandHomeLink className="worldMasthead__brand" \/>/);
  assert.match(page, /<HeroInput compact \/>/);
  assert.match(page, /<WorldMapStage items=\{items\} \/>/);
  assert.doesNotMatch(page, /import \{ MapStage|WorldTerrain|world-raster-v4/);
});

test("world map uses an orthographic camera and independent scene layers", () => {
  assert.match(worldCanvas, /<Canvas[\s\S]*?orthographic/);
  assert.match(worldCanvas, /<WaterLayer reducedMotion=/);
  assert.match(worldCanvas, /WATER_FRAGMENT_SHADER/);
  assert.match(worldCanvas, /assets\.water\.normal/);
  assert.match(worldCanvas, /assets\.water\.roughness/);
  assert.match(worldCanvas, /assets\.water\.flow/);
  assert.match(worldCanvas, /assets\.coast\.shallow/);
  assert.match(worldCanvas, /assets\.coast\.wetContact/);
  assert.match(worldCanvas, /assets\.coast\.foam/);
  assert.match(worldCanvas, /assets\.contactShadow/);
  assert.match(worldCanvas, /assets\.terrain/);
  assert.match(worldCanvas, /<RegionGlow/);
  assert.doesNotMatch(worldCanvas, /<LandmarkLayer/);
  assert.match(worldCanvas, /<CloudField reducedMotion=/);
  assert.match(worldCanvas, /<RippleBurst reducedMotion=/);
  assert.match(worldCanvas, /prefers-reduced-motion/);
  assert.match(worldCanvas, /<CameraRig \/>/);
});

test("zoom is relative to home fit and focus is device-aware", () => {
  assert.match(manifest, /fitPadding: \{ desktop: 0\.9, mobile: 0\.84 \}/);
  assert.match(manifest, /home: \{ target: \[0, 7\.5\], zoomRatio: 0\.93 \}/);
  assert.match(manifest, /zoomRange: \[0\.6, 2\.2\]/);
  assert.match(worldStage, /cameraScale\(rect, zoomRatio\)/);
  assert.match(worldStage, /region\.focus\.zoomRatio/);
  assert.match(worldStage, /x: region\.focus\.target\[0\]/);
  assert.match(worldStage, /y: region\.focus\.target\[1\]/);
  assert.doesNotMatch(worldStage, /cameraBeforeFocusRef/);
  assert.match(manifest, /focus: \{ target: \[2\.2, -3\.5\], zoomRatio: 1\.18 \}/);
  assert.match(worldStage, /Math\.round\(camera\.zoomRatio \* 100\)/);
});

test("labels stay in projected DOM and the scene has no card frame", () => {
  assert.match(worldCanvas, /<Html position=\{region\.anchor\} center/);
  assert.match(mapCss, /\.worldMapStage\{[\s\S]*?background:transparent/);
  assert.match(mapCss, /\.mapPage--world\{[\s\S]*?background:#e3f2ef/);
  assert.doesNotMatch(mapCss, /\.worldMapStage__canvas\{[\s\S]*?mask-image/);
  assert.doesNotMatch(mapCss.match(/\.worldMapStage\{([\s\S]*?)\}/)?.[1] ?? "", /border:/);
  assert.match(mapCss, /\.worldMapLabel\{/);
});

test("every world runtime asset referenced by the manifest exists", () => {
  const assets = [...manifest.matchAll(/`\$\{RUNTIME\}\/([^`]+)`/g)].map((match) => match[1]);
  assert.ok(assets.length >= 12, "expected the manifest to reference the layered runtime package");
  for (const asset of assets) {
    assert.ok(
      existsSync(new URL(`../public/map-runtime/world/${asset}`, import.meta.url)),
      `missing runtime asset: ${asset}`,
    );
  }
});
