import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  legacyTopicRedirect,
  resolveTopic,
  topicPosts,
  topicQuotePool,
} from "@/lib/server/discussion";
import { TopicThread } from "@/components/topic/TopicThread";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

export const dynamic = "force-dynamic";

/* 讨论空间（讨论区收拢版，2026-07-20 定稿）：一视频/一合集一空间，
   头部只写空间名，延伸问题与回响引用都下沉为帖流里的内容（置顶帖/quoteRef）。
   旧线编码（extend./echo.）打到这里时找不到 topic，走 legacyTopicRedirect 转投新空间。 */
export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { topicId } = await params;
  const topic = resolveTopic(topicId);
  if (!topic) {
    const target = legacyTopicRedirect(topicId);
    if (target) redirect(target);
    notFound();
  }

  const sp = await searchParams;
  const quoteParam = typeof sp.quote === "string" ? sp.quote : null;
  const replyParam = typeof sp.reply === "string" ? sp.reply : null;

  const posts = topicPosts(topicId, topic.categoryId);
  const quotePool = topicQuotePool(topicId);

  return (
    <div className="doc">
      <BrandHomeLink className="readerBrand" />

      {/* 返回键只写目的地：视频空间回《标题》解析页，合集空间回「名称 · 合集解析」 */}
      <Link className="backlink" href={topic.backHref}>
        {topic.kind === "collection"
          ? `← ${topic.ownerTitle} · 合集解析`
          : `← 《${topic.ownerTitle}》`}
      </Link>

      <div className="tflow">
        <div className="qrow">
          <h1 className="display display--question">{topic.ownerTitle}</h1>
        </div>

        <TopicThread
          topicId={topicId}
          topic={topic}
          posts={posts}
          quotePool={quotePool}
          initialQuoteId={quoteParam}
          initialReplyTarget={replyParam}
        />
      </div>

      <div className="colophon">✦</div>
    </div>
  );
}
