"use client";

import { useState } from "react";
import Link from "next/link";
import type { Echo, Node } from "@/lib/data";

export function Spine({ nodes }: { nodes: Node[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="spine">
      {nodes.map((n) => {
        const isOpen = openId === n.id;
        const glow = !!n.echo;
        return (
          <div
            key={n.id}
            className={`node${glow ? " glow" : ""}${isOpen ? " open" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(isOpen ? null : n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setOpenId(isOpen ? null : n.id);
            }}
          >
            <span className="ts">{n.timestampText}</span>
            <span className="dot" />
            <div className="nbody">
              <div className="nlabel">
                {glow ? <span className="hl">{n.label}</span> : n.label}
                {glow && <span className="sp">✦ 回响</span>}
              </div>
              <div className="detail">
                <div className="dtext">{n.detail}</div>
                {n.echo && <EchoBlock echo={n.echo} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EchoBlock({ echo }: { echo: Echo }) {
  return (
    <div className="echoIn">
      <div className="er">
        ✦ 跟你看过的《{echo.targetTitle}》{echo.relation}
      </div>
      <div className="ef">{echo.sentence}</div>
      {echo.targetVideoId ? (
        <Link
          className="ejump"
          href={`/video/${echo.targetVideoId}`}
          onClick={(e) => e.stopPropagation()}
        >
          跳过去看《{echo.targetTitle}》 →
        </Link>
      ) : (
        <div className="esrc">
          来自你看过的《{echo.targetTitle}》· {echo.creator} · {echo.timestampText}
        </div>
      )}
    </div>
  );
}
