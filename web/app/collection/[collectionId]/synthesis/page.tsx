import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getCollection, videosOf } from "@/lib/data";
import { realCollectionDetail } from "@/lib/server/real-data";
import { SynthesisPoints } from "@/components/reader/SynthesisPoints";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

export const dynamic = "force-dynamic";

/* 数据源两层：种子合集（lib/data.ts）优先命中，miss 时查真实解析合集（store）。
   合集级 synthesis 由管线 L6 收尾生成；没生成出来就走"关联不够多"兜底。 */
export default async function CollectionSynthesisPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { collectionId } = await params;
  const { from } = await searchParams;

  const seed = getCollection(collectionId);
  const real = seed ? null : realCollectionDetail(collectionId);
  if (!seed && !real) notFound();

  const collection = seed
    ? {
        name: seed.name,
        categoryId: seed.categoryId,
        echoCount: seed.echoCount,
        synthesis: seed.synthesis ?? null,
        cognitiveExpansion: seed.cognitiveExpansion,
        sourceUrl: "",
      }
    : {
        name: real!.name,
        categoryId: real!.categoryId,
        echoCount: real!.echoCount,
        synthesis: real!.synthesis,
        cognitiveExpansion: real!.cognitiveExpansion ?? undefined,
        sourceUrl: real!.sourceUrl,
      };

  // 返回键回到进来的那一级：从区域地图的「合集解析」进来（?from=region）就回区域，
  // 默认（群岛页进来）回群岛。文字与目的地一致。
  const category = getCategory(collection.categoryId);
  const backToRegion = from === "region" && !!category;
  const backHref = backToRegion ? `/category/${collection.categoryId}` : `/collection/${collectionId}`;
  const backLabel = backToRegion ? `${category!.name}区域` : `${collection.name} · 群岛`;

  const videos = seed
    ? videosOf(collectionId).map((v) => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        echoCount: v.nodes.filter((n) => n.echo).length,
        sourceUrl: v.sourceUrl,
      }))
    : real!.islands.map((v) => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        echoCount: v.echoCount,
        sourceUrl: v.sourceUrl || undefined,
      }));

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <div className="docNav">
        <Link className="backlink" href={backHref}>
          ← &nbsp;{backLabel}
        </Link>
        {collection.sourceUrl && (
          <span className="navR">
            <a
              className="sourceJump"
              href={collection.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原合集</span>
              <span aria-hidden="true">↗</span>
            </a>
          </span>
        )}
      </div>

      <h1 className="display">
        {collection.synthesis?.seriesQuestion ?? `${collection.name}：这组视频合起来在说什么？`}
      </h1>
      <div className="dmeta">
        <span>
          {`${collection.name} · ${videos.length} 集`}
          {collection.echoCount > 0 && (
            <span className="gold">{` · ✦ ${collection.echoCount} 回响`}</span>
          )}
        </span>
      </div>

      <nav className="toc" aria-label="单集入口">
        {videos.map((v, i) => (
          <div key={v.id} className="tocLine">
            <Link className="tocRow" href={`/video/${v.id}`}>
              <span className="no">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">{v.title}</span>
              <span className="ec">{v.echoCount > 0 ? `✦ ${v.echoCount}` : ""}</span>
              <span className="dur">{v.duration}</span>
            </Link>
            {v.sourceUrl && (
              <a
                className="tocSrc"
                href={v.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${v.title} 原视频`}
              >
                ↗
              </a>
            )}
          </div>
        ))}
      </nav>

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">知识点</span>
      </div>
      {collection.synthesis ? (
        <SynthesisPoints points={collection.synthesis.points} videoIds={videos.map((v) => v.id)} />
      ) : (
        <p style={{ padding: "24px 0", color: "var(--ink-3)", fontSize: 14 }}>
          这组内容之间的跨视频关联还不够多，暂时生成不出知识点合成——单集解析仍然可用，见上方集数索引。
        </p>
      )}

      {collection.cognitiveExpansion && (
        <>
          <div className="sh">
            <span className="no">贰</span>
            <span className="tt">认知·拓展</span>
            <span className="sub">该补上的，值得追问的</span>
          </div>
          <CognitiveExpansionBlock
            data={collection.cognitiveExpansion}
            topicBase={`collection.${collectionId}`}
          />
        </>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
