# 回响地图美术源工程

`map-art/` 是地图美术的**生产源仓库**：保存风格参考、生成源图、透明成品、技术图、审核图和生产记录。前端不直接读取这里的文件；确认投入使用后，统一导出到 `web/public/map-runtime/`。

> 结构快照：2026-07-17，共 294 个文件（277 PNG、1 WebP、2 NPY、14 Markdown），约 292 MB。

## 项目结构

```text
map-art/
├─ README.md                         # 本结构说明与入口
│
├─ 00_style/                         # 视觉规范与历史参考（11）
│  ├─ style-prompt.md                # 全地图统一风格前缀、色彩和禁用项
│  └─ reference-t00/                 # T00 早期风格试验，只读归档
│     └─ source/                     # 场景、海空、地标、云、水纹参考（10）
│
├─ 20_world/                         # 世界地图层（57）
│  ├─ README.md                      # 世界层资源说明
│  ├─ source/                        # 世界母版、海空底、大陆、区域与地标源图（18）
│  ├─ technical/                     # 高度、接触阴影、区域遮罩、海岸层（8）
│  ├─ review/                        # 世界分层、区域遮罩、环境质量验收图（4）
│  └─ expansion/                     # 外围未开放岛屿（26）
│     ├─ README.md                   # 扩展岛屿说明
│     ├─ review/                     # A/B 双岛合成验收图（1）
│     ├─ island-a/
│     │  ├─ task-card.md             # 生成提示词与交付记录
│     │  ├─ source/                  # 色键源图、透明岛体（2）
│     │  ├─ technical/               # 阴影、海岸、高度、遮罩（6）
│     │  └─ review/                  # 默认、锁定、岛体验收图（3）
│     └─ island-b/                   # 与 island-a 相同结构（12）
│
├─ 30_regions/                       # 分类区域地图（185）
│  ├─ economy/                       # 经济区域（75）
│  │  ├─ collections/                # 早期合集全景概念参考（4）
│  │  ├─ source/                     # 环境、地形、地标色键源图（19）
│  │  ├─ terrain/                    # 透明区域地形（4）
│  │  ├─ landmarks/                  # 透明合集地标（12）
│  │  ├─ fog/                        # 六分区遮罩、雾、遮挡、边界雾（31）
│  │  └─ review/                     # 分区、解锁状态和透明度验收图（5）
│  ├─ history/                       # 历史区域（44）
│  │  ├─ README.md                   # 主题、提示词和交互说明
│  │  ├─ source/                     # 环境与地标色键源图（23）
│  │  └─ landmarks/                  # 透明历史地标（20）
│  └─ technology/                    # 科技区域（66）
│     ├─ source/                     # 环境、地形、地标色键源图（13）
│     ├─ terrain/                    # 透明区域地形（2）
│     ├─ landmarks/                  # 透明科技地标（10）
│     ├─ fog/                        # 六分区遮罩、雾、遮挡、边界雾（31）
│     └─ review/                     # 分区、地标和切分测试图（10）
│
├─ 50_archipelago/                   # 合集内视频群岛，占位中（0）
│  ├─ c1/
│  ├─ c2/
│  ├─ c3/
│  └─ c4/
│
├─ 60_common/                        # 世界与区域共享模块（34）
│  ├─ clouds/                        # 远、中、前景云
│  │  ├─ source/                     # 生成原图和色键图（6）
│  │  ├─ atlas/                      # 三层透明云图集（3）
│  │  ├─ review/                     # 云层合成验收图（1）
│  │  └─ *.png                       # 已拆分透明云与旧版 LOD 候选（15）
│  ├─ water/                         # 水面、水纹与材质参考
│  │  ├─ source/                     # 水面母版、水纹色键图（2）
│  │  ├─ technical/                  # 流向、法线、粗糙度参考（3）
│  │  ├─ atlas/                      # 透明水纹图集（1）
│  │  ├─ review/                     # 水面包验收图（1）
│  │  └─ W09_*/world_*               # 已处理底色与旧版运行候选（2）
│  └─ states/                        # 通用状态效果，占位中（0）
│
└─ config/                           # 生产规范与追溯记录（6）
   ├─ task-card-template.md          # 美术任务卡模板
   ├─ world_art_supplement_v01.md    # 世界环境补充任务与回传
   └─ logs/
      ├─ intake-template.md          # 入库记录模板
      ├─ W-batch1_intake_v01.md      # 第一批世界源图验收
      ├─ W-batch2_generated_world_regions_v01.md
      └─ W-P0_environment_generated_v01.md
```

