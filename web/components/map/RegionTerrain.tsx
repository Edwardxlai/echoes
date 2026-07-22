"use client";

import Image from "next/image";
import { useContext } from "react";
import type { MapItem } from "@/lib/map-config";
import { LandmarkGlyph, type GlyphKind } from "./LandmarkGlyph";
import { CloudBank, Mountain, River, Road, Tree, TreeCluster, WaterRipple } from "./TerrainDetails";
import { MapActiveContext, MapDiscoveryContext } from "./MapStage";

interface RegionLandmark {
  item: MapItem;
  glyphKind: GlyphKind;
}

const ECONOMY_TERRAIN =
  "/map-runtime/regions/economy/terrain/region_economy_terrain_default_lod1_v03.webp";

const ECONOMY_COAST = {
  shallow: "/map-runtime/regions/economy/coast/region_economy_coast-shallow_default_lod1_v01.webp",
  wetContact: "/map-runtime/regions/economy/coast/region_economy_coast-wet_default_lod1_v01.webp",
  foam: "/map-runtime/regions/economy/coast/region_economy_coast-foam_default_lod1_v01.webp",
  contactShadow:
    "/map-runtime/regions/economy/terrain/region_economy_contact-shadow_default_lod1_v01.webp",
} as const;

const ECONOMY_LANDMARKS = [
  {
    asset: "/map-runtime/regions/economy/landmarks/region_economy_landmark_misc-eco_lod1_v03.webp",
    width: 14.5,
    aspectRatio: 1067 / 740,
  },
  {
    asset: "/map-runtime/regions/economy/landmarks/region_economy_landmark_da2e1ad3_lod1_v03.webp",
    width: 15.5,
    aspectRatio: 981 / 896,
  },
  {
    asset: "/map-runtime/regions/economy/landmarks/region_economy_landmark_b9702449_lod1_v03.webp",
    width: 13.7,
    aspectRatio: 839 / 740,
  },
] as const;

const ECONOMY_LANDMARK_BY_ENTITY: Record<string, (typeof ECONOMY_LANDMARKS)[number]> = {
  "misc-eco": ECONOMY_LANDMARKS[0],
  da2e1ad3: ECONOMY_LANDMARKS[1],
  b9702449: ECONOMY_LANDMARKS[2],
  c1: ECONOMY_LANDMARKS[0],
  c2: ECONOMY_LANDMARKS[1],
};

const ECONOMY_FUTURE_SLOTS = [
  {
    x: 43,
    y: 69,
    width: 9.8,
    aspectRatio: 710 / 751,
    asset:
      "/map-runtime/regions/economy/landmarks/region_economy_landmark_future-industrial-guild_lod1_v01.webp",
  },
  {
    x: 37.4,
    y: 79,
    width: 14.2,
    aspectRatio: 1171 / 832,
    asset:
      "/map-runtime/regions/economy/landmarks/region_economy_landmark_future-logistics-customs_lod1_v01.webp",
  },
  {
    x: 72.2,
    y: 52.8,
    width: 10.8,
    aspectRatio: 821 / 790,
    asset:
      "/map-runtime/regions/economy/landmarks/region_economy_landmark_future-enterprise-forum_lod1_v01.webp",
  },
] as const;

const HISTORY_ENVIRONMENT =
  "/map-runtime/regions/history/terrain/region_history_terrain_default_lod1_v05.webp";

const HISTORY_COAST = {
  shallow: "/map-runtime/regions/history/coast/region_history_coast-shallow_default_lod1_v01.webp",
  wetContact: "/map-runtime/regions/history/coast/region_history_coast-wet_default_lod1_v01.webp",
  foam: "/map-runtime/regions/history/coast/region_history_coast-foam_default_lod1_v01.webp",
  contactShadow:
    "/map-runtime/regions/history/terrain/region_history_contact-shadow_default_lod1_v01.webp",
} as const;

