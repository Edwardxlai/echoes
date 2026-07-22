import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, videosOf } from "@/lib/data";
import { realCollectionDetail } from "@/lib/server/real-data";
import { KnowledgeMatrix } from "@/components/reader/KnowledgeMatrix";
import { CollectionHeat } from "@/components/reader/CollectionHeat";
import { CollectionThoughts } from "@/components/reader/CollectionThoughts";
import { CollectionShareButton } from "@/components/reader/CollectionShareButton";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";
import { mockEngagement } from "@/lib/server/engagement";

export const dynamic = "force-dynamic";

/* 数据源两层：种子合集（lib/data.ts）优先命中，miss 时查真实解析合集（store）。
   合集级 synthesis 由管线 L6 收尾生成；没生成出来就走"关联不够多"兜底。 */
export default async function CollectionSynthesisPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;

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
        cover: videosOf(collectionId)[0]?.cover ?? "",
      }
    : {
        name: real!.name,
        categoryId: real!.categoryId,
        echoCount: real!.echoCount,
        synthesis: real!.synthesis,
        cognitiveExpansion: real!.cognitiveExpansion ?? undefined,
        sourceUrl: real!.sourceUrl,
        cover: real!.cover,
      };

  const backHref = `/collection/${collectionId}`;

  const videos = seed
    ? videosOf(collectionId).map((v) => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        echoCount: v.nodes.filter((n) => n.echo).length,
        engagementHeat: mockEngagement(v.id).commentCount,
         sourceUrl: v.sourceUrl,
         creator: v.creator,
         cover: v.cover,
      }))
    : real!.islands.map((v) => ({
        id: v.id,
        title: v.title,
        duration: v.duration,
        echoCount: v.echoCount,
        engagementHeat: v.engagementHeat,
         sourceUrl: v.sourceUrl || undefined,
         creator: v.creator,
         cover: v.cover,
       }));

  const creators = [...new Set(videos.map((video) => video.creator).filter(Boolean))];
  const creatorLabel = creators.length === 1 ? creators[0] : creators.length > 1 ? `${creators.length} 位创作者` : "";
  const seriesQuestion = collection.synthesis?.seriesQuestion ?? `${collection.name}：这组视频合起来在说什么？`;
  const episodeLabelById = new Map(
    collection.synthesis?.episodeLabels?.map((item) => [item.videoId, item.label]) ?? []
  );

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <div className="docNav">
        <BackLink className="backlink" href={backHref}>
          ← &nbsp;返回
        </BackLink>
        <span className="navR">
          {collection.sourceUrl && (
            <a
              className="sourceJump"
              href={collection.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原合集</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <CollectionShareButton
            collectionId={collectionId}
            hook={seriesQuestion}
            name={collection.name}
            creator={creatorLabel}
            cover={collection.cover}
            episodes={videos.map((video) => ({
              title: video.title,
              label: episodeLabelById.get(video.id),
              heat: video.engagementHeat,
              cover: video.cover,
            }))}
          />
        </span>
      </div>

      <h1 className="display display--question">
        {seriesQuestion}
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

      <CollectionHeat values={videos.map((v) => v.engagementHeat)} />

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">关系棋盘</span>
      </div>
      {collection.synthesis ? (
        <KnowledgeMatrix points={collection.synthesis.points} videoIds={videos.map((v) => v.id)} />
      ) : (
        <p style={{ padding: "24px 0", color: "var(--ink-3)", fontSize: 14 }}>
          这组内容之间的跨视频关联还不够多，暂时生成不出知识点合成——单集解析仍然可用，见上方集数索引。
        </p>
      )}

      {collection.cognitiveExpansion && (
        <>
          <div className="sh">
            <span className="no">贰</span>
            <span className="tt">补缺</span>
            <span className="sub">整组内容共同略过的背景</span>
          </div>
          <CognitiveExpansionBlock data={collection.cognitiveExpansion} />
        </>
      )}

      <div className="sh">
        <span className="no">{collection.cognitiveExpansion ? "叁" : "贰"}</span>
        <span className="tt">想法</span>
      </div>
      <CollectionThoughts
        collectionId={collectionId}
        collectionName={collection.name}
        categoryId={collection.categoryId}
        href={`/collection/${collectionId}/synthesis`}
        episodeVideoIds={videos.map((v) => v.id)}
        videoTitles={Object.fromEntries(videos.map((v) => [v.id, v.title]))}
      />

      <div className="colophon">✦</div>
    </div>
  );
}
