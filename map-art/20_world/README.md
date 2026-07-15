# 世界区域图片资源

本目录只存放世界区域相关的美术图片源、同坐标技术图和验收预览。

## 目录

- `source/`：生成原图、透明大陆、区域视觉参考；色键源保留用于返工。
- `technical/`：高度图、接触阴影和三个同坐标区域遮罩。
- `review/`：仅供人工验收的合成预览，不作为正式运行资源。

## 当前基础包

1. 环境底：`source/W02_world_sea_air_environment_v02.png`
2. 连贯大陆：`source/W03_world_connected_terrain_alpha_v01.png`
3. 高度参考：`technical/W03_world_terrain_height_default_v01.png`
4. 接触阴影：`technical/W03_world_terrain_contact-shadow_default_v02.png`
5. 区域遮罩：`technical/W04-*_region-mask_default_v02.png`
6. 云层：复用 `../60_common/clouds/` 下的 far / mid / front 三层透明 PNG

## P0 环境质感补充

- W06–W08 新云图集：`../60_common/clouds/`，远/中/前景各 4 张。
- W09–W10 水面包：`../60_common/water/`，包含水面底色、材质参考和水纹图集。
- W11 海岸接触层：`technical/W11_*_v03.png`，与 W03 完全同坐标。
- 使用说明：`../../docs/世界区域P0美术资源使用说明_V1.md`。

## 外围扩展岛屿

- 源文件与技术层：`expansion/island-a/`、`expansion/island-b/`。
- 双岛锁定状态验收图：`expansion/review/WX_world_expansion_two-islands_locked_review_v01.png`。
- 生产与接入规则：`../../docs/世界地图外围岛屿扩展资源手册_V1.md`。
- 当前两座岛屿均为正式精度的未开放世界资源，尚未绑定类别、标签、命中区和进入路由。

W05 地标资源暂存于 `source/`，后续进入区域内部时再启用。