const HISTORY_LANDMARKS = [
  "/map-runtime/regions/history/landmarks/region_history_landmark_archive-citadel_lod1_v02.webp",
  "/map-runtime/regions/history/landmarks/region_history_landmark_excavation-terrace_lod1_v02.webp",
  "/map-runtime/regions/history/landmarks/region_history_landmark_chronicle-observatory_lod1_v02.webp",
  "/map-runtime/regions/history/landmarks/region_history_landmark_ancient-road-gate_lod1_v02.webp",
] as const;

const TECHNOLOGY_TERRAIN =
  "/map-runtime/regions/technology/terrain/region_technology_terrain_default_lod1_v03.webp";

const DAILY_TERRAIN =
  "/map-runtime/regions/daily/terrain/region_daily_terrain_default_lod1_v01.webp";

const DAILY_LANDMARKS = [
  {
    x: 46,
    y: 43,
    width: 28,
    aspectRatio: 1536 / 1024,
    asset: "/map-runtime/regions/daily/landmarks/region_daily_landmark_beauty-skincare_lod1_v01.webp",
  },
  {
    x: 64,
    y: 46,
    width: 20,
    aspectRatio: 1536 / 1024,
    asset: "/map-runtime/regions/daily/landmarks/region_daily_landmark_life-knowledge_lod1_v01.webp",
  },
  {
    x: 51,
    y: 72,
    width: 25,
    aspectRatio: 1536 / 1024,
    asset: "/map-runtime/regions/daily/landmarks/region_daily_landmark_fashion-lifestyle_lod1_v01.webp",
  },
] as const;

const DAILY_LANDMARK_INDEX_BY_ENTITY: Record<string, number> = {
  "misc-life": 0,
  "4fcce52f": 1,
  "7499f1a2": 2,
};

const TECHNOLOGY_LANDMARKS = [
  "/map-runtime/regions/technology/landmarks/region_technology_landmark_misc-tech_lod1_v02.webp",
] as const;

const TECHNOLOGY_LANDMARK_BY_ENTITY: Record<
  string,
  (typeof TECHNOLOGY_LANDMARKS)[number]
> = {
  "misc-tech": TECHNOLOGY_LANDMARKS[0],
  c4: TECHNOLOGY_LANDMARKS[0],
};

const TECHNOLOGY_FUTURE_SLOTS = [
  {
    x: 59.3,
    y: 70.7,
    asset:
      "/map-runtime/regions/technology/landmarks/region_technology_landmark_future-computation-loom_lod1_v01.webp",
  },
  {
    x: 41.1,
    y: 20.6,
    asset:
      "/map-runtime/regions/technology/landmarks/region_technology_landmark_future-science-forum_lod1_v01.webp",
  },
  {
    x: 23.4,
    y: 38.6,
    asset:
      "/map-runtime/regions/technology/landmarks/region_technology_landmark_future-engineering-testworks_lod1_v01.webp",
  },
  {
    x: 85.6,
    y: 38.9,
    asset:
      "/map-runtime/regions/technology/landmarks/region_technology_landmark_future-signal-observatory_lod1_v01.webp",
  },
] as const;

