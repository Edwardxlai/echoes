/* ================================================================
   回响 · 服务端解析管线（从 eval/server.mjs 移植，PRD §7）
   范围：抖音 + 直链。B站不做（抖音黑客松，方案文档范围红线）。
   流程：解析直链 → 下载 → 抽音频 → 火山豆包 ASR → DeepSeek 瘦脉络
        → 回响匹配（L5）→ 补缺（L4）→ 大类归属（L3）→ 归入合集。
   与 eval 版的差异：
   1) 结果写进 store，状态机 uploaded→transcribing→analyzing→analyzed|failed；
   2) 分析 prompt 升级为 PRD §7.4 完整契约（+video_type/type_confidence，五类骨架，变更摘要 #15）；
   3) 下载后用 ffprobe 探时长；封面落到 public/covers/real/（群岛信息面板必显）；
   4) AI 分层各自独立 try/catch——上层失败不拖垮脉络（方案文档 §二 原则）。
   ================================================================ */
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { join, dirname, basename } from "node:path";
import {
  createAsset, updateAsset, getAsset, saveTranscript, saveAnalysis, saveExpansion,
  saveEchoes, upsertCollection, getCollectionRow, listRecallSources, getAssetsByGroup,
  getAnalysis, saveSynthesis, saveCollectionGapFill, saveCommentHeat,
  clearCollectionSynthesis, listCollections, listAssetsByCollection,
  isMappedRegionCategory, setCollectionSourceUrl,
  type SourceAsset, type BackboneNode, type StoredEcho, type RecallSource,
} from "./store";
import type { Synthesis, SynthesisPoint, CollectionGapFill, Echo } from "@/lib/data";
import {
  ANALYSIS_TEMPLATES, createArgumentDispatch, resolveAnalysisDispatch, withSemanticAnchors,
  type AnalysisDispatch, type AnalysisTemplate, type TemplateRenderData,
  type HistoryRenderData, type CompareRenderData, type DataRenderData,
  type ScenarioRenderData, type ScenarioDeform,
} from "@/lib/analysis-contract";
import { cleanVideoTitle } from "./title-utils.mjs";
import { planRecluster } from "./recluster-plan.mjs";
import { COMMENT_HEAT_NOTE, type CommentHeat } from "@/lib/reader/comment-heat";
import { ensureAssetEngagement } from "./engagement";

export { cleanVideoTitle } from "./title-utils.mjs";

const execFileAsync = promisify(execFile);

/* ---------- 环境：密钥在 eval/.env，单一来源，不复制进 web。
   CFG 取值文件优先（dev 模块热重载即可生效，不用重启服务器）；
   仍写回 process.env 供已有环境变量缺省时使用。 ---------- */
function loadEvalEnv(): Record<string, string> {
  const vals: Record<string, string> = {};
  try {
    const raw = readFileSync(join(process.cwd(), "..", "eval", ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith("#")) {
        const v = m[2].replace(/^["']|["']$/g, "");
        vals[m[1]] = v;
        if (!(m[1] in process.env)) process.env[m[1]] = v;
      }
    }
  } catch { /* 没有 eval/.env 就用系统环境变量 */ }
  return vals;
}
const fileEnv = loadEvalEnv();
const env = (key: string) => fileEnv[key] ?? process.env[key] ?? "";

const CFG = {
  ffmpeg: env("FFMPEG_PATH") || "ffmpeg",
  parseVideoApi: (env("PARSE_VIDEO_API_URL") || "http://localhost:8080").replace(/\/$/, ""),
  maxMb: Number(env("MAX_UPLOAD_MB") || 200),
  volcKey: env("VOLC_ASR_API_KEY"),
  volcAppKey: env("VOLC_ASR_APP_KEY"),
  volcAccessKey: env("VOLC_ASR_ACCESS_KEY"),
  deepseekKey: env("DEEPSEEK_API_KEY"),
  deepseekBase: (env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com").replace(/\/$/, ""),
  deepseekModel: env("DEEPSEEK_MODEL") || "deepseek-v4-flash",
};
const TMP = join(process.cwd(), ".tmp");
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- URL 识别（抖音黑客松：B站明确不支持） ---------- */
export function extractUrls(input: string): string[] {
  return String(input).match(/https?:\/\/[^\s，。、"'<>【】]+/g) || [];
}

export type Platform = "抖音" | "直链";

export function detectPlatform(url: string): Platform {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch {
    throw new Error("链接格式无法解析");
  }
  if (host === "b23.tv" || host.endsWith("bilibili.com"))
    throw new Error("B站暂不支持——本期只做抖音");
  if (host.endsWith("douyin.com") || host.endsWith("iesdouyin.com")) return "抖音";
  if (/\.(mp4|mov|m4v|webm|mp3|m4a|wav|aac)(\?|$)/i.test(url)) return "直链";
  throw new Error("无法识别平台（支持：抖音视频/合集、媒体直链）");
}

export async function resolveShortLink(url: string): Promise<string> {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return url; }
  if (host === "v.douyin.com" || host.endsWith("iesdouyin.com")) {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": IPHONE_UA },
      signal: AbortSignal.timeout(20000),
    });
    return res.url || url;
  }
  return url;
}

export function detectMixId(url: string): string | null {
  const m = url.match(/\/mix\/detail\/(\d+)/) || url.match(/\/collection\/(\d+)/);
  if (m) return m[1];
  try {
    const u = new URL(url);
    if (/mix/i.test(u.pathname)) {
      const oid = u.searchParams.get("object_id");
      if (oid) return oid;
    }
  } catch {}
  return null;
}

/* ---------- 管线各步（与 eval 同源） ---------- */
async function parseDouyin(url: string) {
  const endpoint = `${CFG.parseVideoApi}/video/share/url/parse?url=${encodeURIComponent(url)}`;
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
    } catch (e) {
      throw new Error(`parse-video 服务不可用（${(e as Error).message}）。确认 sidecar 已启动`);
    }
    if (res.status === 429) {
      if (attempt === MAX) throw new Error(`parse-video 持续 429（限流），已重试 ${MAX} 次`);
      await sleep(1500 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`parse-video 返回 ${res.status}`);
    const body = await res.json();
    if (typeof body.code === "number" && body.code !== 200 && body.code !== 0)
      throw new Error(`解析失败：${body.msg || `code ${body.code}`}`);
    const data = body.data || {};
    if (!data.video_url) {
      if (Array.isArray(data.images) && data.images.length)
        throw new Error("该链接是图集（无视频），不支持");
      throw new Error("解析结果无视频地址，链接可能已失效");
    }
    return {
      title: cleanVideoTitle(String(data.title || "")),
      author: String(data.author?.name || "").trim(),
      videoUrl: String(data.video_url),
      coverUrl: String(data.cover_url || ""),
    };
  }
  throw new Error("parse-video 解析失败");
}

/* 封面下载到 public/covers/real/（抖音封面是带签名的临期 URL，必须落本地）。
   网络波动最多重试 3 次；仍失败不阻塞管线——群岛面板缺封面用占位图。 */
async function downloadCover(coverUrl: string, assetId: string): Promise<string> {
  if (!coverUrl) return "";
  const dir = join(process.cwd(), "public", "covers", "real");
  await mkdir(dir, { recursive: true });
  const MAX = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(coverUrl, {
        headers: { "User-Agent": IPHONE_UA },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`封面下载失败（${res.status}）`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1024) throw new Error("封面文件太小");
      await writeFile(join(dir, `${assetId}.jpg`), buf);
      return `/covers/real/${assetId}.jpg`;
    } catch (e) {
      if (attempt >= MAX) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function downloadMedia(mediaUrl: string, destPath: string, headers: Record<string, string>) {
  const maxBytes = CFG.maxMb * 1024 * 1024;
  const res = await fetch(mediaUrl, { headers, signal: AbortSignal.timeout(900000) });
  if (!res.ok || !res.body) throw new Error(`下载失败（${res.status}）`);
  const cl = Number(res.headers.get("content-length") || 0);
  if (cl > maxBytes) throw new Error(`视频过大（${Math.round(cl / 1048576)}MB > ${CFG.maxMb}MB）`);
  const reader = res.body.getReader();
  const ws = createWriteStream(destPath);
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) { ws.destroy(); throw new Error(`视频过大（>${CFG.maxMb}MB）`); }
      if (!ws.write(value)) await once(ws, "drain");
    }
  } finally { ws.end(); }
  await once(ws, "finish");
  return bytes;
}

async function sniffVideo(filePath: string) {
  const { size } = await stat(filePath);
  const fh = await readFile(filePath);
  const head = fh.subarray(0, 12);
  const asText = head.toString("latin1").trim();
  if (asText.startsWith("<") || asText.startsWith("{"))
    throw new Error(`下载到的不是视频，是 HTML/JSON（${size} 字节，直链可能已失效）`);
  const isMp4 = head.subarray(4, 8).toString("latin1") === "ftyp";
  if (!isMp4 && size < 10240)
    throw new Error(`下载到的文件太小且不像视频（${size} 字节）`);
}

/* ffprobe 探时长 → "mm:ss"（gyan ffmpeg 构建同目录带 ffprobe）；探不到不阻塞管线 */
async function probeDuration(videoPath: string): Promise<string> {
  const ffprobe = CFG.ffmpeg === "ffmpeg"
    ? "ffprobe"
    : join(dirname(CFG.ffmpeg), basename(CFG.ffmpeg).replace(/ffmpeg/i, "ffprobe"));
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath,
    ]);
    const sec = Math.round(Number(stdout.trim()));
    if (!Number.isFinite(sec) || sec <= 0) return "";
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  } catch { return ""; }
}

