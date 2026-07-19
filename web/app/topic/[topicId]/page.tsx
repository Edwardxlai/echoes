import Link from "next/link";
import { notFound } from "next/navigation";
import {
  categoryGate,
  resolveTopic,
  topicPosts,
  topicQuotePool,
} from "@/lib/server/discussion";
import { TopicThread } from "@/components/topic/TopicThread";
import { FocusMark } from "@/components/reader/EchoBlock";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

export const dynamic = "force-dynamic";

/* 同题空间（讨论区 P0）：延伸题线与回响交点线共用本模板，只换头部锚定与门槛。
   延伸线头部=问题本身；回响线头部=复现回响块（先看到"划线原文"，微信读书式），
   全站讨论里唯一允许暖金出现的位置——因为头部就是回响本体。 */
export default async function TopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = resolveTopic(topicId);
  if (!topic) notFound();

  const posts = topicPosts(topicId, topic.categoryId);
  const gate = topic.kind === "extend" ? categoryGate(topic.categoryId) : null;
  const quotePool = topicQuotePool(topicId);

  /* 方案4：头部锚定并入左轨栅格——空心起点环挂在问题/回响块旁，
     发丝线从这里一路画到 composer（有帖才画线，空题只留孤环）。 */
  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />

      {/* 返回键只写目的地：视频题回《标题》解析页，合集题回「名称 · 合集解析」 */}
      <Link className="backlink" href={topic.backHref}>
        {topic.kind === "extend"
          ? topic.backHref.endsWith("/synthesis")
            ? `← ${topic.ownerTitle} · 合集解析`
            : `← 《${topic.ownerTitle}》`
          : `← 《${topic.videoTitle}》`}
      </Link>

      <div className={`tflow${posts.length > 0 ? " haslines" : ""}`}>
        <div className="qrow">
          <span className="torigin" aria-hidden />
          {topic.kind === "extend" ? (
            <h1 className="display display--question">{topic.question}</h1>
          ) : (
            <div className="echoIn techo">
              <div className="er">
                ✦{" "}
                {topic.echo.relation.includes("《")
                  ? topic.echo.relation
                  : `《${topic.echo.targetTitle}》${topic.echo.relation}`}
              </div>
              {topic.echo.oldSay ? (
                <div className="eq">
                  <FocusMark text={topic.echo.oldSay} focus={topic.echo.oldFocus} />
                </div>
              ) : (
                topic.echo.sentence && <div className="ef">{topic.echo.sentence}</div>
              )}
            </div>
          )}
        </div>

        <TopicThread
          topicId={topicId}
          posts={posts}
          gate={gate}
          quotePool={quotePool}
        />
      </div>

      <div className="colophon">✦</div>
    </div>
  );
}