// These masks follow river-bounded neighborhoods in the authored master.
// Locked areas reuse the real terrain underneath, as the world fog does.
const HISTORY_DISCOVERY_ZONES = [
  { x: 340, y: 300, path: "M222 270C249 230 307 218 359 235C406 229 452 257 454 302C445 342 396 364 347 354C297 370 241 346 222 306C215 294 216 281 222 270Z" },
  { x: 660, y: 350, path: "M566 328C593 292 642 282 684 299C726 288 779 310 791 351C799 389 758 426 710 427C672 451 612 432 588 397C562 384 550 352 566 328Z" },
  { x: 500, y: 188, path: "M408 153C431 112 477 94 520 108C560 97 606 124 615 162C630 198 596 229 553 233C515 253 460 238 439 207C408 201 392 174 408 153Z" },
  { x: 280, y: 425, path: "M173 409C196 372 246 354 287 369C329 358 373 385 382 423C399 462 361 501 315 502C278 525 222 510 201 477C171 468 156 434 173 409Z" },
  { x: 720, y: 213, path: "M641 181C664 145 703 129 741 140C780 130 824 154 835 190C850 225 819 257 779 264C744 282 694 269 672 239C646 234 629 205 641 181Z" },
  { x: 460, y: 450, path: "M368 429C390 394 432 379 471 391C508 383 554 406 565 441C579 477 546 510 504 515C468 534 417 520 395 491C368 484 354 452 368 429Z" },
  { x: 600, y: 275, path: "M520 253C542 220 582 206 619 217C655 209 697 231 708 264C721 297 690 328 651 333C616 351 569 338 548 310C523 304 508 276 520 253Z" },
  { x: 380, y: 163, path: "M301 139C322 106 361 92 398 103C434 95 475 117 486 150C499 183 469 213 430 218C396 236 349 223 328 195C303 189 289 162 301 139Z" },
] as const;

const TINT_CLASS: Record<string, string> = {
  eco: "terrain-eco",
  his: "terrain-his",
  tech: "terrain-tech",
};

const ACCENT_VAR: Record<string, string> = {
  eco: "var(--map-region-eco-line)",
  his: "var(--map-region-his-line)",
  tech: "var(--map-region-tech-line)",
  life: "var(--map-region-life-line)",
};

const LAND_PATHS: Record<string, string> = {
  eco: "M104 223C115 169 166 130 222 129C262 86 327 72 384 102C433 75 510 78 551 113C609 92 684 117 707 161C765 165 833 203 841 251C878 285 858 338 809 355C784 403 715 429 653 407C606 448 527 463 469 428C413 461 332 451 296 411C238 429 169 400 158 354C107 344 75 299 94 259C86 246 91 232 104 223Z",
  his: "M113 218C134 167 185 138 238 139C273 94 338 78 395 102C445 67 522 70 566 108C624 93 690 119 711 161C777 165 829 204 834 250C870 286 850 334 805 354C777 405 707 428 650 405C602 448 527 457 470 425C412 458 339 451 301 410C243 429 178 402 165 356C110 348 78 306 96 260C88 244 97 226 113 218Z",
  tech: "M117 224C131 171 179 137 235 135C278 92 343 78 397 105C448 75 514 78 559 113C615 91 690 113 715 160C770 163 827 199 837 244C877 278 862 326 817 349C793 399 724 425 661 405C618 447 538 458 478 428C420 460 344 451 305 410C248 431 181 404 167 356C116 348 81 306 99 265C88 248 98 231 117 224Z",
};

const SIDE_COLORS: Record<string, string> = {
  eco: "#a9b9a8",
  his: "#b8aebe",
  tech: "#a9b8c8",
};

function EcoLandscape() {
  return (
    <g>
      <River d="M264 123C285 177 260 207 306 247C350 286 330 342 373 385C402 414 425 426 448 440" width={10} />
      <River d="M306 247C379 242 424 269 474 305" width={5.5} opacity={0.72} />
      <Road d="M133 324C236 291 318 306 393 282C480 254 580 208 765 257" color="var(--map-region-eco-line)" width={2.4} />
      <Road d="M393 282C455 341 556 357 704 337" color="var(--map-region-eco-line)" width={1.8} opacity={0.58} />
      <Mountain x={211} y={151} scale={1.15} snow />
      <Mountain x={255} y={157} scale={0.86} snow />
      <Mountain x={176} y={169} scale={0.72} />
      <TreeCluster x={157} y={284} scale={1.02} />
      <TreeCluster x={724} y={246} scale={0.92} />
      <TreeCluster x={659} y={365} scale={0.72} />
      <TreeCluster x={523} y={142} scale={0.62} />
      <g fill="#dbe6c7" stroke="#f6f2dd" strokeWidth={2} opacity={0.72}>
        <path d="m489 333 66-20 48 20-66 22Z" />
        <path d="m533 361 62-20 48 19-64 23Z" />
        <path d="m618 277 57-18 42 18-57 20Z" />
      </g>
      <g stroke="var(--map-region-eco-line)" strokeWidth={1.2} opacity={0.42}>
        <path d="m503 329 48 19m-25-27 47 20m17 8 44 18m-19-26 43 17" />
      </g>
      <path d="m342 292 17-9 18 9-18 10Z" fill="#f5efe0" />
      <path d="m342 292 17 10 18-10v5l-18 10-17-10Z" fill="#a9a291" />
    </g>
  );
}

