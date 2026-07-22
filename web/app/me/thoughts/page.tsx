"use client";

import Link from "next/link";
import { fmtAgo } from "@/lib/time";
import {
  thoughtAttachment,
  useAnchorManifests,
  useThoughts,
  type Thought,
} from "@/lib/client/journal";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";

const relTime = (timestamp: number) => fmtAgo((Date.now() - timestamp) / 3.6e6);

function ThoughtRow({ thought, orphan = false }: { thought: Thought; orphan?: boolean }) {
  return (
    <div className={`tentry${orphan ? " tentry--orphan" : ""}`} key={thought.id}>
      <div className="tentryHead">
        <span className="tentrySrc">《{thought.videoTitle}》</span>
        <time className="tentryTime">{relTime(thought.createdAt)}</time>
      </div>
      {thought.anchor && (
        <div className={`pquote${thought.anchor.kind === "echo" ? " pquote--echo" : ""}`}>
          <span className="pqt">
            {thought.anchor.kind === "echo" && "✦ "}
            {thought.anchor.text}
          </span>
        </div>
      )}
      <p className="tentryText">{thought.body}</p>
      <Link className="tentryLink" href={thought.href}>{orphan ? "回到原视频重新挂靠 →" : "跳回原文 →"}</Link>
    </div>
  );
}

/** 想法岛：想法直接平铺；游离记录（生成更新后语义锚点对不上）单独垫在下面，不会被删除。 */
export default function MyThoughtsPage() {
  const thoughts = useThoughts();
  const manifests = useAnchorManifests();
  const orphaned = thoughts.filter((thought) => thoughtAttachment(thought, manifests) === "orphan");
  const attached = thoughts.filter((thought) => thoughtAttachment(thought, manifests) !== "orphan");

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <BackLink className="backlink" href="/me">← 返回</BackLink>
      <h1 className="display display--question">想法岛</h1>
      <p className="islandCount">
        累计 {thoughts.length} 条想法{orphaned.length > 0 ? ` · ${orphaned.length} 条等待重新挂靠` : ""}
      </p>

      {thoughts.length === 0 ? (
        <p className="tempty">还没记下过想法——看条视频时随手记一句。</p>
      ) : (
        <>
          {attached.length > 0 && (
            <div className="tentryList">{attached.map((thought) => <ThoughtRow key={thought.id} thought={thought} />)}</div>
          )}

          {orphaned.length > 0 && (
            <>
              <p className="islandOrphanNote">生成内容更新后没找到相同锚点，记录不会丢，可回原视频重新挂靠——</p>
              <div className="tentryList">{orphaned.map((thought) => <ThoughtRow key={thought.id} thought={thought} orphan />)}</div>
            </>
          )}
        </>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
