"use client";

import { useState } from "react";
import type { Node } from "@/lib/data";
import { EchoBlock, FocusMark } from "./EchoBlock";

const CN_NUM = ["一", "二", "三", "四", "五", "六", "七"];

/* 同一环节出现多次时加序号（"转折点"×4 → 转折一…转折四），一眼可见推进顺序；
   为守住4字/48px列宽，加序号时"XX点/XX链"缩成两字干。 */
function displayRoles(nodes: Node[]): (string | undefined)[] {
  const total = new Map<string, number>();
  for (const n of nodes) if (n.role) total.set(n.role, (total.get(n.role) ?? 0) + 1);
  const seen = new Map<string, number>();
  return nodes.map((n) => {
    if (!n.role) return undefined;
    if ((total.get(n.role) ?? 0) < 2) return n.role;
    const i = (seen.get(n.role) ?? 0) + 1;
    seen.set(n.role, i);
    const stem = n.role.length >= 3 ? n.role.slice(0, 2) : n.role;
    return `${stem}${CN_NUM[i - 1] ?? i}`;
  });
}

export function Spine({ nodes, videoId }: { nodes: Node[]; videoId?: string }) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const roles = displayRoles(nodes);
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="spine">
      {nodes.map((n, ni) => {
        const isOpen = openIds.has(n.id);
        const glow = !!n.echo;
        return (
          <div
            key={n.id}
            className={`node${glow ? " glow" : ""}${isOpen ? " open" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => toggle(n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") toggle(n.id);
            }}
          >
            <span className={roles[ni] ? "ts role" : "ts"}>{roles[ni] || n.timestampText}</span>
            <span className="dot" />
            <div className="nbody">
              <div className="nlabel">
                <span className="ltext">{glow ? <span className="hl">{n.label}</span> : n.label}</span>
                {glow && <span className="sp">✦ 回响</span>}
              </div>
              <div className="detail">
                <div className="dtext">
                  <FocusMark text={n.detail} focus={n.echo?.nodeFocus} />
                </div>
                {n.echo && (
                  <EchoBlock
                    echo={n.echo}
                    topicId={videoId ? `video.${videoId}` : undefined}
                    nodeId={n.id}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
