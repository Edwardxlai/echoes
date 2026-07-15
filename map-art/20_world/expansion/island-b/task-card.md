# WX-B 外围岛屿 B 回传记录 v01

- 状态：已生成并完成基础分层。
- 用途：世界地图未开放外围岛屿。
- 生成方式：内置图像生成工具。
- 透明处理：洋红色键生成后，使用 imagegen 技能自带的色键移除工具制作真透明 Alpha。
- 参考图：`W01_world_master_preview_v01.png`、`W03_world_connected_terrain_alpha_v01.png`、`W00_world_P0_quality_preview_v01.png`。
- 画布：1586 × 992。
- 运行时 LOD1：1280 × 745。
- 类别绑定：无。
- 路由与交互：无。

## 最终生成提示词

```text
Use case: stylized-concept
Asset type: production world-map expansion island, isolated game environment asset
Input images: Image 1 is the world composition and atmosphere reference; Image 2 is the terrain cutout and exact detail-density reference; Image 3 is the final lighting, coast, and material-quality reference.
Primary request: Create one new standalone outer island that unmistakably belongs to the same “Echoes” knowledge world. This is Island B, an elongated asymmetrical island shaped by a central green ridge and a pale-cyan river that opens into a quiet lagoon. Include layered cliff coves, one natural stone arch, terraced slopes, small bridges, a restrained coastal village, refined neutral civic buildings, paths, groves, gardens, and ordinary settlements. It must be a complete polished place but must not imply economy, history, technology, or any other fixed category. It must have a clearly different silhouette and internal layout from Island A and from the three main regions in the references.
Style/medium: premium bright 2.5D miniature world-map illustration, restrained watercolor gouache and colored-pencil surface detail, matching the reference images exactly.
Composition/framing: one complete island only, approximately 30-degree orthographic top-down view, elongated from lower-left to upper-right with an irregular lagoon on one side, generous clear padding on every side, no crop. Match the reference building scale and visible-detail density. Thin ivory-white cliff/model sides around the full coast.
Lighting/mood: same soft upper-left daylight as the references, airy, quiet, refined, low saturation.
Color palette: pale limestone, muted sage, dusty lavender foliage accents, restrained warm clay roofs, small pale-cyan waterways. No category-dominant color.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal. The background must be one uniform color with no sea, shadows, gradients, texture, reflections, floor plane, haze, clouds, or lighting variation.
Constraints: island only; crisp fully separated silhouette; no cast shadow outside the island; no contact shadow; no surrounding water; no foam; no mist; no smoke; no transparent materials; do not use #ff00ff anywhere in the island; no text; no UI; no labels; no logos; no watermark; no empty sockets or placeholder bases; no oversized landmark; no golden roads; no neon; preserve the exact orthographic camera, upper-left light direction, ivory cliff thickness, architectural scale, and fine detail density of the reference terrain.
Avoid: concept-art backdrop, dark fantasy, floating rock slab, toy-cartoon look, aerial photography, hard outlines, simplified low-detail placeholder island.
```

## 交付

- `source/`：色键源图与真透明岛体。
- `technical/`：接触阴影、浅滩、湿润层、泡沫、高度参考和遮罩。
- `review/`：默认状态、锁定状态与锁定岛体。
- `web/public/map-runtime/world/expansion/island-b/`：运行时 LOD1 WebP。
