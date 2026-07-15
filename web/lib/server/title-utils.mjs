/**
 * A Douyin "title" is often the complete post description. Keep the title-like
 * first line/sentence and enforce a storage boundary; CSS still owns the exact
 * one-line width for each viewport.
 */
export const MAX_VIDEO_TITLE_LENGTH = 36;

/** @param {string} raw */
export function cleanVideoTitle(raw) {
  const withoutTopics = String(raw ?? "").replace(/#\S+/g, " ").trim();
  if (!withoutTopics) return "";

  const firstLine = withoutTopics.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const normalized = firstLine.replace(/\s+/g, " ").trim();
  const sentenceEnd = normalized.search(/[。！？!?；;]/);
  let titleLike = sentenceEnd >= 0 ? normalized.slice(0, sentenceEnd + 1) : normalized;

  // Backfilled rows may have already lost their original newline. A whitespace
  // boundary followed by Chinese after a substantial prefix is usually where
  // the creator's title ends and prose such as “本视频…” or “上一章…” begins.
  for (const match of titleLike.matchAll(/\s+(?=\p{Script=Han})/gu)) {
    if ((match.index ?? 0) >= 10) {
      titleLike = titleLike.slice(0, match.index).trim();
      break;
    }
  }
  const chars = Array.from(titleLike);

  if (chars.length <= MAX_VIDEO_TITLE_LENGTH) return titleLike;
  return `${chars.slice(0, MAX_VIDEO_TITLE_LENGTH - 1).join("")}…`;
}