function HistoryLandscape() {
  return (
    <g>
      <Road d="M130 337C220 294 305 306 389 279C490 247 599 235 770 291" color="var(--map-region-his-line)" width={2.3} />
      <path d="M245 133C293 167 303 209 285 250C268 289 289 333 347 387" fill="none" stroke="#b19ead" strokeWidth={12} opacity={0.22} strokeLinecap="round" />
      <path d="M245 133C293 167 303 209 285 250C268 289 289 333 347 387" fill="none" stroke="#f1e8e6" strokeWidth={3} opacity={0.7} strokeLinecap="round" />
      <Mountain x={209} y={154} scale={1.14} face="#ece7e7" shade="#c4b8c4" snow />
      <Mountain x={253} y={163} scale={0.83} face="#ece7e7" shade="#c4b8c4" />
      <Mountain x={703} y={205} scale={0.92} face="#ebe6e4" shade="#c1b6be" />
      <Mountain x={735} y={214} scale={0.64} face="#ebe6e4" shade="#c1b6be" />
      <g fill="none" stroke="#9e8c9f" strokeWidth={2} opacity={0.38}>
        <path d="M535 329c42-29 97-31 141-4" />
        <path d="M518 346c57-39 130-42 179-7" />
        <path d="M503 365c73-51 162-52 216-6" />
      </g>
      <g transform="translate(153 266)" fill="#d5cfc8">
        <path d="m0 25 48-16 57 18-52 18Z" fill="#e8e1d8" />
        <path d="m0 25 53 20 52-18v8L53 53 0 33Z" fill="#b8ada6" />
        <path d="M18 14h9v23h-9zm24-9h10v39H42zm29 13h9v23h-9z" />
        <path d="m18 14 5-5 7 3-3 2m15-9 5-7 8 5-3 2m19 13 5-5 7 3-3 2" fill="none" stroke="var(--map-region-his-line)" strokeWidth={2} />
      </g>
      <TreeCluster x={758} y={334} scale={0.62} light="#b8b49e" dark="#8f8f79" />
      <Tree x={147} y={361} scale={0.8} light="#b8b49e" dark="#8f8f79" />
      <Tree x={170} y={371} scale={0.65} light="#b8b49e" dark="#8f8f79" />
    </g>
  );
}