async function extractAudio(videoPath: string): Promise<string> {
  await sniffVideo(videoPath);
  const mp3 = videoPath.replace(/\.[^.]+$/, ".asr.mp3");
  try {
    await execFileAsync(
      CFG.ffmpeg,
      ["-nostdin", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "48k", "-y", mp3],
      { maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (e) {
    const err = String((e as { stderr?: string; message?: string }).stderr || (e as Error).message || "");
    if (/does not contain any stream|Output file .* does not contain/i.test(err))
      throw new Error("这条视频没有音轨（可能是图集/无声视频），ASR 无从下手");
    if (/Invalid data found|moov atom not found|Invalid NAL/i.test(err))
      throw new Error("视频数据损坏/不完整（下载可能被截断或直链失效）");
    const lines = err.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    throw new Error(`ffmpeg 失败：${lines.slice(-3).join(" | ") || (e as Error).message}`);
  }
  return mp3;
}

async function transcribeVolc(mp3Path: string): Promise<string> {
  if (!CFG.volcKey && !(CFG.volcAppKey && CFG.volcAccessKey))
    throw new Error("火山 ASR 未配置：填 VOLC_ASR_API_KEY 或 VOLC_ASR_APP_KEY + VOLC_ASR_ACCESS_KEY");
  const audio = await readFile(mp3Path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": "volc.bigasr.auc_turbo",
    "X-Api-Request-Id": randomUUID(),
    "X-Api-Sequence": "-1",
  };
  if (CFG.volcKey) headers["X-Api-Key"] = CFG.volcKey;
  else { headers["X-Api-App-Key"] = CFG.volcAppKey; headers["X-Api-Access-Key"] = CFG.volcAccessKey; }

  const res = await fetch("https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash", {
    method: "POST",
    headers,
    body: JSON.stringify({
      user: { uid: "echoes-web" },
      audio: { format: "mp3", data: audio.toString("base64") },
      request: { model_name: "bigmodel", enable_punc: true, enable_itn: true },
    }),
    signal: AbortSignal.timeout(120000),
  });
  const statusCode = res.headers.get("x-api-status-code");
  if (!res.ok || statusCode !== "20000000") {
    const detail = res.headers.get("x-api-message") || (await res.text().catch(() => ""));
    throw new Error(`火山 ASR 失败（${statusCode ?? res.status}）：${detail}`.trim());
  }
  const data = await res.json();
  const text: string = data.result?.text?.trim() ?? "";
  if (!text) throw new Error("火山 ASR 返回空文本");
  return text;
}

/* ---------- AI 分析：PRD §7.4 完整契约（L1 瘦脉络 + L2 类型判定/骨架适配） ---------- */
export interface AnalysisResult {
  core_question: string;
  video_type: "argument" | "narrative" | "intro" | "compare" | "concept";
  type_confidence: number;
  summary: string;
  backbone: BackboneNode[];
  takeaways: string[];
}

const ANALYZE_SYS = `你是"回响"的内容理解引擎。把一条视频的转写文本重构成一条可导航的"瘦脉络"。只输出 JSON 对象，不要多余文字。

第一步，判定视频类型（五选一），并给出置信度：
- argument 论证类：围绕一个论点展开论证
- narrative 叙事类：讲一个故事/一段历史/一个人物的经历，且有一个贯穿全程的矛盾或赌注
- intro 介绍类：说明式的来龙去脉、成就罗列、清单式要点，没有贯穿的核心冲突
- compare 对比类：呈现两种以上立场/方案的分歧
- concept 概念类：解释一个概念/机制是什么

叙事类 vs 介绍类的分流检验：问"这个故事有没有一个贯穿全程的矛盾或赌注？"——有，归叙事类；没有，归介绍类。

第二步，严格按该类型的骨架组织脉络。骨架是硬约束：如果内容装不进所选骨架，说明第一步类型判错了，改判后重来；任何类型下都禁止退化成按时间顺序的纪要式摘要。
- argument: 核心论点 → 论据链 → 关键案例 → 结论
- narrative: 核心张力（这个故事真正的矛盾/赌注，不是背景交代）→ 转折点×2~4（每个回答"为何从X走向Y"，点出驱动力：人的动机/结构性约束/偶然事件）→ 收束（各条线如何汇成结局 + 这个故事回答了什么）
- intro: 前因 → 经过 → 结果 → 影响
- compare: 立场A → 立场B → 分歧点 → 各自依据
- concept: 定义 → 拆解 → 应用 → 边界

叙事类的额外硬约束：
- 节点 concept 用问题式/张力式命名（如"为何监管见死不救"），禁止纯名词标签和时间标签
- 相邻节点之间必须有因果或动机链条，"然后/随后"式的时间衔接=失败
- detail 写驱动逻辑（谁想要什么、什么约束了他、哪里失控了），只写转写文本里有依据的内容，不自行推断动机，不复述情节细节

输出字段：
- core_question: 这条视频在回答的核心问题（一句话）
- video_type: "argument" | "narrative" | "intro" | "compare" | "concept"
- type_confidence: 0~1 的小数，你对类型判定的把握
- summary: 30~60 字全局摘要
- backbone: 4~7 个概念节点（少于4或多于7都不行），数组顺序=一条脉络线；每个 {id, concept, role, detail, timestamp}
    · concept: ≤12字，用"它在回答什么问题"命名，不是名词标签
    · role: 该节点在所选骨架中的环节名，≤4字（如叙事类的"核心张力/转折点/收束"、论证类的"核心论点/论据/案例/结论"、概念类的"定义/拆解/应用/边界"）
    · detail: 2~4句，展开这个概念，纯结果不复述废话
    · timestamp: 如"5:30"，定位不到就空字符串
- takeaways: 1~3句"可判断/可表达"的要点
不要输出关联、立场、分类等其它字段。字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

export const VIDEO_TYPES: ReadonlySet<string> = new Set(["argument", "narrative", "intro", "compare", "concept"]);

/* DeepSeek 一次 JSON 调用（L1+L2 / L4 共用）：坏 JSON 时提取花括号兜底 */
async function callDeepseekJson<T>(system: string, user: string, temperature: number): Promise<T> {
  if (!CFG.deepseekKey) throw new Error("DeepSeek 未配置：填 DEEPSEEK_API_KEY");
  const res = await fetch(`${CFG.deepseekBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CFG.deepseekKey}` },
    body: JSON.stringify({
      model: CFG.deepseekModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok)
    throw new Error(`DeepSeek ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  try { return JSON.parse(content) as T; }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("DeepSeek 返回非 JSON");
    return JSON.parse(m[0]) as T;
  }
}

export async function analyzeTranscript(
  transcript: string,
  opts?: { lockType?: AnalysisResult["video_type"] },
): Promise<AnalysisResult> {
  // 类型锁定：重跑沿用已定类型，骨架换血但类型不漂移（rerun-analysis 默认走这里）
  const lock = opts?.lockType;
  const system = lock
    ? `${ANALYZE_SYS}\n\n附加约束（类型锁定）：这条视频的类型已在此前解析中定为「${lock}」。跳过第一步的类型判定，video_type 原样输出「${lock}」，直接按该类型的骨架组织脉络。`
    : ANALYZE_SYS;
  const attempt = async (): Promise<AnalysisResult> => {
    const parsed = await callDeepseekJson<AnalysisResult>(
      system,
      transcript.slice(0, 12000),
      0.3,
    );
    if (!Array.isArray(parsed.backbone) || parsed.backbone.length < 3)
      throw new Error(`脉络节点太少（${parsed.backbone?.length ?? 0}）`);
    // 类型非法不得静默回落介绍类（PRD §6.1.3 修正2），抛错走重试
    if (!VIDEO_TYPES.has(parsed.video_type))
      throw new Error(`类型非法（${parsed.video_type}）`);
    if (lock && parsed.video_type !== lock)
      throw new Error(`类型锁定失效（模型返回 ${parsed.video_type}，应为 ${lock}）`);
    parsed.backbone = withSemanticAnchors(parsed.backbone);
    parsed.type_confidence = Math.max(0, Math.min(1, Number(parsed.type_confidence) || 0));
    if (!Array.isArray(parsed.takeaways)) parsed.takeaways = [];
    return parsed;
  };

  // LLM 偶尔吐坏 JSON，重试一次（换一次采样通常就好了）
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/* ---------- L4 补缺 ---------- */
export interface ExpansionResult {
  /** 补缺·戳破：每条视频都要指出一块值得补充的外部背景（一句陈述）。 */
  gap: string;
  /** 补缺·补上：视频里没有的外部背景，与 gap 连读成一段。gap 空时同为空。 */
  fill: string;
  /** 补缺·去搜：2~3 个可直接拿去抖音搜的关键词。gap 空时同为空。 */
  searchTerms: string[];
}

const EXPAND_SYS = `你是"知音"的补缺引擎。基于一条视频的脉络分析结果，补上它承重却默认读者已会的背景。只输出 JSON 对象，不要多余文字。

补缺 → 输出 {gap, fill}（前端分两段呈现：gap 是点题引子、fill 是背景正文，中间换行，都不带任何小标题或提示词）：
- gap：一句自成一体的完整陈述句，必须以句号「。」收尾——不是问句，也不要用冒号或破折号把话头引向 fill。它戳破这条视频「踩着却没讲透」的那块承重地基：一个被结论依赖、但视频默认你已会的概念定义 / 被跳过的机制 / 只给结论没给出处的关键事实。
- fill：另起一段，2~3 句补上这块「视频里没有的」外部背景知识。语义上承接 gap，但自身是完整、独立成段的话，不重复 gap 已经说过的内容——gap 点出缺口，fill 只管把缺口填实。
- 护栏（必须遵守）：
  1. 只补公认、可查证的背景知识（历史事件、概念定义、机制原理这类），不生成需要立场判断的内容。
  2. fill 必须是视频里没有的内容：若 fill 说的东西能在下面 backbone/summary 里找到，就是穿帮的假补缺，判空。
  3. fill 是补背景的口气、不是拍板下结论：陈述公认事实，不评价视频观点。
- searchTerms：2~3 个可以直接拿去视频平台搜索的关键词，帮读者顺着这块地基自己往下搜。每个 2~10 字、名词性短语（像「通缩螺旋」「三国志 裴松之注」这种搜索框里的写法），不要问句、不要完整句子；围绕 gap/fill 讲的那块背景知识，彼此不重复。
- 每条视频都必须有补缺。若视频本身已经自洽，就选择一块最能帮助读者理解其前提、边界或语境的外部背景；不得把 gap、fill 留空，也不要虚构视频内容。

行文用中文标点；引用与强调一律用「」，不用英文引号或弯引号。输出：{"gap":"…","fill":"…","searchTerms":["…","…"]}。`;

export async function generateExpansion(a: AnalysisResult): Promise<ExpansionResult> {
  const input = JSON.stringify({
    core_question: a.core_question,
    video_type: a.video_type,
    summary: a.summary,
    backbone: a.backbone.map((n) => ({ concept: n.concept, detail: n.detail })),
    takeaways: a.takeaways,
  });

  const attempt = async (): Promise<ExpansionResult> => {
    // 补缺要稳定落在视频之外的背景知识，temperature 压到 0.3（脉络分析仍用 0.5）
    const parsed = await callDeepseekJson<Partial<ExpansionResult>>(EXPAND_SYS, input, 0.3);
    const gap = String(parsed.gap ?? "").trim();
    const fill = String(parsed.fill ?? "").trim();
    // 单条视频必须产出补缺；缺一项就让现有双次重试机制重新生成，不能静默落成空块。
    if (!gap || !fill) throw new Error("补缺为空");
    const searchTerms = (Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [])
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    return {
      gap,
      fill,
      searchTerms,
    };
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/* ---------- L4b 评论热度（mock）：单集页"大家在争论什么"块的内容感知模拟数据。
   不接平台真实评论（§8.3 数据边界），只是围绕这条视频实际内容虚构一份逼真的讨论热度，
   帮读者感知"这条视频可能引发什么争议"。独立 try/catch，生成失败不摆空壳。 ---------- */
const COMMENT_HEAT_SYS = `你是"知音"的评论热度模拟引擎。基于一条视频的脉络分析结果，虚构一份逼真的"评论区讨论热度"——不是真实抓取的评论，是围绕这条视频内容会被观众争论的话题。只输出 JSON 对象，不要多余文字。

任务：给出 4 个讨论主题，按你判断的热度从高到低排列。每个主题：
- label：柱下短标签，≤8字，如"化债能救吗"
- heat：0~100 的相对热度整数，4 个主题互相有区分度，不要挤在一起
- focus：这个主题的主要争议焦点，一句问句或陈述句，紧扣视频的核心问题/论据
- comment：一条代表性"网友评论"，口语化、像真人打字，不用书面语和敬语，≤50字，不出现具体人名/ID

护栏：
- 4 个主题都必须能追溯到这条视频实际讲的内容（core_question/summary/backbone），不得脱离视频内容凭空编造话题。
- 不生成人身攻击、违法违规或严重争议政治立场内容；讨论应聚焦视频本身的论点、方法、适用边界。
- 4 个 label 之间不能重复或过于相似。

只输出：{"topics":[{"label":"…","heat":90,"focus":"…","comment":"…"},...]}（恰好 4 条）`;

export async function generateCommentHeat(a: AnalysisResult, title: string): Promise<CommentHeat> {
  const input = JSON.stringify({
    title,
    core_question: a.core_question,
    summary: a.summary,
    backbone: a.backbone.map((n) => ({ concept: n.concept, detail: n.detail })),
    takeaways: a.takeaways,
  });

  const attempt = async (): Promise<CommentHeat> => {
    const parsed = await callDeepseekJson<{
      topics?: { label?: string; heat?: number; focus?: string; comment?: string }[];
    }>(COMMENT_HEAT_SYS, input, 0.6);
    const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .map((t) => ({
        label: String(t?.label ?? "").trim(),
        heat: Math.max(1, Math.min(100, Math.round(Number(t?.heat) || 0))),
        focus: String(t?.focus ?? "").trim(),
        comment: String(t?.comment ?? "").trim(),
      }))
      .filter((t) => t.label && t.focus && t.comment)
      .sort((x, y) => y.heat - x.heat);
    if (topics.length < 3) throw new Error(`评论热度主题太少（${topics.length}）`);
    return { note: COMMENT_HEAT_NOTE, topics: topics.slice(0, 4) };
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/* ---------- 模板派发：五渲染模板判定 + renderData 生成（知音_重构执行计划 Phase 1b）。
   与上面的 video_type（脉络骨架分类）是两条独立轴：video_type 决定脉络怎么组织，
   这里决定脉络"用哪张图渲染"。硬字段不全一律退回论证类，交给 resolveAnalysisDispatch 兜底。 ---------- */
const TEMPLATE_SYS = `你是"知音"的模板派发引擎。输入一条视频已经生成的脉络分析（core_question/summary/backbone）与转写原文片段。任务：判断这条视频的内容最适合用五种渲染模板中的哪一种呈现，并把对应的结构化数据整理出来。只输出 JSON 对象，不要多余文字。

这是一个和"脉络怎么组织"完全无关的独立判断，只看内容本身能不能撑起某个模板的硬字段——尤其注意转写原文里出现的具体数字、年份、多方对照、反事实假设，backbone 摘要可能把这些细节压缩掉了，判断时以转写原文为准，不要因为找不到现成结论就轻易放弃。

五种模板与硬字段门槛（门槛不满足就必须选 argument，不得勉强凑数）：
- argument 论证类（默认/安全项）：已有脉络节点本身就够用，不需要另外的结构化数据。任何拿不准的情况都选这个。
- history 历史类（时间轴）：内容是一段跨时间的演进，至少能从转写原文里找到 ≥3 个带明确年份/时间点的节点（如"1950""2006–12"）。年份必须是原文出现过的真实年份，不得推算或编造。
- compare 对比类（双行对照表）：内容明确呈现 ≥2 个可比较对象（立场/方案/流派），且能在 ≥2 个共同维度上逐一对照，最后一列给"结论"。只是提到多个例子但没有逐维度对照的，不算。
- data 数据类（横向柱状图）：内容的核心是可视化的量化对比（份额/占比/规模等 ≥2 项数值），且这些数值必须原文/转写里明确给出，不能是你替视频算出来的估计值。
- scenario 条件推演类（史实↔反事实沙盘）：内容明确讨论过"如果 XX 没有/换一种方式发生，会怎样"这种反事实假设（视频里真的说了，不是你自己联想的），且能拆出真实发生的 off 分支（≥1 步）与反事实推演的 on 分支（≥1 步）。这是幻觉风险最高的模板，拿不准就退回 argument。

判定优先级（内容同时够得上多个模板时）：history > data > compare > scenario > argument（沙盘最难判、幻觉风险最高，放最后）。

输出字段：
- template: "argument" | "history" | "compare" | "data" | "scenario"
- confidence: 0~1，你对这个判定的把握
- reason: ≤40字，选择这个模板/退回论证类的理由

若 template 不是 argument，额外按所选模板给出以下字段之一（其余留空）：

"history": { "events": [{"year":"…","short":"≤6字时间轴简称","role":"≤4字环节名（如前因/经过/影响）","title":"≤16字","detail":"2~4句","sourceNodeIndex": 对应 backbone 下标，没有就不给}], "defaultIndex": 默认展开第几项（0起，可省略） }

"compare": { "dimensions": ["维度1","维度2",...,"结论"], "rows": [{"label":"对象名","sub":"补充标注，可省略","cells":["维度1的值",...,"结论"]}], "verdictLead":"引导词如"视频结论"", "verdict":"1~2句" }

"data": { "chartTitle":"图表标题", "unit":"口径注记，如"单位 % · 视频论述口径"", "bars": [{"label":"≤8字","sub":"补充标注，可省略","value":"展示值如"≥90"","unit":"%","pct":0~100的条宽,"sourceNodeIndex": 若这根柱子最贴合某个 backbone 节点就给下标}] }

"scenario": { "condition":"可调节条件的问句", "offState":"关（史实）状态文案，如"否（史实）"", "onState":"开（反事实）状态文案，如"是（反事实）"", "premise": {"title":"≤16字","detail":"2~4句","sourceNodeIndex": 可省略}, "off": [{"tag":"≤6字如"转折 · 已发生"","title":"≤16字","detail":"2~4句"}], "on": [{"deform":"shift|broken|fork","tag":"≤6字如"转变 · 内容改写"","title":"≤16字","detail":"2~4句"}] }

铁律：
- 一切数字、年份、反事实假设都必须能在转写原文或已给的 backbone 里找到依据，不得为了凑模板编造内容。
- 找不到足够依据凑满硬字段门槛，一律输出 template:"argument"，其余模板字段全部省略。
- 行文用中文标点，引用与强调用「」，禁止出现"视频1""视频2"这类指称。字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

interface TemplateClassification {
  template?: string;
  confidence?: number;
  reason?: string;
  history?: {
    events?: { year?: string; short?: string; role?: string; title?: string; detail?: string; sourceNodeIndex?: number }[];
    defaultIndex?: number;
  };
  compare?: {
    dimensions?: string[];
    rows?: { label?: string; sub?: string; cells?: (string | null)[] }[];
    verdictLead?: string;
    verdict?: string;
  };
  data?: {
    chartTitle?: string;
    unit?: string;
    bars?: { label?: string; sub?: string; value?: string; unit?: string; pct?: number; sourceNodeIndex?: number }[];
  };
  scenario?: {
    condition?: string;
    offState?: string;
    onState?: string;
    premise?: { title?: string; detail?: string; sourceNodeIndex?: number };
    off?: { tag?: string; title?: string; detail?: string }[];
    on?: { deform?: string; tag?: string; title?: string; detail?: string }[];
  };
}

const clampConfidence = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));

/** 五模板判定 + renderData 生成（对已有 backbone 的既存/重跑视频用）。
    echoes 按 nodeIndex 挂回对应模板元素（history 逐条 / data·scenario 各一处），
    模板与 renderData 不全一律退回论证类，绝不半成品上线。 */
export async function classifyTemplate(
  a: AnalysisResult,
  echoes: StoredEcho[],
  transcript: string,
  title: string,
): Promise<AnalysisDispatch> {
  const echoByNode = new Map(echoes.map((e) => [e.nodeIndex, e]));
  const echoOf = (idx: unknown): Echo | undefined => {
    const i = Number(idx);
    if (!Number.isInteger(i)) return undefined;
    const e = echoByNode.get(i);
    if (!e) return undefined;
    const { nodeIndex: _n, sourceAnchorId: _s, targetAnchorId: _t, reciprocal: _r, ...echo } = e;
    return echo;
  };

  const fallback = () => createArgumentDispatch({
    coreQuestion: a.core_question,
    summary: a.summary,
    nodes: a.backbone,
    takeaways: a.takeaways,
    confidence: a.type_confidence,
    reason: "template-classify-fallback",
  });

  const input = JSON.stringify({
    title,
    core_question: a.core_question,
    summary: a.summary,
    backbone: a.backbone.map((n, i) => ({
      index: i, concept: n.concept, role: n.role, detail: n.detail, timestamp: n.timestamp,
    })),
    transcript_excerpt: transcript.slice(0, 6000),
  });

  const attempt = async (): Promise<AnalysisDispatch> => {
    const parsed = await callDeepseekJson<TemplateClassification>(TEMPLATE_SYS, input, 0.3);
    const template = (ANALYSIS_TEMPLATES as readonly string[]).includes(String(parsed.template))
      ? (parsed.template as AnalysisTemplate)
      : "argument";
    if (template === "argument") return fallback();
    const confidence = clampConfidence(parsed.confidence);
    const reason = String(parsed.reason ?? "").trim() || "template-classify";

    let renderData: TemplateRenderData | null = null;

    if (template === "history") {
      const events: HistoryRenderData["events"] = (parsed.history?.events ?? [])
        .map((e) => ({
          year: String(e?.year ?? "").trim(),
          short: String(e?.short ?? "").trim(),
          role: String(e?.role ?? "").trim(),
          title: String(e?.title ?? "").trim(),
          detail: String(e?.detail ?? "").trim(),
          ...(echoOf(e?.sourceNodeIndex) ? { echo: echoOf(e?.sourceNodeIndex) } : {}),
        }))
        .filter((e) => e.year && e.short && e.title && e.detail);
      if (events.length >= 3) {
        renderData = {
          coreQuestion: a.core_question,
          events,
          ...(typeof parsed.history?.defaultIndex === "number" ? { defaultIndex: parsed.history.defaultIndex } : {}),
        };
      }
    } else if (template === "compare") {
      const dimensions = (parsed.compare?.dimensions ?? []).map((d) => String(d ?? "").trim()).filter(Boolean);
      const rows: CompareRenderData["rows"] = (parsed.compare?.rows ?? [])
        .map((r) => ({
          label: String(r?.label ?? "").trim(),
          ...(r?.sub ? { sub: String(r.sub).trim() } : {}),
          cells: dimensions.map((_, di) => {
            const v = Array.isArray(r?.cells) ? r.cells[di] : null;
            return v == null ? null : String(v).trim() || null;
          }),
        }))
        .filter((r) => r.label);
      if (dimensions.length >= 2 && rows.length >= 2) {
        renderData = {
          coreQuestion: a.core_question,
          dimensions,
          rows,
          verdictLead: String(parsed.compare?.verdictLead ?? "").trim() || "视频结论",
          verdict: String(parsed.compare?.verdict ?? "").trim(),
        };
      }
    } else if (template === "data") {
      const rawBars = parsed.data?.bars ?? [];
      let echoBarIndex = -1;
      let primaryEcho: Echo | undefined;
      rawBars.forEach((b, i) => {
        if (primaryEcho) return;
        const e = echoOf(b?.sourceNodeIndex);
        if (e) { primaryEcho = e; echoBarIndex = i; }
      });
      const bars: DataRenderData["bars"] = rawBars
        .map((b, i) => ({
          label: String(b?.label ?? "").trim(),
          ...(b?.sub ? { sub: String(b.sub).trim() } : {}),
          value: String(b?.value ?? "").trim(),
          ...(b?.unit ? { unit: String(b.unit).trim() } : {}),
          pct: Math.max(0, Math.min(100, Number(b?.pct) || 0)),
          kind: (i === echoBarIndex ? "echo" : i === 0 ? "primary" : "sub") as "primary" | "sub" | "echo",
        }))
        .filter((b) => b.label && b.value);
      if (bars.length >= 2) {
        renderData = {
          coreQuestion: a.core_question,
          chartTitle: String(parsed.data?.chartTitle ?? "").trim() || a.core_question,
          unit: String(parsed.data?.unit ?? "").trim(),
          bars,
          ...(primaryEcho ? { echo: primaryEcho } : {}),
        };
      }
    } else if (template === "scenario") {
      const premiseRaw = parsed.scenario?.premise;
      const premiseEcho = echoOf(premiseRaw?.sourceNodeIndex);
      const premiseTitle = String(premiseRaw?.title ?? "").trim();
      const premiseDetail = String(premiseRaw?.detail ?? "").trim();
      const premise = premiseTitle && premiseDetail
        ? {
            deform: "none" as ScenarioDeform,
            tag: "前提 · 恒定",
            title: premiseTitle,
            detail: premiseDetail,
            ...(premiseEcho ? { echo: premiseEcho } : {}),
          }
        : null;
      const off = (parsed.scenario?.off ?? [])
        .map((s) => ({
          deform: "none" as ScenarioDeform,
          tag: String(s?.tag ?? "").trim() || "已发生",
          title: String(s?.title ?? "").trim(),
          detail: String(s?.detail ?? "").trim(),
        }))
        .filter((s) => s.title && s.detail);
      const DEFORMS = new Set(["none", "shift", "broken", "fork"]);
      const on = (parsed.scenario?.on ?? [])
        .map((s) => ({
          deform: (DEFORMS.has(String(s?.deform)) ? String(s?.deform) : "shift") as ScenarioDeform,
          tag: String(s?.tag ?? "").trim() || "推演",
          title: String(s?.title ?? "").trim(),
          detail: String(s?.detail ?? "").trim(),
        }))
        .filter((s) => s.title && s.detail);
      if (premise && off.length >= 1 && on.length >= 1) {
        renderData = {
          coreQuestion: a.core_question,
          condition: String(parsed.scenario?.condition ?? "").trim(),
          offState: String(parsed.scenario?.offState ?? "").trim() || "否（史实）",
          onState: String(parsed.scenario?.onState ?? "").trim() || "是（反事实）",
          premise,
          off,
          on,
        };
      }
    }

    if (!renderData) return fallback();
    return resolveAnalysisDispatch({
      template,
      confidence,
      downgrade: { template: "argument", reason },
      renderData,
    });
  };

  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch { /* 换一次采样重试 */ }
  }
  return fallback();
}

/* ---------- L3 大类归属（方案文档 §二 L3：喂 L1 结构化摘要，temperature 0 保稳定） ---------- */
export type CategoryId = "eco" | "his" | "tech" | "soc" | "sci";
const CATEGORY_IDS: ReadonlySet<string> = new Set(["eco", "his", "tech", "soc", "sci"]);

/** 各大类"散篇"合集：单条/多链接解析的视频落这里（mix 合集自成一组）。 */
export const MISC_COLLECTION: Record<CategoryId, { id: string; name: string }> = {
  eco: { id: "misc-eco", name: "经济 · 散篇集" },
  his: { id: "misc-his", name: "历史 · 散篇集" },
  tech: { id: "misc-tech", name: "科技 · 散篇集" },
  soc: { id: "misc-soc", name: "社会思想 · 散篇集" },
  sci: { id: "misc-sci", name: "自然科学 · 散篇集" },
};

const CLASSIFY_SYS = `你是"回响"的内容归类引擎。把一条视频归入五大类之一：
- eco 经济：市场、货币、产业、政策、商业与资本
- his 历史：史实、人物、朝代、事件与史观叙事
- tech 科技：人类创造和应用的工具、工程、产品、制造与科技产业
- soc 社会思想：社会学、政治、法律、教育、性别、公共议题、制度与群体关系
- sci 自然科学：数学、物理、化学、生物、天文、地理、生态、疾病机理与自然规律

判定依据按固定优先级依次比较（保证同一内容重复判定不跳类）：
①核心问题在问什么 ②结论落点落在哪 ③主要篇幅讲什么 ④标题与简介。
当 tech 与 sci 冲突时，以最终知识落点判定：解释“世界或生命为什么这样运作、规律是什么”归 sci；解释“工具如何设计、制造、使用或产业化”归 tech。疾病机理归 sci，诊断设备、治疗技术和制药工程归 tech；AI 的纯数学原理归 sci，模型架构、训练工程、芯片和产品归 tech。
看"用户获得的知识类型"而非表面关键词：讲 AI 发展史、落点在技术演进的归 tech；讲 AI 对就业结构与劳动关系的影响、落点在制度和群体关系的归 soc；讲疾病机理、生态系统或自然规律的归 sci；讲雷曼崩盘、落点在金融机制的归 eco，即使满篇是"历史"。
确实不属于五类的输出 "none"，不要硬塞进最接近的类。

只输出 JSON：{"primary":"eco|his|tech|soc|sci|none","secondary":"eco|his|tech|soc|sci|none","confidence":"high|mid|low","rationale":"≤50字"}`;

export async function classifyCategory(a: AnalysisResult, title: string): Promise<CategoryId | null> {
  const input = JSON.stringify({
    title,
    core_question: a.core_question,
    summary: a.summary,
    backbone: a.backbone.map((n) => n.concept),
    takeaways: a.takeaways,
  });
  const parsed = await callDeepseekJson<{ primary?: string }>(CLASSIFY_SYS, input, 0);
  const primary = String(parsed.primary ?? "").trim();
  return CATEGORY_IDS.has(primary) ? (primary as CategoryId) : null;
}

/* ---------- 散篇集聚类：每批解析收尾自动触发，/api/recluster 手动兜底。
   散篇 ≥3 条聚新簇（id 前缀 tc-），或单条加入已有 tc- 合集；
   抖音 mix 合集是创作者策展的，不接收散篇；tc- 合集只增员，永不解散改名。 ---------- */
const CLUSTER_SYS = `你是"回响"的合集聚类引擎。输入某大类"散篇集"里的视频（misc，含 id/title/core_question），和该大类已有的主题合集（existing，含 id/name/titles）。任务：
1. 把与某个 existing 合集主题明确一致的散篇归入该合集（宁缺毋滥，必须具体主题吻合，不是同属大类就归）；
2. 剩余散篇里主题相近的 ≥3 条聚成新合集，起 ≤12 字中文名，名字必须是具体主题（如"美元霸权与去美元化"），不许是大类复述（如"经济知识"）；
3. 拿不准的一律留在散篇集，不强行归簇。
只输出 JSON：{"assign":[{"videoId":"…","collectionId":"…"}],"clusters":[{"name":"…","ids":["…"]}]}，没有就输出空数组。`;

export interface ReclusterResult {
  category: CategoryId;
  remainingMisc: number;
  assigned: { videoId: string; collectionId: string; collectionName: string }[];
  created: { collectionId: string; name: string; ids: string[] }[];
}

export async function reclusterMisc(cat: CategoryId, dryRun = false): Promise<ReclusterResult> {
  const miscAssets = listAssetsByCollection(MISC_COLLECTION[cat].id);
  const existing = listCollections(cat).filter((c) => c.id.startsWith("tc-"));
  const result: ReclusterResult = {
    category: cat, remainingMisc: miscAssets.length, assigned: [], created: [],
  };
  // 社会思想、自然科学等没有区域地图，只能作为未知海域中的视频岛屿，
  // 手动重聚类接口也不得把它们重新写回独立合集。
  if (!isMappedRegionCategory(cat)) return result;
  // 不够成簇也没有可加入的合集：省一次调用
  if (!miscAssets.length || (miscAssets.length < 3 && !existing.length)) return result;

  const misc = miscAssets.map((a) => ({
    id: a.id,
    title: a.title || "未命名视频",
    core_question: getAnalysis(a.id)?.coreQuestion ?? "",
  }));
  const existingInput = existing.map((c) => ({
    id: c.id,
    name: c.name,
    titles: listAssetsByCollection(c.id).slice(0, 5).map((a) => a.title),
  }));
  const parsed = await callDeepseekJson<{
    assign?: { videoId?: string; collectionId?: string }[];
    clusters?: { name?: string; ids?: string[] }[];
  }>(CLUSTER_SYS, JSON.stringify({ existing: existingInput, misc }), 0);

  // 纯规划层核对提议（一条只动一次 / 新簇≥3 / 重名并入不建孪生），护栏见 recluster-plan.mjs
  const plan = planRecluster(parsed, misc.map((m) => m.id), existing);
  const existingById = new Map(existing.map((c) => [c.id, c]));
  const touched: string[] = []; // 增员/新建的合集，收尾重跑 L6 合成

  for (const it of plan.assigned) {
    const col = existingById.get(it.collectionId)!;
    result.assigned.push({ videoId: it.videoId, collectionId: col.id, collectionName: col.name });
    if (!dryRun) {
      updateAsset(it.videoId, { collectionId: col.id });
      if (!touched.includes(col.id)) touched.push(col.id);
    }
  }
  for (const cl of plan.created) {
    const colId = `tc-${randomUUID().slice(0, 8)}`;
    result.created.push({ collectionId: colId, name: cl.name, ids: cl.ids });
    if (!dryRun) {
      upsertCollection(colId, cl.name, cat);
      for (const id of cl.ids) updateAsset(id, { collectionId: colId });
      touched.push(colId);
    }
  }
  const moved = plan.assigned.length + plan.created.reduce((n, c) => n + c.ids.length, 0);
  result.remainingMisc = miscAssets.length - moved;

  for (const colId of touched) {
    try { await resynthesizeCollection(colId); }
    catch { /* 无合成：合集解析页走"关联不够多"兜底，归属不回滚 */ }
  }
  // 散篇集自己减员了也要刷新 L6——旧合成引用已搬走的视频。刷新失败时清掉陈旧产物：
  // 增员合集失败保旧（旧合成仍指向在册成员），减员合集失败必须清（宁缺毋滥）。
  if (!dryRun && moved > 0) {
    const miscId = MISC_COLLECTION[cat].id;
    try { await resynthesizeCollection(miscId); }
    catch { clearCollectionSynthesis(miscId); }
  }
  return result;
}

/** 按合集当前成员重跑 L6 合成 + 补缺（聚类增员后刷新用，人工「移动」也复用）。 */
export async function resynthesizeCollection(collectionId: string): Promise<void> {
  const videos: SynthesisInputVideo[] = [];
  for (const a of listAssetsByCollection(collectionId)) {
    const an = getAnalysis(a.id);
    if (!an) continue;
    videos.push({
      id: a.id,
      title: a.title || "未命名视频",
      analysis: {
        core_question: an.coreQuestion,
        video_type: an.videoType as AnalysisResult["video_type"],
        type_confidence: an.typeConfidence,
        summary: an.summary,
        backbone: an.backbone,
        takeaways: an.takeaways,
      },
    });
  }
  if (videos.length < 2) { clearCollectionSynthesis(collectionId); return; } // 不足以合成，旧产物一并作废
  const synthesis = await generateSynthesis(videos);
  saveSynthesis(collectionId, synthesis);
  try { await runCollectionGapFill(collectionId, videos, synthesis.seriesQuestion); }
  catch { /* 无合集补缺 */ }
}

/* ---------- L5 回响：召回层（字符 bigram 重合）→ 一次 LLM 复核 ---------- */
function bigramsOf(text: string): Set<string> {
  const clean = text.replace(/[^一-鿿A-Za-z0-9]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
  return out;
}

interface LinkCandidate {
  id: string; // 语义锚点 id
  assetId: string;
  title: string;
  creator: string;
  concept: string;
  detail: string;
  timestamp: string;
  score: number;
}

/** 新视频整条脉络 vs 历史每个节点：共享 bigram 计数，过阈值的取前 12 个。 */
function recallCandidates(a: AnalysisResult, sources: RecallSource[]): LinkCandidate[] {
  const newGrams = a.backbone.map((n) => bigramsOf(`${n.concept}${n.detail}`));
  const scored: LinkCandidate[] = [];
  for (const src of sources) {
    src.backbone.forEach((node, i) => {
      const grams = bigramsOf(`${node.concept}${node.detail}`);
      let best = 0;
      for (const ng of newGrams) {
        let shared = 0;
        for (const g of grams) if (ng.has(g)) shared++;
        if (shared > best) best = shared;
      }
      if (best >= 4) {
        scored.push({
          id: node.anchorId,
          assetId: src.assetId,
          title: src.title,
          creator: src.author,
          concept: node.concept,
          detail: node.detail,
          timestamp: node.timestamp,
          score: best,
        });
      }
    });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, 12);
}

const LINK_SYS = `你是"知音"的关联匹配引擎。输入：一条新视频的脉络节点（nodes，含 anchor_id），和用户看过的旧视频里初筛出的候选节点（candidates，含 anchor_id）。找出真正构成点对点关系的候选。每条 {"source_anchor_id":"…","target_anchor_id":"…","relation":"…","old_say":"…","node_focus":"…"}：
- relation：关系定性，2~8个字，如「互相印证」「唱反调」「历史先例」
- old_say：旧视频（候选）的说法，≤36字，必须对着命中节点的 detail 写成"接话"——同一论点、同一量级，上下一读就看出异同；直接说内容，不写「旧视频」「你看过的」这类指称。句中用【】括出与节点叙述分歧/呼应的焦点短语（一处，≤10字）
- node_focus：从命中节点 detail 里逐字摘出与该焦点对应的原文短语（≤12字，必须是 detail 的连续子串；摘不出就给空字符串，不要改写）
- 铁律：宁缺毋滥。只是话题相近不算关系，把握不足就不出；最多 3 条；同一个 source_anchor_id 最多挂 1 条
- 关系必须落在同一个具体对象上（同一事件/人物/机制/作品）。只是结构相似、道理相通的跨题材类比不算关系；「历史先例」必须是真实历史对真实历史，不是"像这么回事"
- 虚构作品的剧情叙述（电影/剧集/小说解说）与现实知识内容之间不构成回响，除非两条视频谈的是同一部作品或同一段史实

没有就给空数组。行文用中文标点，引用用「」。只输出 JSON：{"echoes":[…]}`;

export interface LinkResult {
  echoes: StoredEcho[];
}

export async function generateLinks(
  a: AnalysisResult,
  title: string,
  sources: RecallSource[],
): Promise<LinkResult> {
  const candidates = recallCandidates(a, sources);
  if (!candidates.length) return { echoes: [] };
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const input = JSON.stringify({
    new_video: {
      title,
      core_question: a.core_question,
      nodes: a.backbone.map((n) => ({ anchor_id: n.anchorId, concept: n.concept, detail: n.detail })),
    },
    candidates: candidates.map(({ id, title: t, concept, detail }) => ({ anchor_id: id, from_title: t, concept, detail })),
  });
  const parsed = await callDeepseekJson<{
    echoes?: { source_anchor_id?: string; target_anchor_id?: string; relation?: string; old_say?: string; node_focus?: string }[];
  }>(LINK_SYS, input, 0.3);

  const nodeByAnchor = new Map(a.backbone.map((node, index) => [node.anchorId, { node, index }]));
  const usedNodes = new Set<string>();
  const echoes: StoredEcho[] = [];
  for (const e of Array.isArray(parsed.echoes) ? parsed.echoes : []) {
    const sourceAnchorId = String(e.source_anchor_id ?? "");
    const c = byId.get(String(e.target_anchor_id ?? ""));
    const source = nodeByAnchor.get(sourceAnchorId);
    const idx = source?.index ?? -1;
    const relation = String(e.relation ?? "").trim();
    const rawOldSay = String(e.old_say ?? "").trim();
    if (!c || !relation || !rawOldSay) continue;
    if (!source || usedNodes.has(sourceAnchorId)) continue;
    usedNodes.add(sourceAnchorId);
    // 焦点荧光两侧都要校验：旧句焦点从【】里取，节点侧必须逐字出自 detail，配不上就不划
    const focusMatch = rawOldSay.match(/【([^【】]{1,20})】/);
    const oldSay = rawOldSay.replace(/[【】]/g, "");
    const nodeFocusRaw = String(e.node_focus ?? "").trim();
    const nodeFocus = nodeFocusRaw && a.backbone[idx].detail.includes(nodeFocusRaw) ? nodeFocusRaw : "";
    echoes.push({
      nodeIndex: idx,
      sourceAnchorId,
      targetAnchorId: c.id,
      targetTitle: c.title,
      targetVideoId: c.assetId,
      creator: c.creator,
      timestampText: c.timestamp,
      relation,
      oldSay,
      oldFocus: focusMatch ? focusMatch[1] : undefined,
      nodeFocus: nodeFocus || undefined,
    });
    if (echoes.length >= 3) break;
  }
  return { echoes };
}

/* ---------- L5b 反向回响：新视频回响命中旧视频的节点后，把这条关系反着也写回
   旧视频的命中节点，两边互见（相互回响）。旧节点已有回响时不覆盖（一节点一条、
   宁缺毋滥），所以重复跑幂等。 ---------- */

/** 反查正向回响命中的旧节点：时间戳精确匹配优先；旧脉络重跑过时间戳会漂移，
    退回用 oldSay（本来就是照着旧节点写的接话）与各节点做 bigram 重合，取过阈值的最佳者。 */
function locateEchoedNode(backbone: BackboneNode[], echo: StoredEcho): number {
  if (echo.targetAnchorId) {
    const anchored = backbone.findIndex((n) => n.anchorId === echo.targetAnchorId);
    if (anchored >= 0) return anchored;
  }
  if (echo.timestampText) {
    const j = backbone.findIndex((n) => n.timestamp === echo.timestampText);
    if (j >= 0) return j;
  }
  const grams = bigramsOf(echo.oldSay || echo.sentence || "");
  let best = -1;
  let bestScore = 3; // 只认 ≥4 个共享 bigram，同召回层阈值
  backbone.forEach((n, i) => {
    const ng = bigramsOf(`${n.concept}${n.detail}`);
    let shared = 0;
    for (const g of grams) if (ng.has(g)) shared++;
    if (shared > bestScore) { bestScore = shared; best = i; }
  });
  return best;
}
const RECIPROCAL_SYS = `你是"回响"的关联匹配引擎。旧视频 B 的一个脉络节点，被后来解析的新视频 A 的某个节点回响命中（关系与两侧原文见输入）。现在要在 B 的节点正下方展示这条关系的反向版本：B 的节点叙述是本方，A 的说法排在下面接话，两段上下对照读。只输出 JSON：{"relation":"…","other_say":"…","node_focus":"…"}：
- relation：站在 B 的视角重新定性这条关系，2~8个字。对称关系（如「互相印证」「唱反调」）保持原词；有方向的要反转（如原「历史先例」反过来可写「后来呼应」）
- other_say：新视频 A 的说法，≤36字，必须对着 B 节点的 detail 写成"接话"——同一论点、同一量级，上下一读就看出异同；直接说内容，不写「新视频」「后来的」这类指称。句中用【】括出与 B 节点叙述分歧/呼应的焦点短语（一处，≤10字）
- node_focus：从 B 节点 detail 里逐字摘出与该焦点对应的原文短语（≤12字，必须是 detail 的连续子串；摘不出就给空字符串，不要改写）
行文用中文标点，引用用「」。`;

export async function addReciprocalEchoes(newAssetId: string, echoes: StoredEcho[]): Promise<number> {
  const newAsset = getAsset(newAssetId);
  const newAnalysis = getAnalysis(newAssetId);
  if (!newAsset || !newAnalysis) return 0;
  let added = 0;
  for (const echo of echoes) {
    if (echo.reciprocal) continue; // 反向条目不再生反向，防止来回弹
    if (!echo.targetVideoId) continue;
    const target = getAnalysis(echo.targetVideoId);
    if (!target) continue;
    const j = locateEchoedNode(target.backbone, echo);
    if (j < 0) continue;
    if ((target.echoes ?? []).some((e) => e.nodeIndex === j)) continue;
    const newNode = newAnalysis.backbone[echo.nodeIndex];
    if (!newNode) continue;
    try {
      const parsed = await callDeepseekJson<{ relation?: string; other_say?: string; node_focus?: string }>(
        RECIPROCAL_SYS,
        JSON.stringify({
          relation: echo.relation,
          b_node: { concept: target.backbone[j].concept, detail: target.backbone[j].detail },
          a_title: newAsset.title,
          a_node: { concept: newNode.concept, detail: newNode.detail },
        }),
        0.3,
      );
      const rawSay = String(parsed.other_say ?? "").trim();
      if (!rawSay) continue;
      const focusMatch = rawSay.match(/【([^【】]{1,20})】/);
      const nodeFocusRaw = String(parsed.node_focus ?? "").trim();
      const nodeFocus = nodeFocusRaw && target.backbone[j].detail.includes(nodeFocusRaw) ? nodeFocusRaw : "";
      saveEchoes(echo.targetVideoId, [
        ...(target.echoes ?? []),
        {
          nodeIndex: j,
          sourceAnchorId: target.backbone[j].anchorId,
          targetAnchorId: newNode.anchorId,
          targetTitle: newAsset.title,
          targetVideoId: newAssetId,
          creator: newAsset.author,
          timestampText: newNode.timestamp,
          relation: String(parsed.relation ?? "").trim() || echo.relation,
          oldSay: rawSay.replace(/[【】]/g, ""),
          oldFocus: focusMatch ? focusMatch[1] : undefined,
          nodeFocus: nodeFocus || undefined,
          reciprocal: true,
        },
      ]);
      added++;
    } catch { /* 单条失败跳过，不拖垮其余 */ }
  }
  return added;
}


/* ---------- L6 合集合成：整组视频的脉络 → 跨视频知识点（PRD §6.4.2）。
   与"回响"分工：回响是点对点两句接话；合成是把整组视频摊在一张桌上，
   找出它们共同回答的问题、以及彼此印证/对撞/补充的知识点。收尾时一次生成。 ---------- */
export interface SynthesisInputVideo {
  id: string;
  title: string;
  analysis: AnalysisResult;
}

const SYNTHESIS_SYS = `你是"回响"的合集合成引擎。输入是同一个合集里的多条视频（videos，每条含 id/title/核心问题/类型/脉络节点）。把它们摊在一张桌上比较，产出这组视频"合起来在说什么"。只输出 JSON 对象，不要多余文字。

一、series_question：一句话，这组视频共同回答的那个大问题（不是某一条的核心问题，是它们交汇处的问题）。

二、points：2~4 个跨视频知识点，每个是"多条视频在同一件事上的关系"，不是单条视频的摘要。每条 {label, relation, stance?, note, sources}：
- label：这个知识点要回答的问题/命题，一句话，≤24字。
- relation：从下面 6 种固定关系里选**最贴切的一个**，原样输出这四个字，不要自创或改写措辞。每种关系各自绑定一串固定的"要点档位"（facets 的 lead 只能从这里按序取词）：
    · 互相印证：多条视频各自得出同一结论，彼此加强。档位：共识 → 佐证（可重复）
    · 拼图互补：各讲一块，合起来才拼出完整图景。档位：侧面（可重复）→ 合观
    · 层层递进：一条是另一条的前提/上游，顺着往下推。档位：前提 → 推进 → 落点
    · 正面对撞：结论相反、直接分歧（这类必须给 stance）。档位：正方 → 反方 → 争点
    · 纠偏戳破：一条修正另一条、或戳破一个常识误区。档位：误区 → 纠偏 → 实情
    · 理论案例：一条讲机制/原理，另一条给现实实例。档位：原理 → 实例（可重复）
- stance：仅当 relation 是「正面对撞」时给出，是立场统计数组，每项 {tag, text}：tag 取 "a"|"b"|"c" 三档，text 如"✔ 2 认同"/"＋1 补充"/"✗ 1 反对"。其它关系不要 stance 字段。
- facets：把这个点拆成 2~4 个要点，每项 {lead, label, detail, focus, source_ids}，是一串可展开的节点（收起看标题、点开看正文），不是一整段：
    · lead：这一点的**档位标签**，必须从该 relation 对应的"要点档位"里按序原样取词，**≤4字**。禁止自创、也禁止用视频内容改写成就事论事的短语（如把正面对撞写成"能压的""压不住的"是错的，应写"正方""反方"）。同一档位可重复（如多条佐证都标"佐证"）。
    · label：这个要点的概念标题，**≤14字**，用"它在说什么"命名，收起时只显示这一行，不是把 detail 截一段。
· detail：展开正文，**2~4句**，把这个要点讲透——具体依据、怎么推出的、和别条什么关系，纯内容不复述废话。**只讲内容本身，不要出现「视频1」「视频2」或点名视频标题**——出处交给 source_ids。
    · focus：**每个要点都必须给**——从 detail 里挑最该被记住的一小段（一个短句或关键短语，别整句照抄），**必须原样出现在 detail 中**。这是读者在整段正文里的视觉落点，缺了正文就成了没有重点的一大堆字。
· source_ids：所有确实讲到该要点的视频，取该点 sources 里的 video_id 数组；可以多条，但不要把只是支撑整个知识点、没讲到这个具体要点的视频塞进来。说不清就省略。
    单薄的知识点给 2 点即可，**不要硬凑到 4 点**。
- sources：支撑该点的视频，每项 {video_id, timestamp}。video_id 必须是输入 videos 里真实存在的 id；timestamp 从该视频脉络节点里挑最相关的一个（形如"5:30"，挑不到给空字符串）。至少 1 条，按相关度排序，最相关的排第一。

铁律：
- 只写真正跨≥2条视频、或某条视频对全组有独特贡献的知识点；单条视频内部的要点不算合成，不要写。
- 宁缺毋滥：整组视频若各说各话、没有可比较的交汇点，points 给空数组。
- 忠实转述视频已讲的内容，不新造观点、不替用户下结论。
- **每个 facet 都必须带 focus**，且 focus 是它自己 detail 里的原样子串（复制粘贴级一致，别改一个字）。这是读者在整段正文里唯一的视觉落点，漏了这条 facet 就作废。宁可 detail 短一点也要留出一句能当重点的话。

行文用中文标点，引用与强调用「」。只输出 JSON：{"series_question":"…","points":[{"label":"…","relation":"…","stance":[{"tag":"a","text":"…"}],"facets":[{"lead":"…","label":"…","detail":"…","focus":"…","source_ids":["…","…"]}],"sources":[{"video_id":"…","timestamp":"…"}]}]}
字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

/** 整组视频 → 合集级合成。points 全部落空（各说各话）时抛错，由收尾层判为无合成。 */
export async function generateSynthesis(videos: SynthesisInputVideo[]): Promise<Synthesis> {
  if (videos.length < 2) throw new Error("合集不足 2 条，无从合成");
  const byId = new Map(videos.map((v) => [v.id, v]));

  const input = JSON.stringify({
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      core_question: v.analysis.core_question,
      video_type: v.analysis.video_type,
      nodes: v.analysis.backbone.map((n) => ({
        concept: n.concept, detail: n.detail, timestamp: n.timestamp,
      })),
    })),
  });

  const attempt = async (): Promise<Synthesis> => {
    const parsed = await callDeepseekJson<{
      series_question?: string;
      points?: {
        label?: string; relation?: string;
        stance?: { tag?: string; text?: string }[];
        facets?: { lead?: string; label?: string; detail?: string; focus?: string; source_ids?: string[]; source_id?: string }[];
        sources?: { video_id?: string; timestamp?: string }[];
      }[];
    }>(SYNTHESIS_SYS, input, 0.4);

    // 安全网：prompt 已禁「视频N」，模型偶有漏网时剥掉括注（如"…（视频2、4）…"），
    // 再收拢多出来的空格与悬空标点。
    const stripVideoRefs = (s: string) =>
      s.replace(/[（(]\s*视频[\d、,，\s和及]*[）)]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([，。、；：）」])/g, "$1")
        .trim();

    const points: SynthesisPoint[] = [];
    for (const p of Array.isArray(parsed.points) ? parsed.points : []) {
      const label = String(p.label ?? "").trim();
      const relation = String(p.relation ?? "").trim();
      if (!label || !relation) continue;
      // 溯源必须落在真实视频上：过滤非法 id，标题以库为准（不信模型回填）
      const sources = (Array.isArray(p.sources) ? p.sources : [])
        .map((s) => ({ id: String(s?.video_id ?? ""), ts: String(s?.timestamp ?? "").trim() }))
        .filter((s) => byId.has(s.id))
        .map((s) => ({
          videoId: s.id,
          title: byId.get(s.id)!.title,
          timestampText: s.ts,
        }));
      if (!sources.length) continue;
      // 要点：清洗后必须有 lead+label+detail；refs 由 source_ids 映射到 sources 的 1-based 序号。
      const facets = (Array.isArray(p.facets) ? p.facets : [])
        .map((f) => {
          const label = stripVideoRefs(String(f?.label ?? ""));
          const detail = stripVideoRefs(String(f?.detail ?? ""));
          const lead = String(f?.lead ?? "").trim();
          const focus = String(f?.focus ?? "").trim();
          // 兼容模型偶尔返回的旧字段 source_id。
          const sourceIds = (Array.isArray(f?.source_ids) ? f.source_ids : [f?.source_id])
            .map((id) => String(id ?? "").trim())
            .filter(Boolean);
          const refs = [...new Set(sourceIds
            .map((id) => sources.findIndex((s) => s.videoId === id) + 1)
            .filter((ref) => ref > 0))];
          return {
            lead, label, detail,
            ...(focus && detail.includes(focus) ? { focus } : {}),
            ...(refs.length ? { refs } : {}),
          };
        })
        .filter((f) => f.lead && f.label && f.detail)
        .slice(0, 4);
      if (!facets.length) continue;
      // sources 与要点角标必须双向一致：未被任何 facet 引用的来源不落库。
      const referencedSourceIndexes = new Set(facets.flatMap((f) => f.refs ?? []));
      const sourceIndexMap = new Map<number, number>();
      const referencedSources = sources.filter((_, index) => {
        if (!referencedSourceIndexes.has(index + 1)) return false;
        sourceIndexMap.set(index + 1, sourceIndexMap.size + 1);
        return true;
      });
      if (!referencedSources.length) continue;
      const normalizedFacets = facets.map((facet) => ({
        ...facet,
        ...(facet.refs?.length
          ? { refs: facet.refs.map((ref) => sourceIndexMap.get(ref)).filter((ref): ref is number => ref != null) }
          : {}),
      }));
      // 立场统计可选：仅收 tag 合法（a/b/c）且有文案的项
      const stance = (Array.isArray(p.stance) ? p.stance : [])
        .map((s) => ({ tag: String(s?.tag ?? "").trim(), text: String(s?.text ?? "").trim() }))
        .filter((s): s is { tag: "a" | "b" | "c"; text: string } =>
          (s.tag === "a" || s.tag === "b" || s.tag === "c") && Boolean(s.text));
      points.push({
        label, relation, facets: normalizedFacets, sources: referencedSources,
        ...(stance.length ? { stance } : {}),
      });
      if (points.length >= 4) break;
    }
    if (!points.length) throw new Error("无跨视频知识点");

    const seriesQuestion = String(parsed.series_question ?? "").trim();
    return { seriesQuestion, points };
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

const COLLECTION_GAP_SYS = `你是"回响"的合集补缺引擎。输入是一个合集里所有视频合起来讲了什么（series_question + videos），以及这些视频在各自单条解析里【已经补过】的背景（already_filled）。你要补的，是这一整组作为整体、共同没触及的那块相邻拼图。只输出 JSON 对象，不要多余文字。

补缺 = 往旁边看，不是往里挖（本任务最重要的约束）：
- 单视频补缺补的是"某一条视频承重却没讲透的地基"。你不同——你补的是"整组视频把一个话题讲完了，但它周围还有一块同等重要、却被整组集体绕开的相邻内容"。
- 典型：整组在讲某段历史，就补相近时段/相邻地域的历史，或同一段史实里不同立场的人如何书写；整组在讲某套机制，就补与之互为镜像或并行的另一套。

输出 {gap, fill}（前端两段式：gap 是点题引子、fill 是背景正文，中间换行，都不带任何小标题）：
- gap：一句自成一体、以句号「。」收尾的陈述句，直接把那块被绕开的相邻内容点出来当事实说，让内容自己站住。不是问句，也不是某一条视频内部的空洞。
- fill：另起一段，2~3 句补上这块相邻背景，公认可查证、具体不空泛。承接 gap 但不重复它。
- focus：fill 里最该被记住的一小段子串（**必须原样出现在 fill 中**），用于高亮；没有合适的就省略该字段。
- searchTerms：2~3 个可以直接拿去视频平台搜索的关键词，帮读者顺着这块相邻拼图自己往下搜。每个 2~10 字、名词性短语（搜索框里的写法），不要问句、不要完整句子，彼此不重复。

护栏（必须遵守）：
1. **禁止自指**：gap 与 fill 里都不许出现「这组／那组／整组／这几条／这组视频」这类指代——读者看得见自己在看什么，你只管把相邻背景当作事实陈述出来（无落款）。
2. 只补公认、可查证的相邻背景（相近历史、平行案例、不同视角的既有书写），不生成需要选边站的评价。
3. fill 必须是 videos 里【没讲过】的：能在 videos 的 core_question/concepts 里找到，就是假补缺，判空。
4. fill 不得重复 already_filled 里【单视频已经补过】的内容——那些已在各自解析页出现，这里再出就是冗余，判空。
5. 是补背景的口气，不替用户下结论。

门控：若这组视频已把相邻维度也覆盖了、实在没有值得并置的相邻拼图 → gap 与 fill 都输出空字符串 ""，searchTerms 输出空数组 []。宁缺毋滥。

行文用中文标点，引用与强调用「」。输出：{"gap":"…","fill":"…","focus":"…","searchTerms":["…","…"]}
字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

/** 合集级补缺：整组摊开 + 各视频单条已补内容做排除，补相邻维度。门控/失败时 gap、fill 皆空。 */
export async function generateCollectionGapFill(
  videos: SynthesisInputVideo[],
  seriesQuestion: string,
  alreadyFilled: CollectionGapFill[],
): Promise<CollectionGapFill> {
  const input = JSON.stringify({
    series_question: seriesQuestion,
    videos: videos.map((v) => ({
      title: v.title,
      core_question: v.analysis.core_question,
      concepts: v.analysis.backbone.map((n) => n.concept),
    })),
    already_filled: alreadyFilled,
  });

  const attempt = async (): Promise<CollectionGapFill> => {
    const parsed = await callDeepseekJson<Partial<CollectionGapFill>>(COLLECTION_GAP_SYS, input, 0.4);
    const gap = String(parsed.gap ?? "").trim();
    const fill = String(parsed.fill ?? "").trim();
    const focus = String(parsed.focus ?? "").trim();
    // gap 与 fill 必须成对，缺一即判空（合法门控，不报错）；focus 须真出现在 fill 内才留
    if (!gap || !fill) return { gap: "", fill: "" };
    const searchTerms = (Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [])
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    return {
      gap, fill,
      ...(focus && fill.includes(focus) ? { focus } : {}),
      ...(searchTerms.length ? { searchTerms } : {}),
    };
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** L6 收尾：基于整组 + 各视频单条已补的 gap/fill，生成合集补缺并落库。门控空则不存。 */
async function runCollectionGapFill(
  collectionId: string,
  videos: SynthesisInputVideo[],
  seriesQuestion: string,
): Promise<void> {
  const alreadyFilled = videos
    .map((v) => getAnalysis(v.id)?.cognitiveExpansion?.gapFill)
    .map((g) => ({ gap: g?.gap ?? "", fill: g?.fill ?? "" }))
    .filter((g) => g.gap && g.fill);
  const gf = await generateCollectionGapFill(videos, seriesQuestion, alreadyFilled);
  if (gf.gap && gf.fill) saveCollectionGapFill(collectionId, gf);
}

export { runCollectionGapFill };

/* ---------- f2 抖音合集工具（游客 cookie，scripts/mix_enum.py） ---------- */
export interface MixVideo { aweme_id: string; desc: string }

async function runMixScript<T extends { ok: boolean; error?: string }>(
  args: string[],
  outName: string,
): Promise<T> {
  await mkdir(TMP, { recursive: true });
  const script = join(process.cwd(), "..", "scripts", "mix_enum.py");
  const out = join(TMP, outName);
  try {
    await execFileAsync("python", [script, ...args, out], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch { /* 脚本以 os._exit(0) 收尾，结果在文件里，忽略退出码 */ }
  let data: T;
  try { data = JSON.parse(await readFile(out, "utf8")); }
  catch { throw new Error("枚举脚本没产出结果（python/f2 异常，确认已 pip install f2）"); }
  await unlink(out).catch(() => {});
  if (!data.ok) throw new Error(data.error || "枚举失败");
  return data;
}

export async function enumerateMix(mixId: string): Promise<MixVideo[]> {
  const data = await runMixScript<{ ok: boolean; error?: string; videos?: MixVideo[] }>(
    [mixId],
    `mix_${mixId}.json`,
  );
  return data.videos || [];
}

/** 单集反查所属合集（分享链接常落在 /video/{id}，不带 /mix/ 路径）。查不到不报错。 */
export async function lookupMixOfVideo(
  awemeId: string,
): Promise<{ mixId: string; mixName: string } | null> {
  try {
    const data = await runMixScript<{ ok: boolean; error?: string; mix_id?: string | null; mix_name?: string }>(
      ["--detail", awemeId],
      `detail_${awemeId}.json`,
    );
    return data.mix_id ? { mixId: data.mix_id, mixName: data.mix_name || "" } : null;
  } catch { return null; }
}

export function detectAwemeId(url: string): string | null {
  const m = url.match(/\/(?:share\/)?video\/(\d+)/);
  return m ? m[1] : null;
}

/* 管线自抛的错误已是中文人话，原样透传；这里兜住底层网络/运行时错误
   （undici 的 terminated、fetch failed、超时等），翻译成用户能懂的原因。 */
function friendlyError(raw: string): string {
  if (/[一-鿿]/.test(raw)) return raw;
  if (/terminated|aborted|ECONNRESET|socket|fetch failed|network/i.test(raw))
    return "下载中途被掐断（网络波动或平台限流），重试一次通常就好";
  if (/timeout|timed out/i.test(raw)) return "处理超时（视频太长或网络太慢），可以重试";
  return raw ? `解析出错（${raw.slice(0, 80)}），可以重试` : "未知错误，可以重试";
}

/* ---------- 单资产管线：状态机 uploaded→transcribing→analyzing→analyzed|failed ---------- */
export async function runAssetPipeline(assetId: string): Promise<void> {
  const asset = getAsset(assetId);
  if (!asset || asset.status !== "uploaded") return;

  await mkdir(TMP, { recursive: true });
  let videoPath: string | undefined;
  let mp3Path: string | undefined;
  try {
    const platform = detectPlatform(asset.sourceUrl);

    updateAsset(assetId, { step: "解析直链" });
    let mediaUrl = asset.sourceUrl;
    let title = asset.title;
    if (platform === "抖音") {
      const parsed = await parseDouyin(asset.sourceUrl);
      mediaUrl = parsed.videoUrl;
      title = parsed.title || (parsed.author ? `${parsed.author}的抖音视频` : "抖音视频");
      updateAsset(assetId, { title, author: parsed.author });
      try {
        const cover = await downloadCover(parsed.coverUrl, assetId);
        if (cover) updateAsset(assetId, { cover });
      } catch { /* 缺封面用占位图，不阻塞 */ }
      await ensureAssetEngagement(assetId).catch(() => undefined);
    } else if (!asset.title) {
      title = "（直链视频）";
      updateAsset(assetId, { title });
    }

    updateAsset(assetId, { step: "下载视频" });
    videoPath = join(TMP, `${assetId}.mp4`);
    // 网络波动/直链失效是最常见的失败原因：最多试 3 次；
    // 抖音直链是带签名的临期 URL，重试前重新解析拿新直链。视频过大是确定性失败，不重试。
    const dlHeaders: Record<string, string> =
      platform === "抖音" ? { "User-Agent": IPHONE_UA } : {};
    const DL_MAX = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        await downloadMedia(mediaUrl, videoPath, dlHeaders);
        break;
      } catch (e) {
        if (attempt >= DL_MAX || /视频过大/.test((e as Error).message)) throw e;
        updateAsset(assetId, { step: `下载视频（重试 ${attempt}/${DL_MAX - 1}）` });
        await sleep(2000 * attempt);
        if (platform === "抖音") {
          try { mediaUrl = (await parseDouyin(asset.sourceUrl)).videoUrl; }
          catch { /* 重新解析失败就沿用旧直链再试 */ }
        }
      }
    }
    const duration = await probeDuration(videoPath);
    if (duration) updateAsset(assetId, { duration });

    updateAsset(assetId, { status: "transcribing", step: "抽音频" });
    mp3Path = await extractAudio(videoPath);
    updateAsset(assetId, { step: "语音转写" });
    const transcript = await transcribeVolc(mp3Path);
    saveTranscript(assetId, transcript);

    updateAsset(assetId, { status: "analyzing", step: "AI 理解" });
    const a = await analyzeTranscript(transcript);
    // 模板判定读转写原文核对数字/年份/反事实依据，此时刚生成的 backbone 还没有回响——
    // 五模板里能挂 echo 的位置留空即可，saveAnalysis 之后无需回填。
    const dispatch = await classifyTemplate(a, [], transcript, title).catch(() =>
      createArgumentDispatch({
        coreQuestion: a.core_question,
        summary: a.summary,
        nodes: a.backbone,
        takeaways: a.takeaways,
        confidence: a.type_confidence,
      })
    );
    saveAnalysis({
      assetId,
      coreQuestion: a.core_question,
      videoType: a.video_type,
      typeConfidence: a.type_confidence,
      summary: a.summary,
      backbone: a.backbone,
      takeaways: a.takeaways,
      dispatch,
    });

    // L5：回响——逐节点点对点匹配（分层原则——每层独立 try/catch，上层失败不拖垮下层）
    try {
      const links = await generateLinks(a, title, listRecallSources(assetId));
      if (links.echoes.length) {
        saveEchoes(assetId, links.echoes);
        await addReciprocalEchoes(assetId, links.echoes); // 反向写回旧视频命中节点，两边互见
      }
    } catch { /* 没有回响，脉络照常可用 */ }

    // L4：补缺只读本条视频，不牵扯观看史——历史连接归回响。
    try {
      const exp = await generateExpansion(a);
      saveExpansion(assetId, {
        gapFill: exp.gap
          ? { gap: exp.gap, fill: exp.fill, ...(exp.searchTerms.length ? { searchTerms: exp.searchTerms } : {}) }
          : {},
      });
    } catch { /* 脉络照常可用 */ }

    // L4b：评论热度（mock）——同补缺，只读本条视频内容，独立失败不拖累其它块。
    try {
      const heat = await generateCommentHeat(a, title);
      saveCommentHeat(assetId, heat);
    } catch { /* 没有热度块，解析页照常可用 */ }

    // L3：大类归属。单条视频立即归入该类"散篇集"；mix 组员只记大类，
    // 组的合集归属由 runGroupPipelines 收尾时聚合裁决（PRD §5.2.4 合集整体归类）
    let miscCat: CategoryId | null = null;
    try {
      const cat = await classifyCategory(a, title);
      if (cat) {
        updateAsset(assetId, { bigCategoryId: cat });
        if (!asset.groupId && isMappedRegionCategory(cat)) {
          const misc = MISC_COLLECTION[cat];
          upsertCollection(misc.id, misc.name, cat);
          updateAsset(assetId, { collectionId: misc.id });
          miscCat = cat;
        }
      }
    } catch { /* 五类之外/分类失败：不上地图，解析页照常可访问 */ }

    updateAsset(assetId, { status: "analyzed", step: "完成" });

    // 落进散篇集就触发一次该大类聚类（须在置 analyzed 之后，本条才可见）
    if (miscCat) {
      try { await reclusterMisc(miscCat); }
      catch { /* 聚类失败留散篇集，下次解析再聚 */ }
    }
  } catch (e) {
    updateAsset(assetId, {
      status: "failed",
      step: "失败",
      errorMessage: friendlyError((e as Error).message || ""),
    });
  } finally {
    if (videoPath) await unlink(videoPath).catch(() => {});
    if (mp3Path) await unlink(mp3Path).catch(() => {});
  }
}

/* ---------- 输入编排：单视频 / 合集 / 多链接（PRD §6.4.1 三种输入） ---------- */
export type ParseIntake =
  | { kind: "single"; asset: SourceAsset }
  | { kind: "mix" | "multi"; groupId: string; assets: SourceAsset[] };

// 合集串行解析（sidecar 有限流，eval 实测并发会 429）
const MIX_CONCURRENCY = Math.max(1, Number(env("MIX_CONCURRENCY") || 1));
// 合集默认全量解析；MIX_LIMIT>0 只解析前 N 集（快速验证/控成本护栏，同 eval）
const MIX_LIMIT = Math.max(0, Number(env("MIX_LIMIT") || 0));

export async function intakeInput(
  input: string,
  opts?: { expandMix?: boolean },
): Promise<ParseIntake> {
  const urls = extractUrls(input);
  if (!urls.length) throw new Error("没在输入里找到 http(s) 链接");

  if (urls.length > 1) {
    // 多条独立链接：先逐条校验平台（B站/未知平台在这里就报错，不入库）
    const finals = await Promise.all(
      urls.map(async (u) => {
        const f = await resolveShortLink(u).catch(() => u);
        if (detectMixId(f)) throw new Error("多链接中混入了合集链接——合集请单独粘贴");
        detectPlatform(f);
        return f;
      })
    );
    const groupId = randomUUID().slice(0, 8);
    const assets = finals.map((f) => createAsset({ sourceUrl: f, groupId }));
    return { kind: "multi", groupId, assets };
  }

  const finalUrl = await resolveShortLink(urls[0]).catch(() => urls[0]);
  let mixId = detectMixId(finalUrl);
  let mixName = "";

  // 合集分享链接常落在单集页（/video/{id}），不带 /mix/ 路径。
  // expandMix 时反查这一集所属的合集，命中则按合集整组解析。
  if (!mixId && opts?.expandMix) {
    const awemeId = detectAwemeId(finalUrl);
    if (awemeId) {
      const mix = await lookupMixOfVideo(awemeId);
      if (mix) { mixId = mix.mixId; mixName = mix.mixName; }
    }
  }

  if (mixId) {
    let videos = await enumerateMix(mixId);
    if (!videos.length) throw new Error("合集里没枚举到视频");
    if (MIX_LIMIT > 0) videos = videos.slice(0, MIX_LIMIT);
    const groupId = randomUUID().slice(0, 8);
    // 先落合集行：抖音侧给了名就沿用（组收尾归类省一次起名调用），
    // 并记下原合集链接——合集解析页「查看原合集」跳转用（与单集的原视频跳转对齐）。
    upsertCollection(groupId, mixName ? mixName.slice(0, 16) : "", "");
    setCollectionSourceUrl(groupId, `https://www.douyin.com/collection/${mixId}`);
    const assets = videos.map((v) =>
      createAsset({
        sourceUrl: `https://www.douyin.com/video/${v.aweme_id}`,
        title: cleanVideoTitle(v.desc || ""),
        groupId,
      })
    );
    return { kind: "mix", groupId, assets };
  }

  detectPlatform(finalUrl); // B站/未知平台在这里就报错，不入库
  return { kind: "single", asset: createAsset({ sourceUrl: finalUrl }) };
}

/* mix 组收尾：组内已解析各集的大类多数票 → 整组归入一个合集（PRD §5.2.4），
   合集名用一次轻调用概括，失败落作者名兜底。 */
const GROUP_NAME_SYS = `给一组同系列视频起一个合集名：不超过12个字，中文，不带书名号和标点，概括这组视频的共同主题。只输出 JSON：{"name":"…"}`;

async function finalizeMixGroup(groupId: string): Promise<void> {
  const assets = getAssetsByGroup(groupId).filter((a) => a.status === "analyzed");
  if (!assets.length) return;
  const votes = new Map<string, number>();
  for (const a of assets)
    if (a.bigCategoryId) votes.set(a.bigCategoryId, (votes.get(a.bigCategoryId) || 0) + 1);
  if (!votes.size) return; // 全组五类之外：不上地图
  const cat = [...votes.entries()].sort((x, y) => y[1] - x[1])[0][0] as CategoryId;
  if (!isMappedRegionCategory(cat)) return; // 无独立区域的大类统一留在未知海域

  // 抖音侧的合集名（intake 反查时已落库）优先；没有才让 LLM 起名
  let name = getCollectionRow(groupId)?.name ?? "";
  if (!name) {
    try {
      const parsed = await callDeepseekJson<{ name?: string }>(
        GROUP_NAME_SYS,
        JSON.stringify({ titles: assets.slice(0, 20).map((a) => a.title) }),
        0.3,
      );
      name = String(parsed.name ?? "").trim().slice(0, 16);
    } catch { /* 落兜底名 */ }
  }
  if (!name) name = assets[0].author ? `${assets[0].author}的合集` : assets[0].title.slice(0, 12) || "解析合集";

  upsertCollection(groupId, name, cat);
  for (const a of assets) updateAsset(a.id, { collectionId: groupId });

  // L6 合集合成：整组脉络摊开找跨视频知识点。分层独立——失败只是没有合集解析页，
  // 群岛/单集照常。单集合集（<2）跳过。
  try {
    const videos: SynthesisInputVideo[] = [];
    for (const a of assets) {
      const an = getAnalysis(a.id);
      if (!an) continue;
      videos.push({
        id: a.id,
        title: a.title || "未命名视频",
        analysis: {
          core_question: an.coreQuestion,
          video_type: an.videoType as AnalysisResult["video_type"],
          type_confidence: an.typeConfidence,
          summary: an.summary,
          backbone: an.backbone,
          takeaways: an.takeaways,
        },
      });
    }
    if (videos.length >= 2) {
      const synthesis = await generateSynthesis(videos);
      saveSynthesis(groupId, synthesis);
      // 合集补缺独立分层：失败只缺席补缺，不连累已存的合成。
      try { await runCollectionGapFill(groupId, videos, synthesis.seriesQuestion); }
      catch { /* 无合集补缺 */ }
    }
  } catch { /* 无合成：合集解析页走"关联不够多"兜底 */ }
}

/* 组内逐条跑管线（响应返回后由 after() 调用）。
   mix：整组归一个合集；multi：自定义视频组不成组上地图，逐条落各自大类散篇集。 */
export async function runGroupPipelines(
  assetIds: string[],
  kind: "mix" | "multi" = "mix",
): Promise<void> {
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < assetIds.length; i = next++) {
      await runAssetPipeline(assetIds[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(MIX_CONCURRENCY, assetIds.length) }, worker)
  );

  if (kind === "mix") {
    const groupId = getAsset(assetIds[0])?.groupId;
    if (groupId) await finalizeMixGroup(groupId);
    return;
  }
  const cats = new Set<CategoryId>();
  for (const id of assetIds) {
    const a = getAsset(id);
    if (
      a?.status === "analyzed" &&
      isMappedRegionCategory(a.bigCategoryId) &&
      !a.collectionId
    ) {
      const misc = MISC_COLLECTION[a.bigCategoryId as CategoryId];
      if (misc) {
        upsertCollection(misc.id, misc.name, a.bigCategoryId);
        updateAsset(id, { collectionId: misc.id });
        cats.add(a.bigCategoryId as CategoryId);
      }
    }
  }
  // 批次收尾各大类只聚一次，不是每条一次
  for (const cat of cats) {
    try { await reclusterMisc(cat); }
    catch { /* 聚类失败留散篇集，下批再聚 */ }
  }
}
