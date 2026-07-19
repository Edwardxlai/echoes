# 知音（原名：回响 · Echoes）

> 把"看过"变成"拥有"。

输入一条抖音视频或合集链接，知音不只复述内容，而是把这条"知识切片"四周的断口接起来：

| 断口 | 用户的问题 | 知音的回答 |
|------|-----------|-----------|
| 它自身的逻辑 | 我真的看懂了吗？ | **脉络**：核心问题 + 4~7 概念节点的瘦骨架（五类骨架：论证/叙事/介绍/对比/概念） |
| 它欠你的背景 | 我漏了什么？ | **补缺**：戳破视频的承重空洞，补上外部背景 |
| 你已有的知识 | 它跟我看过的什么有关？ | **回响**：相关旧节点发光，AI 一句话说清怎么相关（双向：新旧视频互相反写） |
| 下一步 | 然后呢？ | **延伸 + 同题讨论**：更深的问题，和正在想同一个问题的人 |

内容不再刷完就沉底，而是接进你已有的知识里。单视频解决"现在就有用"，跨视频（回响 + 合集合成）解决"越用越离不开"。

> 项目目录与代码标识沿用早期代号 `echoes`，产品名已定稿为**知音**（2026-07）。"回响"保留为核心功能名（Echo）。

## 技术架构

项目分两块：正式产品 `web/`，以及验证"链接→解析→ASR"通路的独立管线测评 `eval/`。

### 正式产品 `web/`（Next.js 16 + React 19）

**页面路由**（三层地图导航 + 三个非地图页面）：

| 路由 | 页面 | 单位 |
|------|------|------|
| `/` | 世界地图页（Hero + 链接输入框） | 内容大类（经济/历史/科技） |
| `/category/[categoryId]` | 区域地图页 | 合集 |
| `/collection/[collectionId]` | 群岛地图页 | 单个视频 |
| `/video/[videoId]` | 视频解析页（脉络 + 回响 + 认知拓展） | — 非地图 |
| `/collection/[collectionId]/synthesis` | 合集解析页（跨视频合成） | — 非地图 |
| `/topic/[topicId]` | 同题讨论页（seed 议题 + 真实发帖，可引用原文/选集） | — 非地图 |
| `/parsing/[assetId]`、`/parsing/group/[groupId]` | 解析进度页（单条 / 多条一组） | — |

**解析管线**（`web/lib/server/pipeline.ts`，抖音 + 直链，全部真实调用）：

```
链接 → 直链解析（parse-video sidecar；合集经游客 cookie 枚举）→ 下载 → ffmpeg 抽音频
     → 火山豆包 ASR → DeepSeek 瘦脉络（L1/L2，五类骨架硬约束）
     → L5 回响（bigram 召回 + LLM 复核；L5b 反向写回旧节点）
     → L4 认知拓展（补缺 + 延伸）→ L3 大类归属 → 归入合集 / 散篇集自动聚类
     → L6 合集合成（跨视频知识点 + 溯源，聚类迁移后自动刷新）
```

各 AI 层独立容错，上层失败不拖垮脉络。密钥单一来源 `eval/.env`（不复制进 web，dev 下热生效）。

**存储**：SQLite（`web/lib/server/store.ts`），五张表 `source_assets / transcripts / analyses / collections / topic_posts`。

**地图渲染**：React Three Fiber（`three` + `@react-three/fiber` + `drei`）+ 水面 shader，zustand 管相机状态；真实解析数据经 `web/lib/server/real-data.ts` 转成三层可渲染形状（槽位坐标按入库顺序固定分配，不做力导向重排）。美术源稿在 `map-art/`（不被前端加载），运行时成品在 `web/public/map*`。

### 解析管线测评 `eval/` + `scripts/`

独立零依赖，验证"链接→解析→ASR"主通路。依赖 Node 20+、ffmpeg、`wujunwei928/parse-video` docker sidecar、火山豆包 ASR key、DeepSeek key。

## 快速开始

### 跑正式产品

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

> 用 `localhost` 访问，不要用 `127.0.0.1`（Next 16 dev 下会被跨域拦截导致整页不 hydrate）。

要跑真实解析，先复制 `eval/.env.example` 为 `eval/.env`，填入豆包 ASR key、DeepSeek key、sidecar 地址（web 与 eval 共用这一份）。

### 一键启动（sidecar + eval + web）

```bash
# 根目录：拉起抖音解析 docker sidecar + eval 服务（:6060）+ web 前端（:3000）
npm run dev
```

## 目录结构

```
echoes/
├── web/                 # 正式产品（Next.js 16 + React 19）
│   ├── app/             # 页面路由（见上表）+ api/*（parse/rerun-*/recluster/topic-post 等）
│   ├── components/      # map（三层地图）/ reader（脉络/回响/认知拓展）/ topic（讨论）
│   ├── lib/             # data.ts 种子 + server/（store/pipeline/real-data/discussion）
│   └── public/          # 地图运行时成品、品牌、视频封面
├── eval/                # 解析+ASR 管线测评（独立零依赖）
├── scripts/             # 一键启动、灌数据、封面回填等辅助脚本
├── map-art/             # 地图美术源图/审核稿/共享模块（不被前端直接加载）
├── prototype/           # 早期静态 HTML demo（仅参考，非生产代码）
└── docs/                # PRD、设计文档、架构表、美术资源手册
```

想改某个功能却不知道动哪个文件？见 **[docs/项目架构表.md](docs/项目架构表.md)**。

## 文档

- [PRD 完整版 V1.2](docs/PRD_知音_完整版_V1.2.md) — 当前权威产品需求（含更名与现状同步记录）
- [项目架构表](docs/项目架构表.md) — "某功能该改哪个文件"的快速索引
- [产品概念](docs/产品概念.md) — 为什么这么做：思路、约束推理、Demo 策略
- [设计文档](docs/设计文档.md) — 信息架构、页面详解、视觉方向

## 状态

产品名定稿"知音"。真实数据全量灌入：47 条视频上地图 / 60 条回响 / 4 个合集，跨视频合成（L6）与双向回响已实现并回填；同题讨论页（/topic）P0 已落地，议题列表页为 P1。当前主战场为世界/区域地图的美术资源接入与动效打磨。
