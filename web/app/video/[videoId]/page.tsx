import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, getVideo } from "@/lib/data";
import { getParsedVideo, getCollectionRow } from "@/lib/server/store";
import { Spine } from "@/components/reader/Spine";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

export const dynamic = "force-dynamic";

/* 数据源两层：种子数据（lib/data.ts，预烘焙兜底/演示）优先命中，
   miss 时查真实解析结果（store）。真实解析视频的回响挂在脉络节点上（L5），
   认知拓展含 known 检索（L4-4a）；生成失败时对应块缺席，不摆空壳。 */
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

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />
      <Link
        className="backlink"
        href={collection ? `/collection/${collection.id}` : "/"}
      >
        ← &nbsp;{collection?.name ?? "世界地图"}
      </Link>

      <h1 className="display">{video.coreQuestion}</h1>
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
      <Spine nodes={video.nodes} />

      {cognitiveExpansion && (
        <>
          <div className="sh">
            <span className="no">贰</span>
            <span className="tt">认知·拓展</span>
            <span className="sub">你已知的，未知的，值得追问的</span>
          </div>
          <CognitiveExpansionBlock
            data={cognitiveExpansion}
            mapHref={collection ? `/category/${collection.categoryId}` : "/"}
          />
        </>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
