import Link from "next/link";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";
import { getAsset } from "@/lib/server/store";
import { realCollectionDetail } from "@/lib/server/real-data";
import { getVideo } from "@/lib/data";
import { getSampleReader, SAMPLE_TEMPLATES } from "@/lib/reader/sample-readers";

export const dynamic = "force-dynamic";

/* 示例入口：五种单视频解析结构各取一条真实视频，另放一条合集关系棋盘样例。 */
export default function SamplesPage() {
  const rows = SAMPLE_TEMPLATES.map((s) => {
    // 真实解析视频存在 store（getAsset）；找不到再落回种子数据（getVideo），
    // 都找不到才落回核心问题，避免标题行和问题行显示成同一句话。
    const asset = getAsset(s.id);
    const seedVideo = getVideo(s.id);
    const sample = getSampleReader(s.id);
    return {
      id: s.id,
      label: s.label,
      title: asset?.title ?? seedVideo?.title ?? sample?.coreQuestion ?? s.id,
      creator: asset?.author ?? seedVideo?.creator ?? "",
      duration: asset?.duration ?? seedVideo?.duration ?? "",
      coreQuestion: sample?.coreQuestion ?? "",
    };
  });

  const collection = realCollectionDetail("89352f66")!;
  const collectionVideoCount = collection.islands.length;

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <div className="docNav">
        <BackLink className="backlink" href="/">
          ← &nbsp;返回
        </BackLink>
      </div>

      <h1 className="display">示例</h1>
      <p className="samplesLede">
        合集关系棋盘与单视频五模板分开演示，避免把合集种子数据误当成单视频模板结果。
      </p>

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">合集页</span>
      </div>
      <div className="samplesList">
        <Link className="sampleRow" href="/collection/89352f66/synthesis">
          <span className="sampleNo">01</span>
          <span className="sampleBody">
            <span className="sampleHead">
              <span className="sampleTag">关系棋盘</span>
              <span className="sampleTitle">{collection.name}</span>
            </span>
            <span className="sampleQ">{collection.synthesis?.seriesQuestion}</span>
            <span className="sampleMeta">{collectionVideoCount} 集 · ✦ {collection.echoCount} 回响</span>
          </span>
          <span className="sampleGo" aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="sh">
        <span className="no">贰</span>
        <span className="tt">单视频五模板</span>
        <span className="sub">五种解析结构各取一条真实视频</span>
      </div>
      <div className="samplesList">
        {rows.map((r, i) => (
          <Link key={r.id} className="sampleRow" href={`/video/${r.id}`}>
            <span className="sampleNo">{String(i + 1).padStart(2, "0")}</span>
            <span className="sampleBody">
              <span className="sampleHead">
                <span className="sampleTag">{r.label}</span>
                <span className="sampleTitle">{r.title}</span>
              </span>
              {r.coreQuestion && <span className="sampleQ">{r.coreQuestion}</span>}
              {(r.creator || r.duration) && (
                <span className="sampleMeta">
                  {[r.creator, r.duration].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className="sampleGo" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      <div className="colophon">✦</div>
    </div>
  );
}