括号内数字是该目录及其子目录的当前文件总数；根目录的 `README.md` 单独计算。

## 结构表

| 层级 | 路径 | 放什么 | 不放什么 | 当前状态 |
|---|---|---|---|---|
| 规范层 | `00_style/` | 风格提示词、历史参考 | 正式运行资源 | T00 已归档；统一风格提示词有效 |
| 世界层 | `20_world/source/` | 世界母版、生成原图、色键源图 | 前端直接引用文件 | 已形成世界基础包 |
| 世界技术层 | `20_world/technical/` | 高度、阴影、区域 mask、海岸 alpha | 纯视觉参考图 | 已导出到运行目录 |
| 世界审核层 | `20_world/review/` | 合成预览、验收截图 | 页面运行资源 | 只供人工检查 |
| 世界扩展层 | `20_world/expansion/` | 外围岛屿完整生产包 | 三大分类区域资源 | A/B 两岛已接入世界清单，当前锁定 |
| 区域层 | `30_regions/<category>/source/` | 区域环境和地标生成源图 | 最终压缩资源 | 经济、历史、科技均已有源图 |
| 区域成品层 | `terrain/`、`landmarks/`、`fog/` | 真透明地形、地标和探索状态层 | 色键原图 | 各分类完成度不一致，见下表 |
| 群岛层 | `50_archipelago/` | 合集内视频岛屿的未来源资产 | 世界外围岛屿 | 仅有 c1–c4 空目录 |
| 共享层 | `60_common/` | 云、水、通用状态效果 | 分类专属地标 | 云和水已使用；states 待建 |
| 记录层 | `config/` | 任务卡、Prompt、批次验收、入库结论 | 图片资源 | 世界批次记录较完整，区域记录仍分散 |
| 运行层 | `web/public/map-runtime/` | 前端实际加载的压缩资源 | 母版、候选、审核图 | 当前正式运行目录，不属于 `map-art/` |

## 各模块完成度

| 模块 | 源图 | 技术/透明层 | 审核图 | 已导出运行资源 | 说明 |
|---|---:|---:|---:|---:|---|
| 世界主体 | 有 | 有 | 有 | 是 | 由 `WORLD_MANIFEST` 组织环境、地形、海岸、水、云和区域层 |
| 外围岛 A/B | 有 | 有 | 有 | 是 | 已作为 `expansionIslands` 接入，当前为锁定状态 |
| 经济区域 | 有 | 有 | 有 | 是 | 地形、3 个现役地标及六分区雾层已运行 |
| 历史区域 | 有 | 地标有；独立 fog/terrain 目录缺失 | 文档有；review 目录缺失 | 是 | 运行目录已有环境与 4 类地标 |
| 科技区域 | 有 | 有 | 有 | 是 | 地形与地标已运行；源工程有 fog，运行目录暂未见 fog |
| 视频群岛 | 无 | 无 | 无 | 否 | `c1`–`c4` 只是结构占位 |
| 云与水 | 有 | 有 | 有 | 是 | 由世界场景清单和地图样式引用 |
| 通用状态 | 无 | 无 | 无 | 否 | `60_common/states/` 为空 |

## 文件夹语义

同一个资产按下面的生产顺序流动：

```text
style/reference
      ↓
source（母版、生成原图、色键图、可返工文件）
      ↓
technical / terrain / landmarks / fog / atlas（加工后的可组合图层）
      ↓
review（只用于人工验收的合成图）
      ↓
web/public/map-runtime（前端使用的 WebP/必要 PNG）
      ↓
场景清单或组件引用
```