function TechLandscape() {
  return (
    <g>
      <River d="M714 167C663 199 651 232 620 260C590 287 575 323 603 390" width={8} opacity={0.72} />
      <Road d="M133 333C235 285 314 307 397 273C496 232 605 210 766 259" color="var(--map-region-tech-line)" width={2.5} />
      <Road d="M397 273C455 322 539 352 705 335" color="var(--map-region-tech-line)" width={1.9} opacity={0.63} />
      <Mountain x={215} y={155} scale={1.05} face="#eef1ef" shade="#b8c5c7" snow />
      <Mountain x={256} y={164} scale={0.74} face="#eef1ef" shade="#b8c5c7" />
      <g fill="#e8eff4" stroke="var(--map-region-tech-line)" strokeWidth={1.5} opacity={0.78}>
        <path d="m167 269 34-17 37 17-35 19Z" />
        <path d="m661 287 30-15 33 15-31 17Z" />
        <path d="m501 154 27-13 29 13-28 15Z" />
        <circle cx={203} cy={269} r={5} />
        <circle cx={693} cy={287} r={5} />
        <circle cx={529} cy={154} r={5} />
      </g>
      <path d="M203 269 397 273 529 154M397 273l296 14" fill="none" stroke="var(--map-region-tech-line)" strokeWidth={1.8} strokeDasharray="5 5" opacity={0.62} />
      <g transform="translate(733 325)">
        <ellipse cx={0} cy={20} rx={29} ry={7} fill="var(--map-land-shadow)" />
        <path d="m-24 7 24-12L25 7 0 20Z" fill="#edf1f2" />
        <path d="M-24 7 0 20 25 7v7L0 27l-24-13Z" fill="#a8b5bc" />
        <path d="M0-5v-25m0 0-17 18m17-18 18 18" fill="none" stroke="#7f979c" strokeWidth={2.3} />
        <circle cy={-30} r={4} fill="#f7fbfa" stroke="var(--map-region-tech-line)" strokeWidth={1.5} />
      </g>
      <TreeCluster x={157} y={357} scale={0.65} light="#9fb8a8" dark="#78978a" />
    </g>
  );
}

function CategoryLandscape({ categoryId }: { categoryId: string }) {
  if (categoryId === "his") return <HistoryLandscape />;
  if (categoryId === "tech") return <TechLandscape />;
  return <EcoLandscape />;
}

