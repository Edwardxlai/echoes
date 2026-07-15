"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/* 合集/多链接解析等待页：逐条展示组内每条视频的状态；
   解析完成的条目可直接进它的解析页（跨视频合成是后续里程碑，本页只是进度+入口）。 */

interface GroupAsset {
  id: string;
  status: "uploaded" | "transcribing" | "analyzing" | "analyzed" | "failed";
  step: string;
  title: string;
  errorMessage: string;
}

const STATUS_TEXT: Record<GroupAsset["status"], string> = {
  uploaded: "排队中",
  transcribing: "转写中",
  analyzing: "理解中",
  analyzed: "✓ 完成",
  failed: "✗ 失败",
};

export default function GroupParsingPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [assets, setAssets] = useState<GroupAsset[] | null>(null);
  const [gone, setGone] = useState(false);

  const settled = (a: GroupAsset) => a.status === "analyzed" || a.status === "failed";

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (res.status === 404) { setGone(true); stop = true; return; }
        const data = await res.json();
        setAssets(data.assets);
        if ((data.assets as GroupAsset[]).every(settled)) stop = true;
      } catch { /* 网络抖动，下一轮再试 */ }
    };
    poll();
    const t = setInterval(() => {
      if (stop) clearInterval(t);
      else poll();
    }, 2000);
    return () => clearInterval(t);
  }, [groupId]);

  const doneCount = assets?.filter((a) => a.status === "analyzed").length ?? 0;

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />

      <div className="kick">接入脉络 · 一组视频</div>
      <h1 className="display">
        {assets
          ? `${doneCount} / ${assets.length} 条已完成`
          : "正在接入这组视频…"}
      </h1>

      {gone && (
        <div className="perr">
          <div className="pt">找不到这组解析任务</div>
          <div className="pd">
            回到世界地图重新粘贴链接，或先
            <Link className="kfrom" href="/collection/c1/synthesis">用示例数据看看</Link>。
          </div>
        </div>
      )}

      {assets && (
        <div className="toc">
          {assets.map((a, i) =>
            a.status === "analyzed" ? (
              <Link key={a.id} className="tocRow" href={`/video/${a.id}`}>
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <span className="t">{a.title || "解析中的视频"}</span>
                <span className="dur">{STATUS_TEXT[a.status]}</span>
              </Link>
            ) : (
              <div key={a.id} className="tocRow">
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <span className="t">
                  {a.title || "…"}
                  {a.status === "failed" && a.errorMessage
                    ? ` —— ${a.errorMessage}`
                    : ""}
                </span>
                <span className="dur">
                  {a.status === "failed" ? STATUS_TEXT.failed : a.step || STATUS_TEXT[a.status]}
                </span>
              </div>
            )
          )}
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