| 目录名 | 固定含义 |
|---|---|
| `source/` | 可追溯、可返工的源图；包括母版、生成原图和色键背景图 |
| `technical/` | 与视觉层配套的 mask、高度、阴影、法线、粗糙度、流向等技术图 |
| `terrain/` | 已处理为真透明、可叠加的区域地形 |
| `landmarks/` | 已处理为真透明、可独立摆放的地标 |
| `fog/` | 未探索区 mask、雾、遮挡、剪影和边界雾 |
| `atlas/` | 可切分或采样的图集 |
| `review/` | 仅供验收的合成图、接触表或测试图，禁止前端直接引用 |
| `collections/` | 早期合集主题概念参考，不是正式区域地图层 |

## 编号与命名

### 任务编号

| 前缀 | 范围 | 示例 |
|---|---|---|
| `T00` | 早期风格试验 | `T00-04_cloud_far_01_v01.png` |
| `W` | 世界主体与共享环境 | `W03_world_connected_terrain_alpha_v01.png` |
| `WX` | 世界外围扩展岛屿 | `WX-A_world_expansion_terrain_alpha_v01.png` |
| `R` | 分类区域、地标和探索状态 | `R04_technology_landmark_engineering-testworks_alpha_v02.png` |
| `C` | 早期合集概念图 | `C02_financial-titans_environment_source_v01.png` |

### 文件状态词

| 标记 | 含义 |
|---|---|
| `source` | 生成原图或母版 |
| `chromakey` | 色键背景源图，仍需去背 |
| `alpha` | 已具有真实透明通道 |
| `mask` | 二值或灰度范围遮罩 |
| `review` | 人工验收图，不进入运行时 |
| `draft` | 草稿，不应导出 |
| `candidate` | 候选，需明确批准后再导出 |
| `default` / `locked` | 默认状态 / 未开放锁定状态 |
| `lod1` | 当前网页运行精度 |
| `v01`、`v02`… | 资产版本；新版本不覆盖旧文件 |

运行时文件继续使用：

```text
[level]_[scene]_[object]_[variant]_lod1_[version].webp
```

例如：

```text
region_history_landmark_archive-citadel_lod1_v02.webp
world_expansion-island-a_terrain_default_lod1_v01.webp
```

## 前端对应关系

| 内容 | 运行目录 | 主要引用入口 |
|---|---|---|
| 世界主体、云、水、海岸、外围岛 | `web/public/map-runtime/world/` | `web/lib/map-scene/manifests/world.ts` |
| 经济、历史、科技区域 | `web/public/map-runtime/regions/` | `web/components/map/RegionTerrain.tsx` |
| 旧版世界焦点图 | `web/public/map/world/` | `web/lib/map-config.ts` 中仍有兼容引用 |

当前同时保留 `map/` 与 `map-runtime/` 两套前端资源根目录：前者是旧版整图兼容资源，后者是现在的分层运行资源。新增和重制资产统一进入 `map-runtime/`。

## 入库规则

- `map-art/` 保留 PNG/NPY 源资产和高分辨率母版；前端确认使用后才导出到 `map-runtime/`。
- 需要透明层的生成图必须经过抠图并验证真实 alpha，不能接受画出来的棋盘格。
- `review/` 中的图片一律不作为运行资源。
- `draft` 和 `candidate` 不进入运行目录；通过版本另存为明确的正式版本。
- 每个正式资产至少要能追溯来源、用途、尺寸、模型或处理方式、Prompt、版本和验收结论。
- 暖金只属于“回响”状态；普通建筑、道路、水纹和地标不得使用暖金强调。
- 不直接移动或改名已被前端引用的文件；先更新运行资源和引用，再清理旧版本。

## 当前已知结构例外

- 旧 README 曾写有 `00_style/approved/`，但当前实际不存在该目录；已从结构中移除。
- `history/` 尚未形成与 economy/technology 完全相同的 `terrain/fog/review` 源工程结构。
- `60_common/clouds/` 和 `60_common/water/` 根目录还保留少量已处理候选，后续新增资源应优先放入明确的功能子目录。
- `30_regions/` 的正式资产较多，但区域级任务卡和批次验收记录没有全部集中到 `config/logs/`。
- 品牌资源不属于地图源工程，统一维护在 `web/public/brand/`。
