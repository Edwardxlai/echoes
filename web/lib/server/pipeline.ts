/* ================================================================
   回响 · 服务端解析管线（从 eval/server.mjs 移植，PRD §7）
   范围：抖音 + 直链。B站不做（抖音黑客松，方案文档范围红线）。
   流程：解析直链 → 下载 → 抽音频 → 火山豆包 ASR → DeepSeek 瘦脉络
        → 回响/known 匹配（L5+4a）→ 认知拓展（L4）→ 大类归属（L3）→ 归入合集。
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
  type SourceAsset, type BackboneNode, type StoredEcho, type RecallSource,
} from "./store";
import { cleanVideoTitle } from "./title-utils.mjs";

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
   失败不阻塞管线——群岛面板缺封面用占位图。 */
async function downloadCover(coverUrl: string, assetId: string): Promise<string> {
  if (!coverUrl) return "";
  const dir = join(process.cwd(), "public", "covers", "real");
  await mkdir(dir, { recursive: true });
  const res = await fetch(coverUrl, {
    headers: { "User-Agent": IPHONE_UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`封面下载失败（${res.status}）`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error("封面文件太小");
  await writeFile(join(dir, `${assetId}.jpg`), buf);
  return `/covers/real/${assetId}.jpg`;
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

const VIDEO_TYPES = new Set(["argument", "narrative", "intro", "compare", "concept"]);

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

export async function analyzeTranscript(transcript: string): Promise<AnalysisResult> {
  const attempt = async (): Promise<AnalysisResult> => {
    const parsed = await callDeepseekJson<AnalysisResult>(
      ANALYZE_SYS,
      transcript.slice(0, 12000),
      0.3,
    );
    if (!Array.isArray(parsed.backbone) || parsed.backbone.length < 3)
      throw new Error(`脉络节点太少（${parsed.backbone?.length ?? 0}）`);
    // 类型非法不得静默回落介绍类（PRD §6.1.3 修正2），抛错走重试
    if (!VIDEO_TYPES.has(parsed.video_type))
      throw new Error(`类型非法（${parsed.video_type}）`);
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

/* ---------- L4 认知拓展（M2：4b 补缺 + 4c 延伸，合并一次调用；4a known 待 M3） ---------- */
export interface ExpansionResult {
  /** 补缺·戳破：视频承重却没铺的地基（一句陈述）。门控为空=这条无承重空洞，补缺不出。 */
  gap: string;
  /** 补缺·补上：视频里没有的外部背景，与 gap 连读成一段。gap 空时同为空。 */
  fill: string;
  extend: { question: string; hint: string }[];
}

const EXPAND_SYS = `你是"回响"的认知拓展引擎。基于一条视频的脉络分析结果和用户知识库的已有积累，生成"补缺"和"延伸"两块内容。只输出 JSON 对象，不要多余文字。

两块内容的分工必须泾渭分明（本任务最重要的约束）：
- 补缺 = 往内夯实：这条视频「承重、却默认你已会」的那块地基。视频把结论压在某个概念/机制/事实上，却没铺——你把它戳破，并用视频之外的公认背景知识补上。只读这一条视频自己，不牵扯用户的已有积累（known 与补缺无关）。
- 延伸 = 往外发散：一个没有唯一答案的开放议题，不靠查证解决，等用户带着自己的判断进来讨论。

一、补缺 → 输出 {gap, fill}（前端分两段呈现：gap 是点题引子、fill 是背景正文，中间换行，都不带任何小标题或提示词）：
- gap：一句自成一体的完整陈述句，必须以句号「。」收尾——不是问句，也不要用冒号或破折号把话头引向 fill。它戳破这条视频「踩着却没讲透」的那块承重地基：一个被结论依赖、但视频默认你已会的概念定义 / 被跳过的机制 / 只给结论没给出处的关键事实。
- fill：另起一段，2~3 句补上这块「视频里没有的」外部背景知识。语义上承接 gap，但自身是完整、独立成段的话，不重复 gap 已经说过的内容——gap 点出缺口，fill 只管把缺口填实。
- 护栏（必须遵守）：
  1. 只补公认、可查证的背景知识（历史事件、概念定义、机制原理这类），不碰需要立场判断的东西——那是延伸的地盘。
  2. fill 必须是视频里没有的内容：若 fill 说的东西能在下面 backbone/summary 里找到，就是穿帮的假补缺，判空。
  3. fill 是补背景的口气、不是拍板下结论：陈述公认事实，不评价视频观点。
- 门控：不是每条视频都有承重空洞。若这条视频自洽、没有被结论依赖却没铺的地基 → gap 与 fill 都输出空字符串 ""。宁可不出，不出假的。

二、延伸 extend：开放式深挖问题，每条 {question, hint}。
- question：顺着视频自己的逻辑往下追一步（「如果 X 成立，那 Y 呢？」式），立场之间有张力、值得讨论；不是换话题，不判对错。
- hint：2~3 句，点破视频藏了什么隐含假设、或缺了哪一半，给出追问的方向，但不替用户下结论。

三、延伸随知识库演化（输入里的 known = 用户已有的相关积累，可能为空；仅作用于延伸，不影响补缺）：
- known 为空（冷启动）：延伸取满 3 条。
- known 有内容：延伸收敛到 1~2 条，优先出与已有积累形成张力的问题。

行文用中文标点；引用与强调一律用「」，不用英文引号或弯引号（'…'"…"都不行）。

延伸条目的标准写法（风格样例，不要照抄内容）：
{"question":"如果通胀是「隐形的再分配」，那「温和通胀有益」这个主流共识，究竟站在谁的立场上？","hint":"视频点破了通胀让持币者受损、负债者受益，却没往下问：既然有输有赢，「2% 温和通胀是健康的」到底替谁说话——央行、作为最大债务人的政府、还是储户？换个立场，结论可能就反过来。"}
{"question":"历史上那几次技术革命里，被淘汰的那代人，本人最后怎么样了？","hint":"「长出更多新岗位」是宏观真话，但缺了微观：织布工、马车夫本人有没有等到红利。补上这段，才知道「重塑」对个体意味着什么。"}

输出：{"gap":"…","fill":"…","extend":[{"question":"…","hint":"…"}]}
补缺门控触发时 gap 与 fill 均为 ""，但 extend 仍须非空。字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

/** M3 起由观看史检索填充；M2 恒空 → prompt 走冷启动分支（延伸取满、补缺看视频内部）。 */
export interface KnownContext {
  point: string;
  fromTitle?: string;
}

export async function generateExpansion(
  a: AnalysisResult,
  known: KnownContext[] = [],
): Promise<ExpansionResult> {
  const input = JSON.stringify({
    core_question: a.core_question,
    video_type: a.video_type,
    summary: a.summary,
    backbone: a.backbone.map((n) => ({ concept: n.concept, detail: n.detail })),
    takeaways: a.takeaways,
    known,
  });

  const attempt = async (): Promise<ExpansionResult> => {
    // 门控要的是稳定判断而非叙述多样性，temperature 压到 0.3（脉络分析仍用 0.5）
    const parsed = await callDeepseekJson<Partial<ExpansionResult>>(EXPAND_SYS, input, 0.3);
    const gap = String(parsed.gap ?? "").trim();
    const fill = String(parsed.fill ?? "").trim();
    const extend = (Array.isArray(parsed.extend) ? parsed.extend : [])
      .map((x) => ({ question: String(x?.question ?? "").trim(), hint: String(x?.hint ?? "").trim() }))
      .filter((x) => x.question && x.hint)
      .slice(0, 3);
    if (!extend.length) throw new Error("延伸为空");
    // 补缺为空是合法门控结果（这条视频无承重空洞），不得连累整块重试/失败；
    // gap 与 fill 必须成对，缺一即视为无效补缺，一并判空。
    const hasGap = Boolean(gap && fill);
    return { gap: hasGap ? gap : "", fill: hasGap ? fill : "", extend };
  };

  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/* ---------- L3 大类归属（方案文档 §二 L3：喂 L1 结构化摘要，temperature 0 保稳定） ---------- */
export type CategoryId = "eco" | "his" | "tech";
const CATEGORY_IDS: ReadonlySet<string> = new Set(["eco", "his", "tech"]);

/** 各大类"散篇"合集：单条/多链接解析的视频落这里（mix 合集自成一组）。 */
export const MISC_COLLECTION: Record<CategoryId, { id: string; name: string }> = {
  eco: { id: "misc-eco", name: "经济 · 散篇集" },
  his: { id: "misc-his", name: "历史 · 散篇集" },
  tech: { id: "misc-tech", name: "科技 · 散篇集" },
};

const CLASSIFY_SYS = `你是"回响"的内容归类引擎。把一条视频归入三大类之一：
- eco 经济：市场、货币、产业、政策、商业与资本
- his 历史：史实、人物、朝代、事件与史观叙事
- tech 科技：技术原理、产品、工程、科技产业动向

判定依据按固定优先级依次比较（保证同一内容重复判定不跳类）：
①核心问题在问什么 ②结论落点落在哪 ③主要篇幅讲什么 ④标题与简介。
看"用户获得的知识类型"而非表面关键词：讲 AI 发展史、落点在技术演进的归 tech；讲雷曼崩盘、落点在金融机制的归 eco，即使满篇是"历史"。
确实不属于三类的输出 "none"，不要硬塞进最接近的类。

只输出 JSON：{"primary":"eco|his|tech|none","secondary":"eco|his|tech|none","confidence":"high|mid|low","rationale":"≤50字"}`;

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

/* ---------- L5 回响 + L4-4a known：共用召回层（字符 bigram 重合）→ 一次 LLM 复核 ---------- */
function bigramsOf(text: string): Set<string> {
  const clean = text.replace(/[^一-鿿A-Za-z0-9]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
  return out;
}

interface LinkCandidate {
  id: string; // 喂给 LLM 的短编号
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
          id: `${src.assetId}#${i}`,
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

const LINK_SYS = `你是"回响"的关联匹配引擎。输入：一条新视频的脉络节点（nodes，含 index），和用户看过的旧视频里初筛出的候选节点（candidates，含 id）。找出与新视频某个节点真正构成点对点关系的候选（互相印证 / 唱反调 / 历史先例 / 把某一环讲得更透 / 前后衔接）。展示时旧句会直接排在命中节点的 detail 正下方，两段上下对照读。每条 {"node_index":数字,"candidate_id":"…","relation":"…","old_say":"…","node_focus":"…"}：
- relation：关系定性，2~8个字，如「互相印证」「唱反调」「历史先例」
- old_say：旧视频（候选）的说法，≤36字，必须对着命中节点的 detail 写成"接话"——同一论点、同一量级，上下一读就看出异同；直接说内容，不写「旧视频」「你看过的」这类指称。句中用【】括出与节点叙述分歧/呼应的焦点短语（一处，≤10字）
- node_focus：从命中节点 detail 里逐字摘出与该焦点对应的原文短语（≤12字，必须是 detail 的连续子串；摘不出就给空字符串，不要改写）
- 铁律：宁缺毋滥。只是话题相近不算关系，把握不足就不出；最多 3 条；同一个 node_index 最多挂 1 条

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
      nodes: a.backbone.map((n, i) => ({ index: i, concept: n.concept, detail: n.detail })),
    },
    candidates: candidates.map(({ id, title: t, concept, detail }) => ({ id, from_title: t, concept, detail })),
  });
  const parsed = await callDeepseekJson<{
    echoes?: { node_index?: number; candidate_id?: string; relation?: string; old_say?: string; node_focus?: string }[];
  }>(LINK_SYS, input, 0.3);

  const usedNodes = new Set<number>();
  const echoes: StoredEcho[] = [];
  for (const e of Array.isArray(parsed.echoes) ? parsed.echoes : []) {
    const c = byId.get(String(e.candidate_id ?? ""));
    const idx = Number(e.node_index);
    const relation = String(e.relation ?? "").trim();
    const rawOldSay = String(e.old_say ?? "").trim();
    if (!c || !relation || !rawOldSay) continue;
    if (!Number.isInteger(idx) || idx < 0 || idx >= a.backbone.length || usedNodes.has(idx)) continue;
    usedNodes.add(idx);
    // 焦点荧光两侧都要校验：旧句焦点从【】里取，节点侧必须逐字出自 detail，配不上就不划
    const focusMatch = rawOldSay.match(/【([^【】]{1,20})】/);
    const oldSay = rawOldSay.replace(/[【】]/g, "");
    const nodeFocusRaw = String(e.node_focus ?? "").trim();
    const nodeFocus = nodeFocusRaw && a.backbone[idx].detail.includes(nodeFocusRaw) ? nodeFocusRaw : "";
    echoes.push({
      nodeIndex: idx,
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

/* ---------- L4-4a known：已有——跟回响彻底分池，整条视频比对整条历史视频（话题层面），
   不复用回响那批逐节点候选，模型判断的是"这条历史视频整体是否算已有积累"而不是"这句话是否对得上"。 ---------- */
export interface KnownPoint {
  point: string;
  fromTitle?: string;
  fromVideoId?: string;
}

interface KnownCandidate {
  assetId: string;
  title: string;
  text: string;
  score: number;
}

function recallKnownCandidates(a: AnalysisResult, sources: RecallSource[]): KnownCandidate[] {
  const newGrams = bigramsOf(`${a.core_question}${a.summary}${a.backbone.map((n) => n.concept + n.detail).join("")}`);
  const scored: KnownCandidate[] = [];
  for (const src of sources) {
    const text = src.backbone.map((n) => `${n.concept}${n.detail}`).join("");
    const grams = bigramsOf(text);
    let shared = 0;
    for (const g of grams) if (newGrams.has(g)) shared++;
    if (shared > 0) scored.push({ assetId: src.assetId, title: src.title, text, score: shared });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, 6);
}

const KNOWN_SYS = `你是"已有"知识盘点引擎，跟"回响"是两套独立判断，别把两者混着想。输入：一条新视频的核心问题/摘要/脉络节点，和用户历史看过的、话题上跟这条新视频相关的候选视频（candidates，每条是一整条历史视频的内容，不是某一句话）。
任务：判断用户看这些候选视频时，已经积累了哪些跟新视频话题相关的知识，作为背景知识盘点摆在新视频旁边——不要求跟新视频某句话逐点对应，只要话题相关、忠实转述候选视频已讲过的内容即可。每条 {"point":"…","candidate_id":"…"}，point ≤40字，陈述句，不新造、不评价用户掌握程度、不重复引用同一个 candidate_id。最多 3 条，没有就给空数组。行文用中文标点，引用用「」。只输出 JSON：{"known":[…]}`;

export async function generateKnown(a: AnalysisResult, sources: RecallSource[]): Promise<KnownPoint[]> {
  const candidates = recallKnownCandidates(a, sources);
  if (!candidates.length) return [];
  const byId = new Map(candidates.map((c) => [c.assetId, c]));

  const input = JSON.stringify({
    new_video: {
      core_question: a.core_question,
      summary: a.summary,
      nodes: a.backbone.map((n) => ({ concept: n.concept, detail: n.detail })),
    },
    candidates: candidates.map((c) => ({ id: c.assetId, title: c.title, content: c.text.slice(0, 600) })),
  });
  const parsed = await callDeepseekJson<{
    known?: { point?: string; candidate_id?: string }[];
  }>(KNOWN_SYS, input, 0.3);

  const known: KnownPoint[] = [];
  const usedCandidates = new Set<string>();
  for (const k of Array.isArray(parsed.known) ? parsed.known : []) {
    const candidateId = String(k.candidate_id ?? "");
    const c = byId.get(candidateId);
    const point = String(k.point ?? "").trim();
    if (!c || !point || usedCandidates.has(candidateId)) continue;
    usedCandidates.add(candidateId);
    known.push({ point, fromTitle: c.title, fromVideoId: c.assetId });
    if (known.length >= 3) break;
  }
  return known;
}

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
    } else if (!asset.title) {
      title = "（直链视频）";
      updateAsset(assetId, { title });
    }

    updateAsset(assetId, { step: "下载视频" });
    videoPath = join(TMP, `${assetId}.mp4`);
    await downloadMedia(mediaUrl, videoPath, platform === "抖音" ? { "User-Agent": IPHONE_UA } : {});
    const duration = await probeDuration(videoPath);
    if (duration) updateAsset(assetId, { duration });

    updateAsset(assetId, { status: "transcribing", step: "抽音频" });
    mp3Path = await extractAudio(videoPath);
    updateAsset(assetId, { step: "语音转写" });
    const transcript = await transcribeVolc(mp3Path);
    saveTranscript(assetId, transcript);

    updateAsset(assetId, { status: "analyzing", step: "AI 理解" });
    const a = await analyzeTranscript(transcript);
    saveAnalysis({
      assetId,
      coreQuestion: a.core_question,
      videoType: a.video_type,
      typeConfidence: a.type_confidence,
      summary: a.summary,
      backbone: a.backbone,
      takeaways: a.takeaways,
    });

    // L5：回响——逐节点点对点匹配（分层原则——每层独立 try/catch，上层失败不拖垮下层）
    try {
      const links = await generateLinks(a, title, listRecallSources(assetId));
      if (links.echoes.length) saveEchoes(assetId, links.echoes);
    } catch { /* 没有回响，脉络照常可用 */ }

    // L4-4a：已有——整条视频话题层面比对，跟回响分池召回，独立判断
    let known: KnownPoint[] = [];
    try {
      known = await generateKnown(a, listRecallSources(assetId));
    } catch { /* 没有已有积累，认知拓展照常可用 */ }

    // L4：补缺+延伸，known 作输入随知识库演化（冷启动=空）
    try {
      const exp = await generateExpansion(a, known.map(({ point, fromTitle }) => ({ point, fromTitle })));
      saveExpansion(assetId, {
        gapFill: { known, ...(exp.gap ? { gap: exp.gap, fill: exp.fill } : {}) },
        extend: exp.extend.map((x) => ({ ...x, voices: 0 })),
      });
    } catch { /* 脉络照常可用 */ }

    // L3：大类归属。单条视频立即归入该类"散篇集"；mix 组员只记大类，
    // 组的合集归属由 runGroupPipelines 收尾时聚合裁决（PRD §5.2.4 合集整体归类）
    try {
      const cat = await classifyCategory(a, title);
      if (cat) {
        updateAsset(assetId, { bigCategoryId: cat });
        if (!asset.groupId) {
          const misc = MISC_COLLECTION[cat];
          upsertCollection(misc.id, misc.name, cat);
          updateAsset(assetId, { collectionId: misc.id });
        }
      }
    } catch { /* 三类之外/分类失败：不上地图，解析页照常可访问 */ }

    updateAsset(assetId, { status: "analyzed", step: "完成" });
  } catch (e) {
    updateAsset(assetId, {
      status: "failed",
      step: "失败",
      errorMessage: (e as Error).message || "未知错误",
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
    // 抖音侧给了合集名就先落下来，组收尾归类时沿用，省一次起名调用
    if (mixName) upsertCollection(groupId, mixName.slice(0, 16), "");
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
  if (!votes.size) return; // 全组三类之外：不上地图
  const cat = [...votes.entries()].sort((x, y) => y[1] - x[1])[0][0] as CategoryId;

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
  for (const id of assetIds) {
    const a = getAsset(id);
    if (a?.status === "analyzed" && a.bigCategoryId && !a.collectionId) {
      const misc = MISC_COLLECTION[a.bigCategoryId as CategoryId];
      if (misc) {
        upsertCollection(misc.id, misc.name, a.bigCategoryId);
        updateAsset(id, { collectionId: misc.id });
      }
    }
  }
}
