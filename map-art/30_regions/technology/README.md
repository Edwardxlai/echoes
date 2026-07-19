# 科技区域美术资源交接

更新时间：2026-07-17

## 结论

`technology` 目录同时保留了旧版、过渡版和新版资源。后续生成或接入时，必须以新版主板块 `R01_technology_region_terrain_chromakey_v03.png` 为唯一构图基准，不要把同名地标的 `v01` 和 `v02` 混用。

当前前端也仍是混合状态：

- 主地形使用新版 `region_technology_terrain_default_lod1_v03.webp`。
- 材料与能源花园使用新版资源。
- 科学论坛、计算织机、工程试验场、信号观测站仍指向旧版 `lod1_v01.webp`。
- 当前合集使用的 `misc-tech v02` 是过渡资源，不是本轮生成资源。

本轮只保存了新源图和透明母版，没有导出新的运行时 WebP，也没有修改前端引用。

## 新版主板块基准

以下文件属于当前新版基准，可以继续使用：

| 用途 | 文件 | 状态 |
| --- | --- | --- |
| 新版科技主板块色键源图 | `source/R01_technology_region_terrain_chromakey_v03.png` | 新版；与用户提供的第二张图完全一致 |
| 新版科技主板块透明母版 | `terrain/R01_technology_region_terrain_alpha_v03.png` | 由新版源图去底得到 |
| 新版科技主板块运行时图 | `../../../../web/public/map-runtime/regions/technology/terrain/region_technology_terrain_default_lod1_v03.webp` | 当前前端正在使用 |
| 材料与能源花园色键源图 | `source/R06_technology_landmark_materials-energy-garden_chromakey_v01.png` | 新版；与用户提供的第一张图完全一致 |
| 材料与能源花园透明母版 | `landmarks/R06_technology_landmark_materials-energy-garden_alpha_v01.png` | 新版 |
| 材料与能源花园运行时图 | `../../../../web/public/map-runtime/regions/technology/landmarks/region_technology_landmark_future-materials-energy-garden_lod1_v01.webp` | 新版运行时资源 |

## 2026-07-17 本轮新增地标

这四组 `v02` 是本轮按新版主板块和材料与能源花园作为参考重新生成的。每组都保留了色键源图和去底后的透明 PNG。

| 地标 | 色键源图 | 透明母版 | 接入状态 |
| --- | --- | --- | --- |
| 科学论坛 | `source/R02_technology_landmark_science-forum_chromakey_v02.png` | `landmarks/R02_technology_landmark_science-forum_alpha_v02.png` | 未导出运行时图 |
| 计算织机 | `source/R03_technology_landmark_computation-loom_chromakey_v02.png` | `landmarks/R03_technology_landmark_computation-loom_alpha_v02.png` | 未导出运行时图 |
| 工程试验场 | `source/R04_technology_landmark_engineering-testworks_chromakey_v02.png` | `landmarks/R04_technology_landmark_engineering-testworks_alpha_v02.png` | 未导出运行时图；画面内有两辆小型轨道车，接入前需确认是否保留 |
| 信号观测站 | `source/R05_technology_landmark_signal-observatory_chromakey_v02.png` | `landmarks/R05_technology_landmark_signal-observatory_alpha_v02.png` | 未导出运行时图 |

这四张透明母版已经完成色键去除，但尚未逐张叠加到新版主板块的空台座上做位置、比例和边缘验收。

## 旧版资源：不要与新版主板块混用

以下内容来自 2026-07-15 的旧地图生产批次，构图基准、尺寸和台座逻辑均早于新版主板块：

- `source/R01_technology_region_environment_source_v01.png`
- `source/R02_technology_landmark_science-forum_chromakey_v01.png`
- `source/R03_technology_landmark_computation-loom_chromakey_v01.png`
- `source/R04_technology_landmark_engineering-testworks_chromakey_v01.png`
- `source/R05_technology_landmark_signal-observatory_chromakey_v01.png`
- `landmarks/R02_technology_landmark_science-forum_alpha_v01.png`
- `landmarks/R03_technology_landmark_computation-loom_alpha_v01.png`
- `landmarks/R04_technology_landmark_engineering-testworks_alpha_v01.png`
- `landmarks/R05_technology_landmark_signal-observatory_alpha_v01.png`
- `review/` 下全部 `v01` 审核图和分区测试图
- `fog/` 下全部现有六区遮罩、迷雾、遮挡和边缘雾文件
- `web/public/map-runtime/regions/technology/landmarks/` 下四张 `future-*-lod1_v01.webp`：科学论坛、计算织机、工程试验场、信号观测站

