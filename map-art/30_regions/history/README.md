# 历史区域地图资源

> 生成日期：2026-07-15  
> 生成方式：OpenAI 内置 `imagegen`  
> 视觉主题：史料显影，灰紫迷雾中的连续历史地貌

## 资源结构

- `source/R01_history_region_environment_source_v01.png`：历史区域环境源图。
- `source/R02-R05_*_chromakey_v01.png`：四类地标绿幕源图。
- `landmarks/R02-R05_*_alpha_v01.png`：本地去绿后的透明源图。
- `web/public/map-runtime/regions/history/terrain/`：1586 × 992 运行时环境 WebP。
- `web/public/map-runtime/regions/history/landmarks/`：四类透明运行时地标 WebP。

## 地标原型

1. 档案城垒：层叠阅览庭院、档案穹顶与不对称藏书建筑群。
2. 考古阶地：发掘沟、旧地基、残缺剧场与断裂拱门。
3. 编年观测塔：高塔、八角图书室与时间比较露台。
4. 古道门与纪念遗迹：三向旧路、门楼、碑石与残墙。

地标按合集出现顺序循环分配。位置由数据槽位决定，因此不同用户会因自己的合集数量、创建顺序和内容而形成不同地图。

## 生成提示词

### 环境母版

```text
Use case: stylized-concept
Asset type: production game environment base for the History category map
Input images: world map as the authoritative style and scale reference; economy regional terrain as density reference only, excluding its circular reserved pads and layout.
Primary request: one continuous historical knowledge region under dynamic data-driven landmarks and fog-of-discovery overlays.
Scene: shallow pale-cyan sea, ivory layered cliffs, old river valleys, archaeological terraces, archive gardens, broken roads, stone bridges, excavation fields, modest ruins and ordinary settlements.
Style: bright premium 2.5D miniature world, restrained watercolor gouache and colored-pencil texture, approximately 30-degree orthographic view, soft upper-left daylight.
Composition: 16:10, six naturally quieter but fully landscaped discovery neighborhoods, no empty slots.
Palette: gray-mauve, dusty rose, warm old stone, muted olive and ivory.
Avoid: hero landmarks, circular platforms, panels, empty holes, text, UI, gold, dark fantasy and deep navy sea.
```

### 四类地标

```text
Create one isolated History-category landmark matching the world and history-region references, in the same 30-degree orthographic view and upper-left daylight. Use ivory old stone, gray-mauve roofs, dusty rose details and muted olive vegetation. Place it on a perfectly flat solid #00ff00 chroma-key background with no shadow, gradient, texture, horizon or reflection. No text, UI, watermark or ordinary gold.

Variants:
1. Archive Citadel with layered reading courts and central archive dome.
2. Archaeological Terrace with excavation trenches, exposed foundations and a broken arch.
3. Chronicle Observatory with a record tower, octagonal library and restrained timeline terrace.
4. Ancient Road Gate with branching roads, memorial steles, collapsed wall and record pavilion.
```

## 交互规则

- 第一次进入页面时，现有合集成为基线，不播放批量显影。
- 之后出现的新合集会占用下一个稳定槽位。
- 新地标在 2.3 秒内由灰阶模糊恢复本色，覆盖它的灰紫雾从中心向外扩散并消失。
- 没有真实内容的槽位只保留灰黑地貌轮廓，不显示名称、地标或可点击入口。
- 已显影 ID 保存在浏览器本地，同一用户再次进入时保持地图状态。
- 开启减少动态效果时，显影会缩短为即时状态切换。
