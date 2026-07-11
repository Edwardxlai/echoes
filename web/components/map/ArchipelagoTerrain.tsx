"use client";

import { useContext } from "react";
import type { MapItem } from "@/lib/map-config";
import { CloudBank, EchoBeacon, Mountain, Tree, TreeCluster, WaterRipple } from "./TerrainDetails";
import { MapActiveContext } from "./MapStage";

const ISLAND_TOPS = [
  "M-56-43C-57-62-38-75-18-73C-4-88 23-85 35-69C52-66 63-50 57-35C66-21 50-9 34-11C20 1-2-2-12-14C-31-8-50-20-48-34C-57-34-62-38-56-43Z",
  "M-53-48C-48-69-27-80-8-74C6-88 31-78 37-63C55-58 61-40 52-27C57-14 41-5 27-12C14-2-6-6-13-19C-31-12-51-24-48-39C-56-40-59-44-53-48Z",
  "M-58-39C-61-57-42-72-24-69C-10-84 17-82 30-66C47-67 61-54 57-39C67-27 55-12 39-13C28-1 5-3-5-14C-22-6-44-15-45-30C-55-29-62-33-58-39Z",
];

const ISLAND_INNERS = [
  "M-44-43C-43-59-28-67-13-65C0-76 20-73 29-60C42-57 49-46 45-35C50-24 37-17 25-20C13-11-4-14-10-24C-25-17-39-26-37-37Z",
  "M-40-47C-36-61-20-68-7-63C5-73 22-65 27-54C39-50 44-39 37-30C40-21 29-16 20-21C10-14-3-17-8-26C-21-21-36-29-33-39Z",
  "M-44-38C-45-52-31-62-17-58C-7-70 13-68 23-55C36-56 46-47 42-36C50-28 39-19 28-21C19-12 3-15-4-23C-17-16-33-23-33-33Z",
];

const TOP_COLORS = ["#c9ddc7", "#cbd9eb", "#ddd0e6"];
const SIDE_COLORS = ["#9caf9e", "#a8b6c5", "#b6a8ba"];
const ISLAND_SCALES = [1.25, 1.14, 1.2];

function SettlementLandmark() {
  return (
    <g transform="translate(-7 -54)">
      <ellipse cx={5} cy={30} rx={31} ry={6} fill="var(--map-land-shadow)" />
      <g transform="translate(-22 3)">
        <path d="m0 8 9-5 13 5-10 6Z" fill="#fff9ee" />
        <path d="M0 8v13l12 5V14Z" fill="#d8d2c4" />
        <path d="m12 14 10-6v13l-10 5Z" fill="#9da29a" />
        <path d="M-1 8 9-2 23 8 9 3Z" fill="#b77962" opacity={0.72} />
      </g>
      <g transform="translate(5 -2)">
        <path d="m0 8 10-5 14 5-11 6Z" fill="#fffaf0" />
        <path d="M0 8v16l13 5V14Z" fill="#d8d4ca" />
        <path d="m13 14 11-6v16l-11 5Z" fill="#9aa09a" />
        <path d="M-1 8 10-3 25 8 10 3Z" fill="#aa7566" opacity={0.76} />
      </g>
      <path d="M-27 30C-12 21 4 26 27 18" fill="none" stroke="#b2a58d" strokeWidth={1.6} strokeDasharray="3 3" />
      <Tree x={31} y={14} scale={0.58} />
    </g>
  );
}

function LighthouseLandmark() {
  return (
    <g transform="translate(0 -55)">
      <ellipse cx={3} cy={32} rx={27} ry={6} fill="var(--map-land-shadow)" />
      <path d="m-11-1 11-6 12 6L1 6Z" fill="#f9f7ef" />
      <path d="M-11-1-7 28l8 4V6Z" fill="#d6d7d2" />
      <path d="M1 6 12-1 8 28l-7 4Z" fill="#929e9d" />
      <path d="m-15-4 15-8L16-4 1 5Z" fill="#b3846e" opacity={0.78} />
      <path d="M-16-4 1 5 16-4v5L1 10-16 1Z" fill="#898e89" opacity={0.65} />
      <path d="m-8-13 8-5 9 5-9 5Z" fill="#fff8df" />
      <path d="M-8-13v8l8 4v-7Z" fill="#e5d8aa" />
      <path d="m0-8 9-5v8L0-1Z" fill="#b89a62" />
      <path d="M-22 0A24 14 0 0 0 22 0" fill="none" stroke="#9fb6d9" strokeWidth={1.2} opacity={0.54} />
      <path d="M-28 0A30 19 0 0 0 28 0" fill="none" stroke="#9fb6d9" strokeWidth={1} opacity={0.3} />
    </g>
  );
}

