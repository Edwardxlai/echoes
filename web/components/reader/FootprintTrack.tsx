"use client";

import { useEffect } from "react";
import {
  recordFootprint,
  registerAnchorManifest,
  type AnchorManifestItem,
} from "@/lib/client/journal";

interface TrackedNode {
  anchorId: string;
  label: string;
  detail: string;
  echo?: {
    targetAnchorId?: string;
    relation: string;
    text: string;
  };
}

/**
 * Registers the latest generated anchors and records video/node/echo exploration.
 * Event delegation keeps the record layer independent from Phase 1 render components.
 */
export function FootprintTrack({
  videoId,
  videoTitle,
  categoryId,
  collectionId,
  collectionTitle,
  nodes,
}: {
  videoId: string;
  videoTitle: string;
  categoryId: string;
  collectionId?: string;
  collectionTitle?: string;
  nodes: TrackedNode[];
}) {
  const nodeSignature = JSON.stringify(nodes);

  useEffect(() => {
    const currentNodes = JSON.parse(nodeSignature) as TrackedNode[];
    const anchors: AnchorManifestItem[] = currentNodes.flatMap((node) => [
      { anchorId: node.anchorId, kind: "node" as const, label: node.label, text: node.detail },
      ...(node.echo?.targetAnchorId
        ? [{
            anchorId: node.echo.targetAnchorId,
            kind: "echo" as const,
            label: node.echo.relation,
            text: node.echo.text,
          }]
        : []),
    ]);
    registerAnchorManifest({
      videoId,
      videoTitle,
      href: `/video/${videoId}`,
      anchors,
    });
    recordFootprint({ videoId, videoTitle, categoryId, collectionId, collectionTitle });

    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest(".node") : null;
      if (!element) return;
      const renderedNodes = [...document.querySelectorAll(".doc .spine > .node")];
      const index = renderedNodes.indexOf(element);
      const node = currentNodes[index];
      if (!node) return;
      recordFootprint({
        videoId,
        videoTitle,
        categoryId,
        collectionId,
        collectionTitle,
        exploredAnchorIds: [node.anchorId],
        viewedEchoAnchorIds: node.echo?.targetAnchorId ? [node.echo.targetAnchorId] : [],
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [videoId, videoTitle, categoryId, collectionId, collectionTitle, nodeSignature]);

  return null;
}
