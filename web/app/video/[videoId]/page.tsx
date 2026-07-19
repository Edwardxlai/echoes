import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getCollection, getVideo } from "@/lib/data";
import {
  getAsset, getCollectionRow, getParsedVideo, isMappedRegionCategory, listCollections,
} from "@/lib/server/store";
import { MISC_COLLECTION, type CategoryId } from "@/lib/server/pipeline";
import { Spine } from "@/components/reader/Spine";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { MoveControl, type MoveTargetCategory } from "@/components/reader/MoveControl";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

const CONTINENT_IDS = ["eco", "his", "tech"] as const;

export const dynamic = "force-dynamic";

/* 数据源两层：种子数据（lib/data.ts，预烘焙兜底/演示）优先命中，
   miss 时查真实解析结果（store）。真实解析视频的回响挂在脉络节点上（L5），
   认知拓展含补缺 + 延伸（L4）；生成失败时对应块缺席，不摆空壳。 */
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
  const echoCount = video.nodes.filter((n) => n.echo).length;

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

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <div className="docNav">
        <Link
          className="backlink"
          href={collection ? `/collection/${collection.id}` : "/"}
        >
          ← &nbsp;{collection?.name ?? "世界地图"}
        </Link>
        {(video.sourceUrl || moveTargets) && (
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
        )}
      </div>

      <h1 className="display display--question">{video.coreQuestion}</h1>
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
      <Spine nodes={video.nodes} videoId={video.id} />

      {cognitiveExpansion && (
        <>
          <div className="sh">
            <span className="no">贰</span>
            <span className="tt">认知·拓展</span>
            <span className="sub">该补上的，值得追问的</span>
          </div>
          <CognitiveExpansionBlock data={cognitiveExpansion} topicBase={`extend.${video.id}`} />
        </>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
