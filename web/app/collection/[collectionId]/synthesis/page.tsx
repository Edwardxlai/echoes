import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection, videosOf } from "@/lib/data";
import { SynthesisPoints } from "@/components/reader/SynthesisPoints";
import { CognitiveExpansionBlock } from "@/components/reader/CognitiveExpansionBlock";

export default async function CollectionSynthesisPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const collection = getCollection(collectionId);
  if (!collection) notFound();

  const videos = videosOf(collectionId);

  return (
    <div className="doc">
      <Link className="backlink" href={`/collection/${collectionId}`}>
        ← {collection.name} · 群岛
      </Link>

      <div className="kick">这组内容共同回答</div>
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
          <Link key={v.id} className="tocRow" href={`/video/${v.id}`}>
            <span className="no">{String(i + 1).padStart(2, "0")}</span>
            <span className="t">{v.title}</span>
            <span className="dur">{v.duration}</span>
          </Link>
        ))}
      </nav>

      <div className="sh">
        <span className="no">壹</span>
        <span className="tt">知识点</span>
        <span className="hint">明星知识点至少 2 个来源，不是拼一条更长的脉络</span>
      </div>
      {collection.synthesis ? (
        <SynthesisPoints points={collection.synthesis.points} />
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
            <span className="sub">这一组你已知的，未知的，值得追问的</span>
          </div>
          <CognitiveExpansionBlock
            data={collection.cognitiveExpansion}
            mapHref={`/category/${collection.categoryId}`}
            scope="collection"
          />
        </>
      )}

      <div className="colophon">✦</div>
    </div>
  );
}
