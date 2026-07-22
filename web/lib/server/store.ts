/* ================================================================
   回响 · 服务端存储（PRD §8，node:sqlite 零依赖）
   source_assets / transcripts / analyses / collections。
   M3/M4 起：bigCategoryId 由 L3 分类回填，echoes 由 L5 匹配回填，
   collections 承接 mix 组与各大类"散篇"合集（真实数据上地图）。
   只允许从 Route Handler / Server Component 导入。
   ================================================================ */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { CognitiveExpansion, CollectionGapFill, Echo, Synthesis } from "@/lib/data";
import type { CommentHeat } from "@/lib/reader/comment-heat";
import {
  ANALYSIS_TEMPLATES,
  createArgumentDispatch,
  withSemanticAnchors,
  type AnalysisDispatch,
  type AnalysisTemplate,
} from "@/lib/analysis-contract";
import { semanticAnchorId } from "@/lib/semantic-anchor";

export type AssetStatus =
  | "uploaded"
  | "transcribing"
  | "analyzing"
  | "analyzed"
  | "failed";

export interface SourceAsset {
  id: string;
  type: string;
  title: string;
  author: string;
  sourceUrl: string;
  sourcePlatform: string;
  status: AssetStatus;
  step: string; // 当前步骤名，供解析等待页展示
  errorMessage: string;
  duration: string; // "mm:ss"，探不到为空
  cover: string; // 本地封面路径（/covers/real/xx.jpg），抓不到为空
  groupId: string | null;
  bigCategoryId: string | null;
  collectionId: string | null;
  likeCount: number | null;
  collectCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  metricsSource: "real" | "mock" | "";
  metricsFetchedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackboneNode {
  id: string;
  anchorId: string;
  concept: string;
  /** 该节点在所选骨架中的环节名（≤4字，如"核心张力"/"论据"）。旧数据缺席，前端回落时间戳。 */
  role?: string;
  detail: string;
  timestamp: string;
}

export interface Analysis {
  assetId: string;
  coreQuestion: string;
  videoType: string;
  typeConfidence: number;
  summary: string;
  backbone: BackboneNode[];
  takeaways: string[];
  dispatch?: AnalysisDispatch;
  /** L4 补缺。生成失败时缺席，解析页不摆空壳。 */
  cognitiveExpansion?: CognitiveExpansion;
  /** L4b 评论热度（内容感知的模拟数据，非真实抓取）。生成失败时缺席，解析页不摆空壳。 */
  commentHeat?: CommentHeat;
  /** L5 回响：锚点为主，nodeIndex 仅供旧渲染兼容。 */
  echoes?: StoredEcho[];
}

/** 落库的回响：nodeIndex 定位本条 backbone 的节点，其余字段即前端 Echo。 */
export interface StoredEcho extends Echo {
  nodeIndex: number;
  sourceAnchorId: string;
  targetAnchorId: string;
  /** 反向条目（L5b 写回旧视频的那半边）。反向不再生反向，防止来回弹 */
  reciprocal?: boolean;
}

export interface CollectionRow {
  id: string;
  name: string;
  categoryId: string;
  /** 原合集链接（抖音 mix 页）。自动聚类的 tc-/misc- 合集没有来源，恒为空串。 */
  sourceUrl: string;
  createdAt: string;
}

export type MappedRegionCategoryId = "eco" | "his" | "tech";

/** 只有这三个大类拥有世界地图下的独立区域与区域内合集。 */
export function isMappedRegionCategory(
  categoryId: string | null | undefined
): categoryId is MappedRegionCategoryId {
  return categoryId === "eco" || categoryId === "his" || categoryId === "tech";
}

const DATA_DIR = join(process.cwd(), "data");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(join(DATA_DIR, "echoes.db"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'video',
      title TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      sourceUrl TEXT NOT NULL,
      sourcePlatform TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'uploaded',
      step TEXT NOT NULL DEFAULT '',
      errorMessage TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      groupId TEXT,
      bigCategoryId TEXT,
      collectionId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL,
      fullText TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      assetId TEXT NOT NULL UNIQUE,
      coreQuestion TEXT NOT NULL DEFAULT '',
      videoType TEXT NOT NULL DEFAULT '',
      typeConfidence REAL NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      backbone TEXT NOT NULL DEFAULT '[]',
      takeaways TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  // 增量迁移（列已存在时静默跳过）：M2 认知拓展；M3 回响；封面；合集级跨视频合成
  for (const sql of [
    `ALTER TABLE analyses ADD COLUMN cognitiveExpansion TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE analyses ADD COLUMN commentHeat TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE analyses ADD COLUMN echoes TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE analyses ADD COLUMN template TEXT NOT NULL DEFAULT 'argument'`,
    `ALTER TABLE analyses ADD COLUMN templateConfidence REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE analyses ADD COLUMN downgrade TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE analyses ADD COLUMN renderData TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE source_assets ADD COLUMN cover TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE source_assets ADD COLUMN likeCount INTEGER`,
    `ALTER TABLE source_assets ADD COLUMN collectCount INTEGER`,
    `ALTER TABLE source_assets ADD COLUMN commentCount INTEGER`,
    `ALTER TABLE source_assets ADD COLUMN shareCount INTEGER`,
    `ALTER TABLE source_assets ADD COLUMN metricsSource TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE source_assets ADD COLUMN metricsFetchedAt TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE collections ADD COLUMN synthesis TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE collections ADD COLUMN collectionGap TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE collections ADD COLUMN sourceUrl TEXT NOT NULL DEFAULT ''`,
  ]) {
    try { db.exec(sql); } catch { /* 列已存在 */ }
  }
  migrateAnalysisContracts(db);
  return db;
}

/** Phase 0 in-place migration: no LLM rerun, only contract/anchor backfill. */
function migrateAnalysisContracts(database: DatabaseSync): void {
  const rows = database
    .prepare(`SELECT * FROM analyses`)
    .all() as Record<string, unknown>[];
  if (!rows.length) return;

  const migrated = rows.map((row) => {
    let backbone: BackboneNode[] = [];
    try { backbone = JSON.parse(String(row.backbone || "[]")); } catch { /* empty below */ }
    backbone = backbone.map((node, index) => ({
      ...node,
      id: node.id != null && node.id !== "" ? String(node.id) : `node-${index + 1}`,
      anchorId: node.anchorId || semanticAnchorId(node.concept || ""),
    }));
    let takeaways: string[] = [];
    try { takeaways = JSON.parse(String(row.takeaways || "[]")); } catch { /* empty */ }
    const fallbackDispatch = createArgumentDispatch({
      coreQuestion: String(row.coreQuestion || ""),
      summary: String(row.summary || ""),
      nodes: backbone,
      takeaways,
      confidence: Number(row.templateConfidence || row.typeConfidence || 0),
      reason: row.renderData ? "phase0-argument-baseline" : "legacy-analysis-migration",
    });
    const hasRenderData = typeof row.renderData === "string" && row.renderData.trim().length > 0;
    return {
      row,
      backbone,
      template: hasRenderData ? String(row.template || "argument") : fallbackDispatch.template,
      confidence: hasRenderData
        ? Number(row.templateConfidence || row.typeConfidence || 0)
        : fallbackDispatch.confidence,
      downgrade: hasRenderData
        ? String(row.downgrade || JSON.stringify(fallbackDispatch.downgrade))
        : JSON.stringify(fallbackDispatch.downgrade),
      renderData: hasRenderData
        ? String(row.renderData)
        : JSON.stringify(fallbackDispatch.renderData),
    };
  });

  const byAsset = new Map(migrated.map((item) => [String(item.row.assetId), item.backbone]));
  const update = database.prepare(
    `UPDATE analyses
     SET backbone = ?, template = ?, templateConfidence = ?, downgrade = ?, renderData = ?, echoes = ?
     WHERE assetId = ?`,
  );
  for (const item of migrated) {
    let echoes: StoredEcho[] = [];
    try { echoes = JSON.parse(String(item.row.echoes || "[]")); } catch { /* empty */ }
    echoes = echoes.map((echo) => {
      const source = item.backbone[Number(echo.nodeIndex)];
      const targetNodes = echo.targetVideoId ? byAsset.get(echo.targetVideoId) : undefined;
      const target = targetNodes?.find((node) => node.timestamp === echo.timestampText);
      return {
        ...echo,
        sourceAnchorId: echo.sourceAnchorId || source?.anchorId || semanticAnchorId(source?.concept || ""),
        targetAnchorId:
          echo.targetAnchorId || target?.anchorId || semanticAnchorId(echo.oldSay || echo.targetTitle || ""),
      };
    });
    update.run(
      JSON.stringify(item.backbone),
      item.template,
      item.confidence,
      item.downgrade,
      item.renderData,
      JSON.stringify(echoes),
      String(item.row.assetId),
    );
  }
}

const now = () => new Date().toISOString();

export function createAsset(input: {
  sourceUrl: string;
  sourcePlatform?: string;
  title?: string;
  groupId?: string | null;
}): SourceAsset {
  const asset: SourceAsset = {
    id: randomUUID().slice(0, 8),
    type: "video",
    title: input.title ?? "",
    author: "",
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform ?? "",
    status: "uploaded",
    step: "排队中",
    errorMessage: "",
    duration: "",
    cover: "",
    groupId: input.groupId ?? null,
    bigCategoryId: null,
    collectionId: null,
    likeCount: null,
    collectCount: null,
    commentCount: null,
    shareCount: null,
    metricsSource: "",
    metricsFetchedAt: "",
    createdAt: now(),
    updatedAt: now(),
  };
  getDb()
    .prepare(
      `INSERT INTO source_assets
       (id,type,title,author,sourceUrl,sourcePlatform,status,step,errorMessage,duration,groupId,bigCategoryId,collectionId,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      asset.id, asset.type, asset.title, asset.author, asset.sourceUrl,
      asset.sourcePlatform, asset.status, asset.step, asset.errorMessage,
      asset.duration, asset.groupId, asset.bigCategoryId, asset.collectionId,
      asset.createdAt, asset.updatedAt
    );
  return asset;
}

export function updateAsset(
  id: string,
  patch: Partial<
    Pick<
      SourceAsset,
      | "title" | "author" | "status" | "step" | "errorMessage" | "duration"
      | "cover" | "bigCategoryId" | "collectionId"
      | "likeCount" | "collectCount" | "commentCount" | "shareCount"
      | "metricsSource" | "metricsFetchedAt"
    >
  >
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (!fields.length) return;
  const sets = fields.map((f) => `${f} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE source_assets SET ${sets}, updatedAt = ? WHERE id = ?`)
    .run(...fields.map((f) => patch[f] as string | number | null), now(), id);
}

export function getAsset(id: string): SourceAsset | null {
  const row = getDb()
    .prepare(`SELECT * FROM source_assets WHERE id = ?`)
    .get(id);
  return (row as unknown as SourceAsset) ?? null;
}

export function getAssetsByGroup(groupId: string): SourceAsset[] {
  const rows = getDb()
    .prepare(`SELECT * FROM source_assets WHERE groupId = ? ORDER BY createdAt`)
    .all(groupId);
  return rows as unknown as SourceAsset[];
}

export function listAssets(): SourceAsset[] {
  return getDb()
    .prepare(`SELECT * FROM source_assets ORDER BY createdAt`)
    .all() as unknown as SourceAsset[];
}

export function saveTranscript(assetId: string, fullText: string): void {
  getDb()
    .prepare(`INSERT INTO transcripts (id, assetId, fullText, createdAt) VALUES (?,?,?,?)`)
    .run(randomUUID(), assetId, fullText, now());
}

export function getTranscript(assetId: string): string | null {
  const row = getDb()
    .prepare(`SELECT fullText FROM transcripts WHERE assetId = ? ORDER BY createdAt DESC LIMIT 1`)
    .get(assetId) as { fullText: string } | undefined;
  return row?.fullText ?? null;
}

export function saveAnalysis(a: Analysis): void {
  const backbone = withSemanticAnchors(a.backbone);
  const dispatch = a.dispatch ?? createArgumentDispatch({
      coreQuestion: a.coreQuestion,
      summary: a.summary,
      nodes: backbone,
      takeaways: a.takeaways,
      confidence: a.typeConfidence,
    });
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO analyses
       (id, assetId, coreQuestion, videoType, typeConfidence, summary, backbone, takeaways,
        template, templateConfidence, downgrade, renderData, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      randomUUID(), a.assetId, a.coreQuestion, a.videoType, a.typeConfidence,
      a.summary, JSON.stringify(backbone), JSON.stringify(a.takeaways),
      dispatch.template, dispatch.confidence, JSON.stringify(dispatch.downgrade),
      JSON.stringify(dispatch.renderData), now()
    );
}

export function saveExpansion(assetId: string, expansion: CognitiveExpansion): void {
  getDb()
    .prepare(`UPDATE analyses SET cognitiveExpansion = ? WHERE assetId = ?`)
    .run(JSON.stringify(expansion), assetId);
}

export function saveCommentHeat(assetId: string, heat: CommentHeat): void {
  getDb()
    .prepare(`UPDATE analyses SET commentHeat = ? WHERE assetId = ?`)
    .run(JSON.stringify(heat), assetId);
}

export function saveEchoes(assetId: string, echoes: StoredEcho[]): void {
  getDb()
    .prepare(`UPDATE analyses SET echoes = ? WHERE assetId = ?`)
    .run(JSON.stringify(echoes), assetId);
}

/** 单独回填模板派发（Phase 1b 存量补判），backbone/回响/补缺原样不动。 */
export function saveDispatch(assetId: string, dispatch: AnalysisDispatch): void {
  getDb()
    .prepare(
      `UPDATE analyses SET template = ?, templateConfidence = ?, downgrade = ?, renderData = ? WHERE assetId = ?`
    )
    .run(
      dispatch.template, dispatch.confidence,
      JSON.stringify(dispatch.downgrade), JSON.stringify(dispatch.renderData),
      assetId
    );
}

export function upsertCollection(id: string, name: string, categoryId: string): void {
  getDb()
    .prepare(
      `INSERT INTO collections (id, name, categoryId, createdAt) VALUES (?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, categoryId = excluded.categoryId`
    )
    .run(id, name, categoryId, now());
}

/** mix 合集的原链接在 intake 时写入；upsertCollection 的冲突更新不会碰它。 */
export function setCollectionSourceUrl(id: string, sourceUrl: string): void {
  getDb().prepare(`UPDATE collections SET sourceUrl = ? WHERE id = ?`).run(sourceUrl, id);
}

export function getCollectionRow(id: string): CollectionRow | null {
  const row = getDb().prepare(`SELECT * FROM collections WHERE id = ?`).get(id);
  return (row as unknown as CollectionRow) ?? null;
}

/** 合集级跨视频合成（L6，finalizeMixGroup 收尾生成）。生成失败/单集合集时缺席。 */
export function saveSynthesis(collectionId: string, synthesis: Synthesis): void {
  getDb()
    .prepare(`UPDATE collections SET synthesis = ? WHERE id = ?`)
    .run(JSON.stringify(synthesis), collectionId);
}

export function getSynthesis(collectionId: string): Synthesis | null {
  const row = getDb()
    .prepare(`SELECT synthesis FROM collections WHERE id = ?`)
    .get(collectionId) as { synthesis?: string } | undefined;
  if (!row?.synthesis) return null;
  try {
    const parsed = JSON.parse(row.synthesis) as Synthesis;
    return parsed.points?.length ? parsed : null;
  } catch { return null; }
}

/** 清空合集的 L6 产物（合成/补缺）。成员搬走后旧产物引用已离开的视频，宁缺毋滥。 */
export function clearCollectionSynthesis(collectionId: string): void {
  getDb()
    .prepare(`UPDATE collections SET synthesis = '', collectionGap = '' WHERE id = ?`)
    .run(collectionId);
}

/** 合集级补缺（往旁看，L6 收尾生成）。门控为空/单集合集时缺席。 */
export function saveCollectionGapFill(collectionId: string, gapFill: CollectionGapFill): void {
  getDb()
    .prepare(`UPDATE collections SET collectionGap = ? WHERE id = ?`)
    .run(JSON.stringify(gapFill), collectionId);
}

export function getCollectionGapFill(collectionId: string): CollectionGapFill | null {
  try {
    const row = getDb()
      .prepare(`SELECT collectionGap FROM collections WHERE id = ?`)
      .get(collectionId) as { collectionGap?: string } | undefined;
    if (!row?.collectionGap) return null;
    const parsed = JSON.parse(row.collectionGap) as CollectionGapFill;
    return parsed.gap && parsed.fill ? parsed : null;
  } catch { return null; } // 旧 schema（列未迁移）或坏 JSON → 视为无补缺
}

/** 有归属（分类完成）的合集，按大类过滤；只返回内含 ≥1 条已解析视频的。 */
export function listCollections(categoryId?: string): CollectionRow[] {
  const where = categoryId ? `AND c.categoryId = ?` : "";
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT c.* FROM collections c
       JOIN source_assets a ON a.collectionId = c.id AND a.status = 'analyzed'
       WHERE 1=1 ${where} ORDER BY c.createdAt`
    )
    .all(...(categoryId ? [categoryId] : []));
  return rows as unknown as CollectionRow[];
}

export function listAssetsByCollection(collectionId: string): SourceAsset[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM source_assets WHERE collectionId = ? AND status = 'analyzed' ORDER BY createdAt`
    )
    .all(collectionId);
  return rows as unknown as SourceAsset[];
}

/** 经济、历史、科技之外的已解析内容，统一进入世界地图的“未知海域”。 */
export function listUnknownSeaAssets(): SourceAsset[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM source_assets
       WHERE status = 'analyzed'
         AND (bigCategoryId IS NULL OR bigCategoryId NOT IN ('eco', 'his', 'tech'))
       ORDER BY createdAt`
    )
    .all();
  return rows as unknown as SourceAsset[];
}

/** 首页搜索：在已解析资产里按标题/作者/核心问题/合集名 LIKE 匹配。 */
export interface AssetSearchHit {
  id: string;
  title: string;
  author: string;
  coreQuestion: string;
  /** eco/his/tech；其余大类与未分类统一归"未知海域"，返回 null。 */
  categoryId: MappedRegionCategoryId | null;
  collectionName: string;
}

export function searchAnalyzedAssets(query: string, limit = 20): AssetSearchHit[] {
  const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.title, s.author, s.bigCategoryId,
              COALESCE(a.coreQuestion, '') AS coreQuestion,
              COALESCE(c.name, '') AS collectionName
       FROM source_assets s
       LEFT JOIN analyses a ON a.assetId = s.id
       LEFT JOIN collections c ON c.id = s.collectionId
       WHERE s.status = 'analyzed'
         AND (s.title LIKE ? ESCAPE '\\' OR s.author LIKE ? ESCAPE '\\'
              OR a.coreQuestion LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')
       ORDER BY s.createdAt DESC LIMIT ?`
    )
    .all(like, like, like, like, limit) as Record<string, string | null>[];
  return rows.map((r) => {
    const mapped = isMappedRegionCategory(r.bigCategoryId as string | null);
    return {
      id: r.id as string,
      title: (r.title as string) || "未命名视频",
      author: (r.author as string) ?? "",
      coreQuestion: (r.coreQuestion as string) ?? "",
      categoryId: mapped ? (r.bigCategoryId as MappedRegionCategoryId) : null,
      // 未知海域没有区域地图，不让 misc-soc/misc-sci 的合集名泄漏到搜索结果
      collectionName: mapped ? ((r.collectionName as string) ?? "") : "",
    };
  });
}

/** 回响召回基准：全部已解析资产的脉络（排除指定资产自己）。 */
export interface RecallSource {
  assetId: string;
  title: string;
  author: string;
  backbone: BackboneNode[];
}

export function listRecallSources(excludeAssetId: string): RecallSource[] {
  const rows = getDb()
    .prepare(
      `SELECT a.assetId, s.title, s.author, a.backbone FROM analyses a
       JOIN source_assets s ON s.id = a.assetId
       WHERE s.status = 'analyzed' AND a.assetId != ? ORDER BY s.createdAt`
    )
    .all(excludeAssetId) as Record<string, string>[];
  return rows.map((r) => ({
    assetId: r.assetId,
    title: r.title,
    author: r.author,
    backbone: JSON.parse(r.backbone || "[]"),
  }));
}

/** 地图是否已有真实内容（有归属的已解析视频）——有则地图层展示真实数据。 */
export function hasRealMapContent(): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM source_assets WHERE status = 'analyzed' AND collectionId IS NOT NULL LIMIT 1`
    )
    .get();
  return !!row;
}

export function getAnalysis(assetId: string): Analysis | null {
  const row = getDb()
    .prepare(`SELECT * FROM analyses WHERE assetId = ?`)
    .get(assetId) as Record<string, unknown> | undefined;
  if (!row) return null;
  let cognitiveExpansion: CognitiveExpansion | undefined;
  try {
    const raw = row.cognitiveExpansion as string | undefined;
    if (raw) cognitiveExpansion = JSON.parse(raw);
  } catch { /* 坏 JSON 视同未生成 */ }
  let commentHeat: CommentHeat | undefined;
  try {
    const raw = row.commentHeat as string | undefined;
    if (raw) commentHeat = JSON.parse(raw);
  } catch { /* 坏 JSON 视同未生成 */ }
  let echoes: StoredEcho[] = [];
  try {
    const raw = row.echoes as string | undefined;
    if (raw) echoes = JSON.parse(raw);
  } catch { /* 坏 JSON 视同没有回响 */ }
  const backbone = (JSON.parse(row.backbone as string) as BackboneNode[]).map((node) => ({
    ...node,
    anchorId: node.anchorId || semanticAnchorId(node.concept),
  }));
  const takeaways = JSON.parse(row.takeaways as string) as string[];
  let dispatch = createArgumentDispatch({
    coreQuestion: row.coreQuestion as string,
    summary: row.summary as string,
    nodes: backbone,
    takeaways,
    confidence: Number(row.templateConfidence || row.typeConfidence || 0),
    reason: "phase0-argument-baseline",
  });
  try {
    const downgrade = JSON.parse(String(row.downgrade || "{}"));
    const template = ANALYSIS_TEMPLATES.includes(row.template as AnalysisTemplate)
      ? (row.template as AnalysisTemplate)
      : "argument";
    const candidate: AnalysisDispatch = {
      template,
      confidence: Number(row.templateConfidence || 0),
      downgrade: {
        template: "argument",
        reason: String(downgrade?.reason || "unsupported-or-incomplete-template"),
      },
      renderData: JSON.parse(String(row.renderData || "{}")),
    };
    if (
      template === "argument" &&
      !(candidate.renderData && "nodes" in candidate.renderData && candidate.renderData.nodes?.length)
    )
      throw new Error("empty argument renderData");
    dispatch = candidate;
  } catch { /* use normalized argument dispatch */ }
  return {
    assetId: row.assetId as string,
    coreQuestion: row.coreQuestion as string,
    videoType: row.videoType as string,
    typeConfidence: row.typeConfidence as number,
    summary: row.summary as string,
    backbone,
    takeaways,
    dispatch,
    cognitiveExpansion,
    commentHeat,
    echoes,
  };
}

/* 解析完成的资产 → 解析页可渲染的形状（脉络节点 = backbone，
   回响按 nodeIndex 挂回节点；认知拓展生成失败时缺席）。 */
export interface ParsedVideo {
  id: string;
  title: string;
  creator: string;
  duration: string;
  cover: string;
  sourceUrl: string;
  collectionId: string | null;
  coreQuestion: string;
  videoType: string;
  typeConfidence: number;
  dispatch: AnalysisDispatch;
  nodes: { id: string; anchorId: string; label: string; role?: string; timestampText: string; detail: string; echo?: Echo }[];
  cognitiveExpansion?: CognitiveExpansion;
  commentHeat?: CommentHeat;
}

export function getParsedVideo(id: string): ParsedVideo | null {
  const asset = getAsset(id);
  if (!asset || asset.status !== "analyzed") return null;
  const analysis = getAnalysis(id);
  if (!analysis) return null;
  const echoByIndex = new Map(
    (analysis.echoes ?? []).map(({ nodeIndex, ...echo }) => [nodeIndex, echo])
  );
  return {
    id: asset.id,
    title: asset.title || "未命名视频",
    creator: asset.author,
    duration: asset.duration,
    cover: asset.cover,
    sourceUrl: asset.sourceUrl,
    // 社会思想、自然科学及未分类内容统一属于“未知海域”。未知海域没有
    // 区域地图，因此不能让旧的 misc-soc/misc-sci 归属泄漏到解析页导航。
    collectionId: isMappedRegionCategory(asset.bigCategoryId) ? asset.collectionId : null,
    coreQuestion: analysis.coreQuestion,
    videoType: analysis.videoType,
    typeConfidence: analysis.typeConfidence,
    dispatch: analysis.dispatch ?? createArgumentDispatch({
      coreQuestion: analysis.coreQuestion,
      summary: analysis.summary,
      nodes: analysis.backbone,
      takeaways: analysis.takeaways,
      confidence: analysis.typeConfidence,
    }),
    nodes: analysis.backbone.map((n, i) => ({
      // 管线落库的 id 可能是数字（JSON 无类型约束），归一成字符串才能和 URL 里的 nodeId 对上
      id: n.id != null && n.id !== "" ? String(n.id) : `${asset.id}-n${i + 1}`,
      anchorId: n.anchorId || semanticAnchorId(n.concept),
      label: n.concept,
      role: n.role,
      timestampText: n.timestamp,
      detail: n.detail,
      echo: echoByIndex.get(i),
    })),
    cognitiveExpansion: analysis.cognitiveExpansion,
    commentHeat: analysis.commentHeat,
  };
}
