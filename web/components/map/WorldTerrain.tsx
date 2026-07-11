"use client";

import Image from "next/image";
import { useContext } from "react";
import { MapActiveContext } from "./MapStage";

const FOCUS_IMAGES = [
  {
    id: "region-eco",
    src: "/map/world/world-focus-economy.png",
    className: "worldTerrainArt__focus worldTerrainArt__focus--economy",
  },
  {
    id: "region-tech",
    src: "/map/world/world-focus-technology.png",
    className: "worldTerrainArt__focus worldTerrainArt__focus--technology",
  },
  {
    id: "region-his",
    src: "/map/world/world-focus-history.png",
    className: "worldTerrainArt__focus worldTerrainArt__focus--history",
  },
] as const;

export function WorldTerrain() {
  const activeId = useContext(MapActiveContext);

  return (
    <div className="worldTerrainArt" data-active-region={activeId ?? undefined}>
      <Image
        className="worldTerrainArt__base"
        src="/map/world/world-base.png"
        alt=""
        fill
        sizes="(max-width: 560px) 460px, min(1360px, 100vw)"
        preload
        draggable={false}
      />

      {FOCUS_IMAGES.map((image) => (
        <Image
          key={image.id}
          className={`${image.className}${activeId === image.id ? " is-active" : ""}`}
          src={image.src}
          alt=""
          fill
          sizes="(max-width: 560px) 460px, min(1360px, 100vw)"
          loading="eager"
          fetchPriority="low"
          draggable={false}
        />
      ))}

      <div className="worldTerrainArt__edgeLight" aria-hidden="true" />
    </div>
  );
}
