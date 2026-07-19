"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/* 单视频解析等待页：轮询状态机（uploaded→transcribing→analyzing→analyzed|failed），
   步骤沿用脉络的点线语言；analyzed 后进解析页，failed 给原因 + 回世界地图的出口。 */

const STEPS = ["解析直链", "下载视频", "抽音频", "语音转写", "AI 理解"] as const;
/* 步骤耗时区间为经验值，仅作等待锚点用，非精确承诺 */
const STEP_HINTS = ["通常 3-5 秒", "通常 5-15 秒", "通常 3-8 秒", "通常 15-40 秒", "通常 10-30 秒"] as const;

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const done = useRef(false);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/retry`, { method: "POST" });
      if (res.ok) {
        // 不等下一轮轮询：本地立即翻回进行中，步骤视图马上顶掉失败面板
        setAsset((prev) =>
          prev ? { ...prev, status: "uploaded", step: "排队重试", errorMessage: "" } : prev,
        );
        setElapsed(0);
      }
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      if (!done.current) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

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

      <div className="docNav">
        <Link className="backlink" href="/">← &nbsp;世界地图</Link>
        {!gone && !failed && <span className="kicktime">{formatElapsed(elapsed)}</span>}
      </div>
      <h1 className="display display--videoTitle">
        {asset?.title ? `《${asset.title}》` : "正在接入这条视频…"}
      </h1>

      {gone && (
        <div className="perr">
          <div className="pt">找不到这条解析任务</div>
          <div className="pd">
            它可能已过期。<Link className="kfrom" href="/">回到世界地图</Link>重新粘贴链接。
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
                  {state === "now" && <span className="pstate">{STEP_HINTS[i]}</span>}
                  {state === "done" && <span className="pstate">✓</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 解析本就在服务端异步跑，离开这页不影响进度；给个显式退出口，
         别让人误以为必须守着这页看完 */}
      {!gone && !failed && (
        <div className="pwander">
          <Link className="kfrom" href="/">先去逛逛，待会回来看</Link>
        </div>
      )}

      {failed && asset && (
        <div className="perr">
          <div className="pt">这条视频没能接入</div>
          <div className="pd pd--why">{asset.errorMessage || "未知原因"}</div>
          <div className="pd">
            <button type="button" className="kfrom" onClick={retry} disabled={retrying}>
              {retrying ? "重试中…" : "重试一次"}
            </button>
            ，或<Link className="kfrom" href="/">回到世界地图</Link>换一条链接。
          </div>
        </div>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