旧版 `fog/` 文件是按 1586×992 的旧母版制作的，不能直接套在 1672×941 的新版 `v03` 主板块上。新版战争迷雾需要按新版六个台座重新制图或改为代码生成。

## 过渡资源：必须单独确认

以下 `misc-tech v02` 生成时间早于新版 `v03` 主板块，也不是本轮生成资源：

- `source/R02_technology_landmark_misc-tech_chromakey_v02.png`
- `landmarks/R02_technology_landmark_misc-tech_alpha_v02.png`
- `web/public/map-runtime/regions/technology/landmarks/region_technology_landmark_misc-tech_lod1_v02.webp`

它的风格和色键方向接近新版，但没有以新版六个台座为明确参考。接入新版系统前，应先做一次叠加验收；如果比例或底座对不上，再把它作为第六个待重生成地标。

`source/R01_technology_region_terrain_chromakey_v02.png` 和 `terrain/R01_technology_region_terrain_alpha_v02.png` 也属于被 `v03` 替代的过渡主板块，不再作为生成基准。

## 六个位置的正确理解

新版主板块上的六个圆形空台座是总容量，不是“已有地标之外再加六个位置”。地标资源会覆盖这些台座：

- 已占用位置显示对应地标。
- 未占用位置必须被战争迷雾完整遮住，不能露出空台座。
- 新合集加入时，从未占用位置中分配一个槽位，散开该位置迷雾并显示地标。
- 不要继续在主板块上增加新的空洞或台座。

当前代码中预设了五个 future slots；第六个位置由当前实际合集 `misc-tech / c4` 使用。

## 后续生成统一参考

若需要重做 `misc-tech` 或制作新地标，参考图按以下顺序提供：

1. `source/R01_technology_region_terrain_chromakey_v03.png`：唯一地图、视角、色盘和台座基准。
2. `source/R06_technology_landmark_materials-energy-garden_chromakey_v01.png`：新版地标的体量、材质、细节密度和洋红色背景基准。
3. 对应旧地标图：只用于说明题材，不继承旧版岛屿构图、绿色背景或整体尺寸。

通用提示词骨架：

```text
Use case: stylized-concept
Asset type: modular isometric game-map landmark for the technology region
Primary request: create one compact plug-in landmark that visually occupies one empty circular plaza in the new technology-region master map.
Style/medium: polished hand-painted 3D isometric fantasy strategy-game environment asset; ivory limestone, pale cyan-blue glass, fine muted-gold trim; match the new master map and the approved materials-energy-garden asset.
Composition/framing: a single centered self-contained landmark cluster; matching three-quarter isometric view from above; coherent round or oval stone podium; compact footprint; generous clear padding; do not create a full map, city, floating island, or surrounding landscape.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background, edge to edge.
Constraints: uniform background; no gradient, texture, horizon, floor plane, haze, or cast shadow outside the podium; no text, people, UI, watermark, logo, or cropped architecture; do not use #ff00ff in the subject.
Avoid: neon sci-fi, dark metal, steampunk grime, giant island terrain, disconnected landmarks, green background.
```

## 去底命令

色键图生成后先保留在 `source/`，再输出透明母版到 `landmarks/`：

```powershell
python "$env:USERPROFILE\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <source-image.png> `
  --out <alpha-image.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

## 推荐的下一步

1. 先把本轮四张 `v02` 透明母版逐张叠加到新版六个台座，确认比例、锚点和边缘。
2. 单独验收 `misc-tech v02`；决定复用还是重生成。
3. 按新版主板块重做六区战争迷雾，旧 `fog/` 不复用。
4. 通过验收后再统一导出 WebP，并一次性把前端从旧 `future-*-lod1_v01.webp` 切换到新版资源。

