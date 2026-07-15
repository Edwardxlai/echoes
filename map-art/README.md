# 回响美术源工程

这里保存可追溯的源图、参考图、审核稿和生产记录，不直接被前端加载。运行时资源只放在 `web/public/map/`。

## 目录职责

```text
map-art/
├─ 00_style/
│  ├─ reference-t00/    早期 T00 画风参考，只读归档
│  ├─ approved/         S03 / S04 / S06 等已批准审核图
│  └─ style-prompt.md   统一风格前缀
├─ 20_world/source/     世界层母版、候选和重制源图
├─ 30_regions/          economy / history / technology 区域源图
├─ 50_archipelago/      c1–c4 群岛源图
├─ 60_common/           clouds / water / states 共享模块
└─ config/              任务卡、回传日志和批次验收
```

## 入库规则

- PNG 源图、候选图和高分辨率母版留在本目录，不进入 `public`。
- 前端确认使用后再导出 WebP；文件名使用 `[level]_[scene]_[object]_[variant]_[lod]_[version]`。
- 生成图若需要透明层，必须经过抠图并验证真实 alpha，不能接受画出来的棋盘格。
- 每个正式资产都要有任务卡或回传记录，至少记录来源、用途、尺寸、模型、Prompt、版本和验收结论。
- 暖金只属于“回响”状态，普通建筑、道路、水纹和地标不得使用暖金强调。

## 当前状态

- `reference-t00`：历史参考，禁止继续加入正式资产。
- 品牌标记目前只有 `web/public/brand/echoes-mark.png` 运行图；原始高分辨率生成稿未单独留档，后续重制时需补齐母版再纳入源工程。
- `20_world/source`：世界层新一批源图，具体结论见 `config/logs/W-batch1_intake_v01.md`。
- `60_common/clouds` 与 `60_common/water`：已处理候选，目前未被前端消费，不复制到 `public`。
- 区域和群岛目录：等待审核图及正式纵向切片。
