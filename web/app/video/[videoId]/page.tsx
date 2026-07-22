import { notFound } from "next/navigation";
import { getCategory, getCollection, getVideo } from "@/lib/data";
import {
  getAsset, getCollectionRow, getParsedVideo, isMappedRegionCategory, listCollections,
} from "@/lib/server/store";
import { MISC_COLLECTION, type CategoryId } from "@/lib/server/pipeline";
import { AnalysisRenderer } from "@/components/reader/AnalysisRenderer";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { MoveControl, type MoveTargetCategory } from "@/components/reader/MoveControl";
import { FootprintTrack } from "@/components/reader/FootprintTrack";
import { ThoughtBar } from "@/components/reader/ThoughtBar";
import { CommentHeatmap } from "@/components/reader/CommentHeatmap";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";
import { createArgumentDispatch } from "@/lib/analysis-contract";
import { getSampleReader } from "@/lib/reader/sample-readers";

const CONTINENT_IDS = ["eco", "his", "tech"] as const;

export const dynamic = "force-dynamic";

/* 数据源两层：种子数据（lib/data.ts，预烘焙兜底/演示）优先命中，
   miss 时查真实解析结果（store）。真实解析视频的回响挂在脉络节点上（L5），
   L4 补缺生成失败时对应块缺席，不摆空壳。 */
export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const seed = getVideo(videoId);
  const parsed = seed ? null : getParsedVideo(videoId);
  if (!seed && !parsed) notFound();

  const collection = seed
    ? getCollection(seed.collectionId)
    : parsed!.collectionId
      ? getCollectionRow(parsed!.collectionId)
      : null;
  const video = seed ?? parsed!;
  const cognitiveExpansion = seed ? seed.cognitiveExpansion : parsed!.cognitiveExpansion;
  // Phase 1 五模板示例：命中样例视频时，用手工编排的模板 dispatch 覆盖脉络渲染。
  const sample = getSampleReader(video.id);
  const heat = parsed?.commentHeat ?? null;
  const coreQuestion = sample?.coreQuestion ?? video.coreQuestion;
  const echoCount = sample ? sample.echoCount : video.nodes.filter((n) => n.echo).length;

  const restParts = [video.creator, video.duration, `${video.nodes.length} 个节点`].filter(
    Boolean
  );

  // 「移动」只给真实解析视频，且 mix 合集（创作者策展镜像）整组归类，单集不给挪
  const asset = parsed ? getAsset(videoId) : null;
  const movable =
    !!asset &&
    (!asset.collectionId ||
      asset.collectionId.startsWith("tc-") ||
      asset.collectionId.startsWith("misc-"));
  const moveTargets: MoveTargetCategory[] | null = movable
    ? CONTINENT_IDS.map((cid: CategoryId) => ({
        id: cid,
        name: getCategory(cid)?.name ?? cid,
        collections: [
          { id: MISC_COLLECTION[cid].id, name: "散篇集", misc: true },
          ...listCollections(cid)
            .filter((c) => c.id.startsWith("tc-"))
            .map((c) => ({ id: c.id, name: c.name, misc: false })),
        ],
      }))
    : null;
  const currentCategoryId =
    asset && isMappedRegionCategory(asset.bigCategoryId) ? asset.bigCategoryId : null;

  const categoryId = seed ? collection?.categoryId ?? "" : currentCategoryId ?? "";
  const dispatch = parsed?.dispatch ?? createArgumentDispatch({
    coreQuestion: video.coreQuestion,
    nodes: video.nodes.map((node) => ({
      id: node.id,
      anchorId: node.anchorId,
      concept: node.label,
      role: node.role,
      detail: node.detail,
      timestamp: node.timestampText,
    })),
    confidence: video.typeConfidence,
    reason: "seed-argument-migration",
  });

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <FootprintTrack
        videoId={video.id}
        videoTitle={video.title}
        categoryId={categoryId}
        collectionId={collection?.id}
        collectionTitle={collection?.name}
        nodes={video.nodes.map((node) => ({
          anchorId: node.anchorId,
          label: node.label,
          detail: node.detail,
          ...(node.echo
            ? {
                echo: {
                  targetAnchorId: node.echo.targetAnchorId,
                  relation: node.echo.relation,
                  text: node.echo.oldSay ?? node.echo.sentence ?? node.echo.targetTitle,
                },
              }
            : {}),
        }))}
      />
      <div className="docNav">
        <BackLink
          className="backlink"
          href={collection ? `/collection/${collection.id}` : "/"}
        >
          ← &nbsp;返回
        </BackLink>
        <span className="navR">
          {video.sourceUrl && (
            <a
              className="sourceJump"
              href={video.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>查看原视频</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
          {moveTargets && (
            <MoveControl
              assetId={video.id}
              currentCategoryId={currentCategoryId}
              currentCollectionId={parsed?.collectionId ?? null}
              targets={moveTargets}
            />
          )}
        </span>
      </div>

      <h1 className="display display--question">{coreQuestion}</h1>
      <div className="dmeta">
        <span className="dtitle">《{video.title}</span>
        <span className="drest">
          {`》${restParts.length > 0 ? ` · ${restParts.join(" · ")}` : ""}`}
          {echoCount > 0 && <span className="gold">{` · ✦ ${echoCount} 回响`}</span>}
        </span>
      </div>

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">脉络</span>
      </div>
      <AnalysisRenderer
        dispatch={sample?.dispatch ?? dispatch}
        nodes={sample?.nodes ?? video.nodes}
      />

      {cognitiveExpansion && (
        <>
          <div className="sh">
            <span className="no">贰</span>
            <span className="tt">补缺</span>
          </div>
          <CognitiveExpansionBlock data={cognitiveExpansion} />
        </>
      )}

      <div className="sh">
        <span className="no">叁</span>
        <span className="tt">想法</span>
      </div>
      {heat && <CommentHeatmap data={heat} />}
      <ThoughtBar
        videoId={video.id}
        videoTitle={video.title}
        categoryId={categoryId}
        href={`/video/${video.id}`}
      />

      <div className="colophon">✦</div>
    </div>
  );
}