function ArchiveLandmark() {
  return (
    <g transform="translate(0 -48)">
      <ellipse cx={3} cy={27} rx={31} ry={6} fill="var(--map-land-shadow)" />
      <path d="m-29 13 28-10 31 11L1 25Z" fill="#ece6dd" />
      <path d="m-29 13 30 12 29-11v7L1 32-29 21Z" fill="#b8ada5" />
      <path d="m-19-7 5-3 8 3-5 4Z" fill="#fffaf0" />
      <path d="M-19-7v25l8 3V-3Z" fill="#d8d4cb" />
      <path d="m-11-3 5-4v25l-5 3Z" fill="#9d9e98" />
      <path d="m7-13 5-3 8 3-5 4Z" fill="#fffaf0" />
      <path d="M7-13v31l8 3V-9Z" fill="#d8d4cb" />
      <path d="m15-9 5-4v31l-5 3Z" fill="#9d9e98" />
      <path d="M-11 0h25c9 0 14 5 14 14" fill="none" stroke="#b39cc9" strokeWidth={2.5} strokeLinecap="round" opacity={0.74} />
      <Tree x={-31} y={12} scale={0.52} light="#b7b39c" dark="#8f9079" />
    </g>
  );
}

function IslandLandmark({ variant }: { variant: number }) {
  if (variant === 1) return <LighthouseLandmark />;
  if (variant === 2) return <ArchiveLandmark />;
  return <SettlementLandmark />;
}

function IslandVisual({
  variant,
  echo,
  unviewed,
  isNew,
}: {
  variant: number;
  echo: boolean;
  unviewed: boolean;
  isNew: boolean;
}) {
  const top = ISLAND_TOPS[variant];
  return (
    <g>
      <ellipse className="terrain-shadow" cx={5} cy={1} rx={56} ry={9} />
      <path d={top} transform="translate(0 11)" fill="#d7ccb7" opacity={0.78} />
      <path d={top} transform="translate(0 7)" fill={SIDE_COLORS[variant]} opacity={0.92} />
      <path d={top} fill="var(--map-sand)" />
      <path d={ISLAND_INNERS[variant]} fill={TOP_COLORS[variant]} opacity={0.9} />
      <path d={top} fill="none" stroke="#fffdf5" strokeWidth={1.7} opacity={0.68} />
      <path d="M-42-21C-17-11 11-13 40-24" fill="none" stroke="#9b937e" strokeWidth={1.1} opacity={0.26} />

      {variant === 0 ? (
        <>
          <TreeCluster x={-34} y={-32} scale={0.42} />
          <Mountain x={34} y={-42} scale={0.38} face="#ecebe2" shade="#b9c2bb" />
        </>
      ) : null}
      {variant === 1 ? (
        <>
          <Mountain x={-33} y={-42} scale={0.46} face="#edf0ed" shade="#b8c4c6" />
          <Tree x={35} y={-26} scale={0.55} light="#9bb3a5" dark="#789187" />
        </>
      ) : null}
      {variant === 2 ? (
        <>
          <TreeCluster x={37} y={-33} scale={0.4} light="#b4b39d" dark="#8b8e79" />
          <path d="M-40-35c12-9 22-10 32-3" fill="none" stroke="#b39cc9" strokeWidth={1.4} opacity={0.5} />
        </>
      ) : null}

      <IslandLandmark variant={variant} />
      {echo ? <EchoBeacon x={37} y={-62} scale={0.82} glowId="archipelago-echo-glow" /> : null}
      {isNew ? (
        <g transform="translate(-38 -57)" stroke="var(--map-region-eco-line)" strokeWidth={1.5} strokeLinecap="round">
          <path d="M0 12V0m0 5-7-5m7 8 8-5" />
          <path d="M-7 0c5-1 7 1 7 5-5 1-7-1-7-5Zm15 3c-5-1-7 1-8 5 5 1 7-1 8-5Z" fill="#b8d1b7" stroke="none" />
        </g>
      ) : null}
      {unviewed ? <CloudBank x={0} y={-43} scale={0.72} opacity={0.72} /> : null}
    </g>
  );
}