function EconomyRegionTerrain({ landmarks }: { landmarks: RegionLandmark[] }) {
  const activeId = useContext(MapActiveContext);
  const discovery = useContext(MapDiscoveryContext);

  // 表外合集（自动聚类等）顶未来建筑：real-data 侧按同序分配了未来槽坐标，
  // 这里同序取该槽的建筑图；被顶掉的未来建筑不再走装饰渲染
  let overflowCount = 0;
  const visuals = landmarks.map(
    ({ item }, index) =>
      ECONOMY_LANDMARK_BY_ENTITY[item.entityId] ??
      ECONOMY_FUTURE_SLOTS[overflowCount++] ??
      ECONOMY_LANDMARKS[index % ECONOMY_LANDMARKS.length]
  );

  return (
    <div className="regionImageTerrain regionImageTerrain--eco">
      <Image
        className="regionCoast regionCoast--shallow"
        src={ECONOMY_COAST.shallow}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--wet"
        src={ECONOMY_COAST.wetContact}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--shadow"
        src={ECONOMY_COAST.contactShadow}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionImageTerrain__base regionImageTerrain__base--transparent"
        src={ECONOMY_TERRAIN}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        preload
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--foam"
        src={ECONOMY_COAST.foam}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />

      {landmarks.map(({ item }, index) => {
        const isRevealing = discovery.revealingIds.has(item.id);
        const isDiscovered = !discovery.enabled || discovery.discoveredIds.has(item.id);
        const isHidden = discovery.enabled && (!discovery.ready || (!isDiscovered && !isRevealing));
        const visual = visuals[index];

        return (
          <div
            key={item.id}
            className={[
              "regionImageLandmark",
              activeId === item.id ? "is-active" : "",
              isRevealing ? "is-revealing" : "",
              isHidden ? "is-hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-asset-index={index % ECONOMY_LANDMARKS.length}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${visual.width}%`,
              aspectRatio: visual.aspectRatio,
            }}
          >
            <Image
              src={visual.asset}
              alt=""
              fill
              sizes="(max-width: 560px) 140px, 300px"
              draggable={false}
            />
          </div>
        );
      })}

      {ECONOMY_FUTURE_SLOTS.slice(overflowCount).map((slot) => (
        <div
          key={slot.asset}
          className="economyFutureLandmark"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.width}%`,
            aspectRatio: slot.aspectRatio,
          }}
          aria-hidden="true"
        >
          <Image
            src={slot.asset}
            alt=""
            fill
            sizes="(max-width: 560px) 120px, 240px"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

function TechnologyRegionTerrain({ landmarks }: { landmarks: RegionLandmark[] }) {
  const activeId = useContext(MapActiveContext);
  const discovery = useContext(MapDiscoveryContext);
  const occupiedFutureSlots = Math.max(
    0,
    Math.min(landmarks.length - 1, TECHNOLOGY_FUTURE_SLOTS.length)
  );

  return (
    <div className="regionImageTerrain regionImageTerrain--tech">
      <Image
        className="regionImageTerrain__base regionImageTerrain__base--transparent"
        src={TECHNOLOGY_TERRAIN}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        preload
        draggable={false}
      />

      {landmarks.map(({ item }, index) => {
        const isRevealing = discovery.revealingIds.has(item.id);
        const isDiscovered = !discovery.enabled || discovery.discoveredIds.has(item.id);
        const isHidden = discovery.enabled && (!discovery.ready || (!isDiscovered && !isRevealing));
        // 表外合集落在 TECHNOLOGY_REGION_SLOTS[index]（=未来槽 index-1 的坐标），美术取同槽建筑
        const asset =
          TECHNOLOGY_LANDMARK_BY_ENTITY[item.entityId] ??
          TECHNOLOGY_FUTURE_SLOTS[index - 1]?.asset ??
          TECHNOLOGY_LANDMARKS[index % TECHNOLOGY_LANDMARKS.length];

        return (
          <div
            key={item.id}
            className={[
              "regionImageLandmark",
              activeId === item.id ? "is-active" : "",
              isRevealing ? "is-revealing" : "",
              isHidden ? "is-hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-asset-index={index % TECHNOLOGY_LANDMARKS.length}
            data-tech-slot={index}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <Image
              src={asset}
              alt=""
              fill
              sizes="(max-width: 560px) 140px, 300px"
              draggable={false}
            />
          </div>
        );
      })}

      {TECHNOLOGY_FUTURE_SLOTS.slice(occupiedFutureSlots).map((slot, index) => (
        <div
          key={slot.asset}
          className="technologyFutureLandmark"
          data-future-slot={index + occupiedFutureSlots + 2}
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          aria-hidden="true"
        >
          <Image
            src={slot.asset}
            alt=""
            fill
            sizes="(max-width: 560px) 120px, 250px"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

function DailyRegionTerrain({ landmarks }: { landmarks: RegionLandmark[] }) {
  const activeId = useContext(MapActiveContext);
  const discovery = useContext(MapDiscoveryContext);
  const occupiedVisualIndexes = new Set(
    landmarks.map(({ item }, index) => DAILY_LANDMARK_INDEX_BY_ENTITY[item.entityId] ?? index)
  );

  return (
    <div className="regionImageTerrain regionImageTerrain--life">
      <Image
        className="regionImageTerrain__base regionImageTerrain__base--transparent"
        src={DAILY_TERRAIN}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        preload
        draggable={false}
      />

      {landmarks.map(({ item }, index) => {
        const visualIndex = DAILY_LANDMARK_INDEX_BY_ENTITY[item.entityId] ?? index;
        const visual = DAILY_LANDMARKS[visualIndex % DAILY_LANDMARKS.length];
        const landmark = landmarks[index];
        const isRevealing = landmark ? discovery.revealingIds.has(landmark.item.id) : false;
        const isDiscovered = landmark
          ? !discovery.enabled || discovery.discoveredIds.has(landmark.item.id)
          : true;
        const isHidden = Boolean(
          landmark && discovery.enabled && (!discovery.ready || (!isDiscovered && !isRevealing))
        );

        return (
          <div
            key={visual.asset}
            className={[
              "dailyRegionLandmark",
              landmark && activeId === landmark.item.id ? "is-active" : "",
              isRevealing ? "is-revealing" : "",
              isHidden ? "is-hidden" : "",
              landmark ? "is-occupied" : "is-future",
            ].filter(Boolean).join(" ")}
            style={{
              left: `${landmark.item.x}%`,
              top: `${landmark.item.y}%`,
              width: `${visual.width}%`,
              aspectRatio: visual.aspectRatio,
            }}
            aria-hidden="true"
          >
            <Image src={visual.asset} alt="" fill sizes="(max-width: 560px) 150px, 320px" draggable={false} />
          </div>
        );
      })}

      {DAILY_LANDMARKS.map((visual, index) =>
        occupiedVisualIndexes.has(index) ? null : (
          <div
            key={`future-${visual.asset}`}
            className="dailyRegionLandmark is-future"
            style={{
              left: `${visual.x}%`,
              top: `${visual.y}%`,
              width: `${visual.width}%`,
              aspectRatio: visual.aspectRatio,
            }}
            aria-hidden="true"
          >
            <Image src={visual.asset} alt="" fill sizes="(max-width: 560px) 150px, 320px" draggable={false} />
          </div>
        )
      )}
    </div>
  );
}

function HistoryRegionTerrain({ landmarks }: { landmarks: RegionLandmark[] }) {
  const activeId = useContext(MapActiveContext);
  const discovery = useContext(MapDiscoveryContext);

  return (
    <div className="regionImageTerrain regionImageTerrain--his historyRegionTerrain">
      <Image
        className="regionCoast regionCoast--shallow"
        src={HISTORY_COAST.shallow}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--wet"
        src={HISTORY_COAST.wetContact}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--shadow"
        src={HISTORY_COAST.contactShadow}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />
      <Image
        className="regionImageTerrain__base regionImageTerrain__base--transparent historyRegionTerrain__base"
        src={HISTORY_ENVIRONMENT}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        preload
        draggable={false}
      />
      <Image
        className="regionCoast regionCoast--foam"
        src={HISTORY_COAST.foam}
        alt=""
        fill
        sizes="(max-width: 560px) 145vw, 100vw"
        draggable={false}
      />

      {landmarks.map(({ item }, index) => {
        const isRevealing = discovery.revealingIds.has(item.id);
        const isDiscovered = !discovery.enabled || discovery.discoveredIds.has(item.id);
        const isHidden = discovery.enabled && (!discovery.ready || (!isDiscovered && !isRevealing));

        return (
          <div
            key={item.id}
            className={[
              "historyLandmark",
              activeId === item.id ? "is-active" : "",
              isRevealing ? "is-revealing" : "",
              isHidden ? "is-hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-asset-index={index % HISTORY_LANDMARKS.length}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            <Image
              src={HISTORY_LANDMARKS[index % HISTORY_LANDMARKS.length]}
              alt=""
              fill
              sizes="(max-width: 560px) 130px, 260px"
              draggable={false}
            />
          </div>
        );
      })}

      {HISTORY_DISCOVERY_ZONES.map((slot, index) => {
        const landmark = landmarks[index];
        const isRevealing = landmark ? discovery.revealingIds.has(landmark.item.id) : false;
        const isOpen = landmark
          ? !discovery.enabled || discovery.discoveredIds.has(landmark.item.id)
          : false;

        return (
          <div
            key={`history-slot-${index}`}
            className={[
              "historyFog",
              `historyFog--${index % 4}`,
              isOpen ? "is-open" : "",
              isRevealing ? "is-revealing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span className="historyFog__silhouette" />
            <span className="historyFog__mist" />
          </div>
        );
      })}
    </div>
  );
}

export function RegionTerrain({
  categoryId,
  landmarks,
}: {
  categoryId: string;
  landmarks: RegionLandmark[];
}) {
  const activeId = useContext(MapActiveContext);

  if (categoryId === "eco") {
    return <EconomyRegionTerrain landmarks={landmarks} />;
  }

  if (categoryId === "his") {
    return <HistoryRegionTerrain landmarks={landmarks} />;
  }

  if (categoryId === "tech") {
    return <TechnologyRegionTerrain landmarks={landmarks} />;
  }

  if (categoryId === "life") {
    return <DailyRegionTerrain landmarks={landmarks} />;
  }

  const accent = ACCENT_VAR[categoryId] ?? "var(--map-ink-soft)";
  const landPath = LAND_PATHS[categoryId] ?? LAND_PATHS.eco;
  const tintClass = TINT_CLASS[categoryId] ?? "terrain-land";

  return (
    <svg
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      pointerEvents="none"
    >
      <defs>
        <linearGradient id="region-water" x1="70" y1="35" x2="925" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e7f3f1" />
          <stop offset="0.55" stopColor="var(--map-ocean)" />
          <stop offset="1" stopColor="var(--map-ocean-deep)" />
        </linearGradient>
        <filter id="region-ground-shadow" x="-20%" y="-25%" width="150%" height="175%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="7" dy="13" stdDeviation="12" floodColor="#687872" floodOpacity="0.17" />
        </filter>
        <clipPath id="region-land-clip">
          <path d={landPath} />
        </clipPath>
      </defs>

      <rect x={0} y={0} width={1000} height={560} rx={20} fill="url(#region-water)" />
      <path d="M0 420C180 372 350 407 509 384C686 358 807 301 1000 326V560H0Z" fill="#9cc8cc" opacity={0.13} />
      <WaterRipple x={84} y={287} scale={1.15} opacity={0.48} />
      <WaterRipple x={900} y={275} scale={1.22} opacity={0.44} />
      <WaterRipple x={813} y={478} scale={0.8} opacity={0.38} />

      <g filter="url(#region-ground-shadow)">
        <path d={landPath} transform="translate(0 19)" fill="#e3d8c3" opacity={0.7} />
        <path d={landPath} transform="translate(0 11)" fill={SIDE_COLORS[categoryId] ?? "#b8b1a2"} opacity={0.86} />
        <path d={landPath} className={tintClass} />
      </g>

      <g clipPath="url(#region-land-clip)">
        <path d="M111 217C226 188 319 211 416 174C537 128 662 134 824 229" fill="none" stroke="#fffdf5" strokeWidth={18} opacity={0.13} />
        <CategoryLandscape categoryId={categoryId} />
        {landmarks.length === 1 ? (
          <Road
            d={`M139 373C258 332 350 333 ${landmarks[0].item.x * 10} ${landmarks[0].item.y * 5.6}`}
            color={accent}
            width={1.7}
            opacity={0.45}
          />
        ) : null}
      </g>

      <path d={landPath} fill="none" stroke="#fffdf7" strokeWidth={2.2} opacity={0.6} />
      <path d="M158 354C171 401 243 429 301 410M650 405C711 429 782 404 809 355" fill="none" stroke="#979181" strokeWidth={1.2} opacity={0.28} />

      {landmarks.map(({ item, glyphKind }) => (
        <g key={item.id} transform={`translate(${item.x * 10 - 50} ${item.y * 5.6 - 98})`}>
          <g className={`landmark${activeId === item.id ? " is-active" : ""}`}>
            <ellipse cx={50} cy={94} rx={48} ry={14} fill="#fff" opacity={0.12} />
            <LandmarkGlyph kind={glyphKind} accent={accent} />
          </g>
        </g>
      ))}

      <CloudBank x={82} y={91} scale={0.96} opacity={0.5} />
      <CloudBank x={909} y={111} scale={0.78} opacity={0.44} />
      <CloudBank x={905} y={480} scale={1.08} opacity={0.4} />
    </svg>
  );
}
