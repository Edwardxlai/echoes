"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/* 单视频解析等待页：轮询状态机（uploaded→transcribing→analyzing→analyzed|failed），
   步骤沿用脉络的点线语言；analyzed 后进解析页，failed 给原因 + 示例数据兜底出口。 */

const STEPS = ["解析直链", "下载视频", "抽音频", "语音转写", "AI 理解"] as const;

interface AssetState {
  status: "uploaded" | "transcribing" | "analyzing" | "analyzed" | "failed";
  step: string;
  title: string;
  errorMessage: string;
}

/* 当前推进到第几步：完成态=全过；失败态=停在失败那步 */
function stepIndex(s: AssetState): number {
  if (s.status === "analyzed") return STEPS.length;
  const i = STEPS.indexOf(s.step as (typeof STEPS)[number]);
  return i >= 0 ? i : 0;
}

export default function ParsingPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<AssetState | null>(null);
  const [gone, setGone] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}`);
        if (res.status === 404) { setGone(true); return; }
        const data: AssetState = await res.json();
        setAsset(data);
        if (data.status === "analyzed" && !done.current) {
          done.current = true;
          setTimeout(() => router.replace(`/video/${assetId}`), 600);
        }
      } catch { /* 网络抖动，下一轮再试 */ }
    };
    poll();
    const t = setInterval(() => {
      if (!done.current) poll();
    }, 2000);
    return () => clearInterval(t);
  }, [assetId, router]);

  const failed = asset?.status === "failed";
  const current = asset ? stepIndex(asset) : 0;

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />

      <div className="kick">接入脉络</div>
      <h1 className="display display--videoTitle">
        {asset?.title ? `《${asset.title}》` : "正在接入这条视频…"}
      </h1>

      {gone && (
        <div className="perr">
          <div className="pt">找不到这条解析任务</div>
          <div className="pd">
            它可能已过期。回到世界地图重新粘贴链接，或先
            <Link className="kfrom" href="/video/v1">用示例数据看看</Link>。
          </div>
        </div>
      )}

      {!gone && !failed && (
        <div className="pspine" aria-live="polite">
          {STEPS.map((label, i) => {
            const state = i < current ? "done" : i === current ? "now" : "";
            return (
              <div key={label} className={`pnode${state ? ` ${state}` : ""}`}>
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <span className="dot" />
                <span className="plabel">
                  {label}
                  {state === "now" && <span className="pstate">进行中</span>}
                  {state === "done" && <span className="pstate">✓</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {failed && asset && (
        <div className="perr">
          <div className="pt">这条视频没能接入</div>
          <div className="pd">{asset.errorMessage || "未知原因"}</div>
          <div className="pd">
            换一条链接再试，或先
            <Link className="kfrom" href="/video/v1">用示例数据看看</Link>。
          </div>
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
