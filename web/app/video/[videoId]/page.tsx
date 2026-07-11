import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, getVideo } from "@/lib/data";
import { Spine } from "@/components/reader/Spine";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";
import { VideoTypeTag } from "@/components/reader/VideoTypeTag";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const video = getVideo(videoId);
  if (!video) notFound();

  const collection = getCollection(video.collectionId);
  const echoCount = video.nodes.filter((n) => n.echo).length;

  return (
    <div className="doc">
      <Link className="backlink" href={`/collection/${video.collectionId}`}>
        ←&nbsp;{collection?.name ?? "上一层"}
      </Link>

      <h1 className="display">{video.coreQuestion}</h1>
      <div className="dmeta">
        <span>
          {`《${video.title}》 · ${video.creator} · ${video.duration} · ${video.nodes.length} 个节点`}
          {echoCount > 0 && <span className="gold">{` · ✦ ${echoCount} 回响`}</span>}
        </span>
        <VideoTypeTag initial={video.videoType} confidence={video.typeConfidence} />
      </div>

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">脉络</span>
      </div>
      <Spine nodes={video.nodes} />

      <div className="sh">
        <span className="no">贰</span>
        <span className="tt">认知·拓展</span>
        <span className="sub">你已知的，未知的，值得追问的</span>
      </div>
      <CognitiveExpansionBlock
        data={video.cognitiveExpansion}
        mapHref={`/category/${collection?.categoryId ?? ""}`}
      />

      <div className="colophon">✦</div>
    </div>
  );
}
