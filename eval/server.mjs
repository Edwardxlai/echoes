// 回响 · 链接解析 + ASR 管线测评（独立零依赖）
// 目的：只验证「粘链接 → 解析出直链 → 下载 → 抽音频 → ASR 转出视频内容」这条管道通不通。
// 不接数据库、不做转写编辑/源文管理，跑完把每一步状态和最终文字吐给页面。
//
// 依赖：Node 20+（内置 fetch/streams）、ffmpeg、抖音需 parse-video sidecar、火山豆包 ASR key。
// 运行：node eval/server.mjs  → 打开 http://localhost:6060

import http from "node:http";
import { readFile, mkdir, unlink, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- 极简 .env 读取（无 dotenv 依赖） ----------
async function loadEnv() {
  try {
    const raw = await readFile(join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !line.trim().startsWith("#")) {
        const v = m[2].replace(/^["']|["']$/g, "");
        if (!(m[1] in process.env)) process.env[m[1]] = v;
      }
    }
  } catch { /* 没有 .env 就用系统环境变量 */ }
}
await loadEnv();

const CFG = {
  port: Number(process.env.PORT || 6060),
  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
  parseVideoApi: (process.env.PARSE_VIDEO_API_URL || "http://localhost:8080").replace(/\/$/, ""),
  maxMb: Number(process.env.MAX_UPLOAD_MB || 200),
  volcKey: process.env.VOLC_ASR_API_KEY || "",
  volcAppKey: process.env.VOLC_ASR_APP_KEY || "",
  volcAccessKey: process.env.VOLC_ASR_ACCESS_KEY || "",
  deepseekKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBase: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
};
const TMP = join(__dirname, ".tmp");
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ---------- 管线各步 ----------
function extractUrls(input) {
  return String(input).match(/https?:\/\/[^\s，。、"'<>【】]+/g) || [];
}
function detectPlatform(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  if (host === "b23.tv" || host.endsWith("bilibili.com")) return "B站";
  if (host.endsWith("douyin.com") || host.endsWith("iesdouyin.com")) return "抖音";
  if (/\.(mp4|mov|m4v|webm|mp3|m4a|wav|aac)(\?|$)/i.test(url)) return "直链";
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 抖音：走 parse-video sidecar 拿无水印直链。
// sidecar 有速率限制（合集连打会 429），故对 429 做退避重试。
async function parseDouyin(url) {
  const endpoint = `${CFG.parseVideoApi}/video/share/url/parse?url=${encodeURIComponent(url)}`;
  const MAX = 5;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res;
    try {
      res = await fetch(endpoint, { signal: AbortSignal.timeout(20000) });
    } catch (e) {
      throw new Error(`parse-video 服务不可用（${e.message}）。确认 sidecar 已启动 & PARSE_VIDEO_API_URL=${CFG.parseVideoApi}`);
    }
    if (res.status === 429) {
      if (attempt === MAX) throw new Error(`parse-video 持续 429（限流），已重试 ${MAX} 次`);
      await sleep(1500 * attempt); // 1.5s,3s,4.5s,6s 退避
      continue;
    }
    if (!res.ok) throw new Error(`parse-video 返回 ${res.status}`);
    const body = await res.json();
    if (typeof body.code === "number" && body.code !== 200 && body.code !== 0)
      throw new Error(`解析失败：${body.msg || `code ${body.code}`}`);
    const data = body.data || {};
    if (!data.video_url) {
      if (Array.isArray(data.images) && data.images.length) throw new Error("该链接是图集（无视频），不支持");
      throw new Error("解析结果无视频地址，链接可能已失效");
    }
    return { title: (data.title || "").trim(), author: (data.author?.name || "").trim(), videoUrl: data.video_url };
  }
}

// 下载媒体到本地（带大小护栏，边下边数字节）
async function downloadMedia(mediaUrl, destPath, headers) {
  const maxBytes = CFG.maxMb * 1024 * 1024;
  const res = await fetch(mediaUrl, { headers, signal: AbortSignal.timeout(300000) });
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

// 探一下下载到的到底是不是视频（抖音直链失效常返回 HTML/JSON 错误页）
async function sniffVideo(filePath) {
  const { size } = await stat(filePath);
  const fh = await readFile(filePath);
  const head = fh.subarray(0, 12);
  const asText = head.toString("latin1").trim();
  if (asText.startsWith("<") || asText.startsWith("{"))
    throw new Error(`下载到的不是视频，是 HTML/JSON（${size} 字节，直链可能已失效）：${asText.slice(0, 60)}`);
  // mp4/mov 第 4~8 字节应是 'ftyp'；不是就八成不是标准视频容器
  const isMp4 = head.subarray(4, 8).toString("latin1") === "ftyp";
  if (!isMp4 && size < 10240)
    throw new Error(`下载到的文件太小且不像视频（${size} 字节）`);
}

// ffmpeg 抽 16k 单声道 mp3（压小，喂火山 ASR）
async function extractAudio(videoPath) {
  await sniffVideo(videoPath);
  const mp3 = videoPath.replace(/\.[^.]+$/, ".asr.mp3");
  try {
    await execFileAsync(
      CFG.ffmpeg,
      ["-nostdin", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "48k", "-y", mp3],
      { maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (e) {
    const err = String(e.stderr || e.message || "");
    const lines = err.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // 常见：无音轨 / 数据损坏
    if (/does not contain any stream|Output file .* does not contain/i.test(err))
      throw new Error("这条视频没有音轨（可能是图集/无声视频），ASR 无从下手");
    if (/Invalid data found|moov atom not found|Invalid NAL/i.test(err))
      throw new Error("视频数据损坏/不完整（下载可能被截断或直链失效）");
    throw new Error(`ffmpeg 失败：${lines.slice(-3).join(" | ") || e.message}`);
  }
  return mp3;
}

// 火山豆包极速版 ASR（同步、base64 内联，免 OSS）
async function transcribeVolc(mp3Path) {
  if (!CFG.volcKey && !(CFG.volcAppKey && CFG.volcAccessKey))
    throw new Error("火山 ASR 未配置：填 VOLC_ASR_API_KEY 或 VOLC_ASR_APP_KEY + VOLC_ASR_ACCESS_KEY");
  const audio = await readFile(mp3Path);
  const headers = {
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
      user: { uid: "echoes-eval" },
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
  const text = data.result?.text?.trim() ?? "";
  if (!text) throw new Error("火山 ASR 返回空文本");
  return text;
}

// DeepSeek：转写文本 → 回响瘦脉络（核心问题 + 4~7 概念节点）
async function analyzeTranscript(transcript) {
  if (!CFG.deepseekKey) throw new Error("DeepSeek 未配置：填 DEEPSEEK_API_KEY");
  const sys = `你是"回响"的内容理解引擎。把一条视频的转写文本重构成一条可导航的"瘦脉络"。只输出 JSON 对象，不要多余文字。
字段：
- core_question: 这条视频在回答的核心问题（一句话）
- summary: 30~60 字全局摘要
- backbone: 4~7 个概念节点（少于4或多于7都不行），数组顺序=一条脉络线；每个 {id, concept, detail, timestamp}
    · concept: ≤12字，用"它在回答什么问题"命名，不是名词标签
    · detail: 2~4句，展开这个概念，纯结果不复述废话
    · timestamp: 如"5:30"，定位不到就空字符串
- takeaways: 1~3句"可判断/可表达"的要点
不要输出关联、立场、分类等其它字段。字符串内部的引号、换行必须转义，务必输出合法 JSON。`;

  const attempt = async () => {
    const res = await fetch(`${CFG.deepseekBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CFG.deepseekKey}` },
      body: JSON.stringify({
        model: CFG.deepseekModel,
        messages: [{ role: "system", content: sys }, { role: "user", content: transcript.slice(0, 12000) }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { const m = content.match(/\{[\s\S]*\}/); if (!m) throw new Error("DeepSeek 返回非 JSON"); parsed = JSON.parse(m[0]); }
    if (!Array.isArray(parsed.backbone) || parsed.backbone.length < 3)
      throw new Error(`脉络节点太少（${parsed.backbone?.length ?? 0}）`);
    return parsed;
  };

  // LLM 偶尔吐坏 JSON，重试一次（换一次采样通常就好了）
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try { return await attempt(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// ---------- 短链解析 + 合集识别 + 枚举 ----------
async function resolveShortLink(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return url; }
  if (host === "v.douyin.com" || host.endsWith("iesdouyin.com")) {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": IPHONE_UA }, signal: AbortSignal.timeout(20000) });
    return res.url || url;
  }
  return url;
}
function detectMixId(url) {
  const m = url.match(/\/mix\/detail\/(\d+)/) || url.match(/\/collection\/(\d+)/);
  if (m) return m[1];
  try {
    const u = new URL(url);
    if (/mix/i.test(u.pathname)) { const oid = u.searchParams.get("object_id"); if (oid) return oid; }
  } catch {}
  return null;
}
// 调 f2 枚举合集（游客 cookie，无需登录）
async function enumerateMix(mixId) {
  const script = join(__dirname, "..", "scripts", "mix_enum.py");
  const out = join(TMP, `mix_${mixId}.json`);
  try {
    await execFileAsync("python", [script, mixId, out], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    });
  } catch { /* 脚本以 os._exit(0) 收尾，结果在文件里，忽略退出码 */ }
  let data;
  try { data = JSON.parse(await readFile(out, "utf8")); }
  catch { throw new Error("枚举脚本没产出结果（python/f2 异常，确认已 pip install f2）"); }
  await unlink(out).catch(() => {});
  if (!data.ok) throw new Error(data.error || "枚举失败");
  return data.videos || [];
}

// ---------- 逐步执行器 ----------
function makeStepper(steps) {
  const t = () => Date.now();
  return async (name, fn) => {
    const start = t();
    try {
      const detail = await fn();
      steps.push({ name, status: "ok", ms: t() - start, detail: detail ?? "" });
      return detail;
    } catch (e) {
      steps.push({ name, status: "fail", ms: t() - start, detail: e.message });
      throw Object.assign(new Error(e.message), { handled: true });
    }
  };
}

// 处理"一条视频 URL"（抖音视频页 / 直链）：解析直链→下载→抽音频→ASR→AI。
// steps 由调用方传入，便于单视频和合集逐条都记录。
async function processVideoUrl(videoUrl, platform, steps) {
  const step = makeStepper(steps);
  const id = randomUUID().slice(0, 8);
  let videoPath, mp3Path, keepForDebug = false;
  const result = { platform, title: "", author: "", videoUrl: "", transcript: "", analysis: null };
  try {
    await step("解析直链", async () => {
      if (platform === "直链") { result.videoUrl = videoUrl; result.title = "（直链）"; return videoUrl; }
      const parsed = await parseDouyin(videoUrl);
      result.videoUrl = parsed.videoUrl;
      result.title = parsed.title || (parsed.author ? `${parsed.author}的抖音视频` : "抖音视频");
      result.author = parsed.author;
      return `${result.title}${result.author ? " · " + result.author : ""}`;
    });
    videoPath = join(TMP, `${id}.mp4`);
    await step("下载视频", async () => {
      const bytes = await downloadMedia(result.videoUrl, videoPath, platform === "抖音" ? { "User-Agent": IPHONE_UA } : {});
      return `${(bytes / 1048576).toFixed(1)} MB`;
    });
    await step("抽音频 (ffmpeg)", async () => {
      mp3Path = await extractAudio(videoPath);
      const s = await stat(mp3Path);
      return `${(s.size / 1024).toFixed(0)} KB mp3`;
    });
    await step("ASR 转写 (火山豆包)", async () => {
      result.transcript = await transcribeVolc(mp3Path);
      return `${result.transcript.length} 字`;
    });
    await step("AI 理解 (DeepSeek)", async () => {
      result.analysis = await analyzeTranscript(result.transcript);
      return `核心问题 + ${result.analysis.backbone.length} 节点`;
    });
    return { ok: true, result };
  } catch (e) {
    keepForDebug = true;
    return { ok: false, result, error: e.message };
  } finally {
    if (videoPath && !keepForDebug) await unlink(videoPath).catch(() => {});
    if (mp3Path) await unlink(mp3Path).catch(() => {});
  }
}

// ---------- 顶层编排：单视频 or 合集 ----------
// 合集默认【全量解析】。MIX_LIMIT>0 才截断（想快速验证时用）。并发数 MIX_CONCURRENCY。
const MIX_LIMIT = Number(process.env.MIX_LIMIT || 0); // 0 = 全部
// 默认 1（串行）：parse-video sidecar 有限流，并发会 429。想快且 sidecar 扛得住再调大。
const MIX_CONCURRENCY = Math.max(1, Number(process.env.MIX_CONCURRENCY || 1));

async function runPipeline(input) {
  await mkdir(TMP, { recursive: true });
  const urls = extractUrls(input);
  if (!urls.length)
    return { type: "single", ok: false, steps: [{ name: "抠取链接", status: "fail", ms: 0, detail: "没在输入里找到 http(s) 链接" }], result: {}, error: "没在输入里找到 http(s) 链接" };
  if (urls.length > 1) return runMulti(urls);
  const url = urls[0];

  // 短链展开 → 看是不是合集
  let finalUrl = url;
  try { finalUrl = await resolveShortLink(url); } catch {}
  const mixId = detectMixId(finalUrl);
  if (mixId) return runMix(mixId);

  // 单视频
  const steps = [];
  const step = makeStepper(steps);
  let platform;
  try {
    steps.push({ name: "抠取链接", status: "ok", ms: 0, detail: url });
    platform = await step("识别平台", async () => {
      const p = detectPlatform(finalUrl);
      if (!p) throw new Error("无法识别平台（支持：抖音 / 合集 / 直链 mp4；B站待接）");
      if (p === "B站") throw new Error("本测评页暂只测 抖音 + 直链；B站 待接");
      return p;
    });
  } catch (e) {
    return { type: "single", ok: false, steps, result: {}, error: e.message };
  }
  const r = await processVideoUrl(finalUrl, platform, steps);
  return { type: "single", ok: r.ok, steps, result: r.result, error: r.error };
}

async function runMix(mixId) {
  const steps = [];
  const step = makeStepper(steps);
  let videos = [];
  try {
    await step("枚举合集 (f2)", async () => {
      videos = await enumerateMix(mixId);
      if (!videos.length) throw new Error("合集里没枚举到视频");
      return `${videos.length} 条`;
    });
  } catch (e) {
    return { type: "mix", ok: false, mixId, steps, videos: [], processed: [], error: e.message };
  }

  const toProcess = MIX_LIMIT > 0 ? videos.slice(0, MIX_LIMIT) : videos;

  // 并发池：MIX_CONCURRENCY 条同时跑，结果按原顺序回填
  const processed = new Array(toProcess.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < toProcess.length; i = next++) {
      const v = toProcess[i];
      const vsteps = [];
      const r = await processVideoUrl(`https://www.douyin.com/video/${v.aweme_id}`, "抖音", vsteps);
      processed[i] = {
        aweme_id: v.aweme_id, desc: v.desc, ok: r.ok, error: r.error || "", steps: vsteps,
        title: r.result.title, transcriptLen: (r.result.transcript || "").length,
        nodeCount: r.result.analysis ? r.result.analysis.backbone.length : 0,
        analysis: r.result.analysis,
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(MIX_CONCURRENCY, toProcess.length) }, worker));

  const okCount = processed.filter((p) => p && p.ok).length;
  const full = toProcess.length === videos.length;
  return {
    type: "mix", ok: okCount > 0, mixId, steps, count: videos.length, limit: toProcess.length,
    concurrency: MIX_CONCURRENCY, videos, processed,
    summary: `枚举 ${videos.length} 条 · ${full ? "全量解析" : "解析前"} ${toProcess.length} 条：${okCount} 成功${okCount < toProcess.length ? "、" + (toProcess.length - okCount) + " 失败" : ""}`,
  };
}

// 多条独立视频链接（PRD §6.4.1 第三种输入）：每条各自走单视频管线，结果按粘贴顺序回填。
// 用户显式粘了几条就解析几条，不受 MIX_LIMIT 截断。
async function runMulti(urls) {
  const processed = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < urls.length; i = next++) {
      const raw = urls[i];
      const vsteps = [];
      const entry = { url: raw, ok: false, error: "", steps: vsteps, title: "", transcriptLen: 0, nodeCount: 0, analysis: null };
      try {
        let finalUrl = raw;
        try { finalUrl = await resolveShortLink(raw); } catch {}
        if (detectMixId(finalUrl)) throw new Error("这条是合集链接——合集请单独粘贴，一次只解析一个合集");
        const platform = detectPlatform(finalUrl);
        if (!platform) throw new Error("无法识别平台（支持：抖音 / 直链 mp4；B站待接）");
        if (platform === "B站") throw new Error("本测评页暂只测 抖音 + 直链；B站 待接");
        const r = await processVideoUrl(finalUrl, platform, vsteps);
        entry.ok = r.ok;
        entry.error = r.error || "";
        entry.title = r.result.title;
        entry.transcriptLen = (r.result.transcript || "").length;
        entry.nodeCount = r.result.analysis ? r.result.analysis.backbone.length : 0;
        entry.analysis = r.result.analysis;
      } catch (e) {
        entry.error = e.message;
        vsteps.push({ name: "识别链接", status: "fail", ms: 0, detail: e.message });
      }
      processed[i] = entry;
    }
  };
  await Promise.all(Array.from({ length: Math.min(MIX_CONCURRENCY, urls.length) }, worker));

  const okCount = processed.filter((p) => p.ok).length;
  return {
    type: "multi", ok: okCount > 0, count: urls.length, concurrency: MIX_CONCURRENCY, processed,
    summary: `识别到 ${urls.length} 条独立链接：${okCount} 成功${okCount < urls.length ? "、" + (urls.length - okCount) + " 失败" : ""}`,
  };
}

// ---------- HTTP 服务 ----------
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const html = await readFile(join(__dirname, "index.html")).catch(() => null);
    if (!html) { res.writeHead(500); return res.end("index.html 缺失"); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      ffmpeg: CFG.ffmpeg,
      parseVideoApi: CFG.parseVideoApi,
      volcConfigured: Boolean(CFG.volcKey || (CFG.volcAppKey && CFG.volcAccessKey)),
      deepseekConfigured: Boolean(CFG.deepseekKey),
    }));
  }
  if (req.method === "POST" && req.url === "/api/parse") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      let input = "";
      try { input = JSON.parse(body).input || ""; } catch {}
      const out = await runPipeline(input);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    });
    return;
  }
  res.writeHead(404); res.end("not found");
});

// 合集全量解析可能跑很久，别让 Node 默认 5 分钟请求超时掐断
server.requestTimeout = 0;
server.headersTimeout = 0;

server.listen(CFG.port, () => {
  console.log(`\n回响 · 解析+ASR 测评  →  http://localhost:${CFG.port}`);
  console.log(`  ffmpeg          : ${CFG.ffmpeg}`);
  console.log(`  parse-video     : ${CFG.parseVideoApi}`);
  console.log(`  火山 ASR 已配置 : ${Boolean(CFG.volcKey || (CFG.volcAppKey && CFG.volcAccessKey))}\n`);
});
