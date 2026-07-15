# 世界地图美术补充 · 任务与回传记录 v01

## W05-A01 · 远景云模块

- 所在步骤：步骤 5 · 扩展世界正式资源
- 解决的问题：补足远景空气层，保持 Hero 上方留白
- 是否进入前端：是
- 资源类型：`[EDIT]`
- 所属页面：世界地图页
- 所处图层：远景 / atmosphere
- 唯一参考母版：`map-art/20_world/source/W01_world_master_preview_v01.png`
- 参考图：`map-art/00_style/reference-t00/source/T00-04_cloud_far_01_v01.png`
- 允许改变：去除烘焙棋盘格、裁切透明边、缩放、轻微边缘柔化
- 禁止改变：云的冷白/浅蓝色相、光源方向、云团主体轮廓
- 输出尺寸：最长边 820px；运行时 WebP
- 透明要求：Alpha；无棋盘格
- 完整 Prompt：不使用生成模型；执行 `python scripts/prepare_world_atmosphere.py`
- 前端使用方式：低对比复用，置于大陆外缘，24–38 秒低频漂移
- 验收标准：实际尺寸无棋盘格；不遮挡 Hero 与地标；关闭后世界仍完整
- 文件名：`world_cloud_far_01_default_lod1_v01.webp`

## W05-A02 · 中景云模块

- 任务属性同 W05-A01
- 参考图：`map-art/00_style/reference-t00/source/T00-04_cloud_mid_01_v01.png`
- 输出尺寸：最长边 1180px
- 前端使用方式：只触碰经济区与科技区的外围海岸，形成轻视差
- 文件名：`world_cloud_mid_01_default_lod1_v01.webp`

## W05-A03 · 前景云模块

- 任务属性同 W05-A01
- 参考图：`map-art/00_style/reference-t00/source/T00-04_cloud_front_01_v01.png`
- 输出尺寸：最长边 1380px
- 前端使用方式：底边遮挡；移动端降低面积与不透明度
- 文件名：`world_cloud_front_01_default_lod1_v01.webp`

## W05-A04 · 水面细节

- 所在步骤：步骤 5 · 扩展世界正式资源
- 解决的问题：补足低频水面层，避免静态海洋像平面底纸
- 是否进入前端：是
- 资源类型：`[EDIT][CODE]`
- 参考图：`map-art/00_style/reference-t00/source/T00-05_water_detail_source_v01.png`
- 允许改变：降采样、WebP 压缩、CSS 遮罩与低频位移
- 禁止改变：浅青色相；不得覆盖大陆；不得使用暖金
- 输出尺寸：768×768 WebP
- 前端使用方式：仅通过外围海域 mask 以低不透明度叠加
- 文件名：`world_water_detail_default_lod1_v01.webp`

## W05-C01 · 世界环境分层

- 资源类型：`[CODE][DESIGN]`
- 配置：云层坐标、速度、移动端密度、冷白选中波纹
- 验收：三大类同时可见；Hero 可读；区域标签无遮挡；减少动态偏好生效；无水平溢出

## 回传

- 模型版本：无（本轮为现有 T00 资源的可复现后处理）
- 后处理依赖：Python 3、Pillow、NumPy
- 候选版本：本文件记录的 v01
- 失败处理：若棋盘格在实际尺寸仍可见，资源不进入前端；回到 T00 源重新输出真透明版本
- 下一步：通过桌面 / 390px / 320px 真实 UI 合成验收后，再扩展世界环境图集数量