export function ArchipelagoTerrain({
  islands,
}: {
  islands: { item: MapItem; echo: boolean; viewed?: boolean; isNew?: boolean; contentRich?: boolean }[];
}) {
  const activeId = useContext(MapActiveContext);

  return (
    <svg
      viewBox="0 0 1000 560"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      pointerEvents="none"
    >
      <defs>
        <linearGradient id="archipelago-water" x1="80" y1="25" x2="930" y2="535" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e8f4f2" />
          <stop offset="0.5" stopColor="var(--map-ocean)" />
          <stop offset="1" stopColor="var(--map-ocean-deep)" />
        </linearGradient>
        <filter id="archipelago-echo-glow" x="-180%" y="-180%" width="460%" height="460%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="var(--amber-hot)" floodOpacity="0.58" result="gold" />
          <feComposite in="gold" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x={0} y={0} width={1000} height={560} rx={20} fill="url(#archipelago-water)" />
      <path d="M0 412C170 366 324 404 481 378C650 350 793 305 1000 327V560H0Z" fill="#9bc8cd" opacity={0.14} />
      <path d="M27 180C156 149 265 156 369 132M669 438C790 409 874 421 976 389" fill="none" stroke="#f8ffff" strokeWidth={2} strokeLinecap="round" opacity={0.36} />

      {islands.slice(1).map(({ item }, i) => {
        const previous = islands[i].item;
        const x1 = previous.x * 10;
        const y1 = previous.y * 5.6;
        const x2 = item.x * 10;
        const y2 = item.y * 5.6;
        const cx = (x1 + x2) / 2;
        const cy = Math.min(y1, y2) - 38 - i * 8;
        return (
          <g key={`${previous.id}-${item.id}`} fill="none" strokeLinecap="round">
            <path d={`M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`} stroke="#f4ffff" strokeWidth={5} opacity={0.34} />
            <path
              d={`M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`}
              stroke="#8fb9bd"
              strokeWidth={1.5}
              strokeDasharray="5 7"
              opacity={0.54}
            />
            <circle cx={cx} cy={cy} r={3} fill="#f7ffff" stroke="#9fc4c7" strokeWidth={1} opacity={0.72} />
          </g>
        );
      })}

      <WaterRipple x={104} y={316} scale={1.08} opacity={0.44} />
      <WaterRipple x={874} y={247} scale={1.25} opacity={0.44} />
      <WaterRipple x={835} y={466} scale={0.82} opacity={0.38} />

      {islands.map(({ item, echo, viewed = true, isNew = false, contentRich = false }, i) => {
        const unviewed = !viewed;
        const isActive = activeId === item.id;
        const variant = i % ISLAND_TOPS.length;
        const scale = ISLAND_SCALES[variant] * (contentRich ? 1.14 : 1);

        return (
          <g key={item.id} transform={`translate(${item.x * 10} ${item.y * 5.6 + 2}) scale(${scale})`}>
            <g
              className={`island${unviewed ? " is-unviewed" : ""}${isNew ? " is-new" : ""}${
                isActive ? " is-active" : ""
              }`}
            >
              <IslandVisual variant={variant} echo={echo} unviewed={unviewed} isNew={isNew} />
            </g>
          </g>
        );
      })}

      <g opacity={0.48}>
        <path d="m159 405 12-5 13 6-13 5Z" fill="#e7ddca" />
        <path d="m159 405 12 6 13-5v4l-13 6-12-6Z" fill="#9caea5" />
        <path d="m808 160 9-4 10 4-10 5Z" fill="#e7ddca" />
        <path d="m808 160 9 5 10-5v3l-10 5-9-5Z" fill="#9caea5" />
      </g>

      <CloudBank x={82} y={91} scale={0.98} opacity={0.5} />
      <CloudBank x={914} y={106} scale={0.8} opacity={0.43} />
      <CloudBank x={916} y={479} scale={1.08} opacity={0.4} />
    </svg>
  );
}
