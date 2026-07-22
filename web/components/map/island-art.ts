/* ================================================================
   群岛美术资源注册表 + 自动分配。

   两层规则：
   1. 专属映射（DEDICATED）：entityId → 专属岛屿资源，美术补齐后在这里登记。
   2. 类目资源池兜底：没有专属资源的新视频，从同类目池里按
      「最少使用优先」自动分配一座岛——备用岛（baseUse 0）先被用掉，
      之后才轮到复用已有专属岛。

   稳定性：入岛顺序来自 listAssetsByCollection 的 createdAt 排序，
   贪心分配对追加是前缀稳定的——老视频的岛不会因为新视频加入而改变；
   同使用数的候选按 entityId 哈希挑选，跨刷新恒定。
   ================================================================ */

export interface IslandArt {
  href: string;
  label: string;
}

const eco = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/archipelago/economy/${file}`,
  label,
});
const his = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/archipelago/history/${file}`,
  label,
});
const tech = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/archipelago/technology/misc-tech/${file}`,
  label,
});
const daily = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/archipelago/daily/islands/${file}`,
  label,
});
const unknown = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/archipelago/kit/unknown/parts/${file}`,
  label,
});
const personal = (file: string, label: string): IslandArt => ({
  href: `/map-runtime/personal/${file}`,
  label,
});

const UNKNOWN_SEA_ART: IslandArt[] = [
  unknown("archipelago_kit_unknown_wayfinder-lighthouse_lod1_v01.webp", "引航灯塔"),
  unknown("archipelago_kit_unknown_broken-arch_lod1_v01.webp", "断裂拱门"),
  unknown("archipelago_kit_unknown_empty-jetty_lod1_v01.webp", "空泊码头"),
  unknown("archipelago_kit_unknown_sealed-archive-pod_lod1_v01.webp", "封存档案舱"),
  unknown("archipelago_kit_unknown_survey-marker_lod1_v01.webp", "测绘标记"),
  unknown("archipelago_kit_unknown_blank-boundary-stone_lod1_v01.webp", "无名界碑"),
];
export const DEDICATED_ISLAND_ART: Record<string, IslandArt> = {
  /* 经济 · 散篇集 misc-eco */
  "3a7ca86a": eco("misc-eco/islands/economy_misc-eco_island_3a7ca86a_lod1_v01.webp", "经济学冷知识岛"),
  ee255491: eco("misc-eco/islands/economy_misc-eco_island_ee255491_lod1_v01.webp", "航天资本岛"),
  f3046a2e: eco("misc-eco/islands/economy_misc-eco_island_f3046a2e_lod1_v01.webp", "AI 与教育岛"),
  "2f0b857a": eco("misc-eco/islands/economy_misc-eco_island_2f0b857a_lod1_v01.webp", "盐铁论岛"),
  "8ef72aeb": eco("misc-eco/islands/economy_misc-eco_island_8ef72aeb_lod1_v01.webp", "日元汇率岛"),
  "56044ba0": eco("misc-eco/islands/economy_misc-eco_island_56044ba0_lod1_v01.webp", "计划经济岛"),
  d085ddb7: eco("misc-eco/islands/economy_misc-eco_island_d085ddb7_lod1_v01.webp", "市场分歧岛"),
  /* 经济 · 金融巨头风云录 da2e1ad3 */
  "00ac2a93": eco("da2e1ad3/islands/economy_da2e1ad3_island_00ac2a93_lod1_v01.webp", "经济主题岛"),
  "15c400ae": eco("da2e1ad3/islands/economy_da2e1ad3_island_15c400ae_lod1_v01.webp", "经济主题岛"),
  "3d00215d": eco("da2e1ad3/islands/economy_da2e1ad3_island_3d00215d_lod1_v01.webp", "经济主题岛"),
  "698f631b": eco("da2e1ad3/islands/economy_da2e1ad3_island_698f631b_lod1_v01.webp", "经济主题岛"),
  "83563cb3": eco("da2e1ad3/islands/economy_da2e1ad3_island_83563cb3_lod1_v01.webp", "经济主题岛"),
  c30dff59: eco("da2e1ad3/islands/economy_da2e1ad3_island_c30dff59_lod1_v01.webp", "经济主题岛"),
  /* 经济 · 互联网史诗 b9702449 */
  "150bd446": eco("b9702449/islands/economy_b9702449_island_150bd446_lod1_v01.webp", "三星产业帝国岛"),
  "7d6e3b77": eco("b9702449/islands/economy_b9702449_island_7d6e3b77_lod1_v01.webp", "任天堂法务堡垒岛"),
  e0c1a7e2: eco("b9702449/islands/economy_b9702449_island_e0c1a7e2_lod1_v01.webp", "乔布斯创业岛"),
  "22725bbf": eco("b9702449/islands/economy_b9702449_island_22725bbf_lod1_v01.webp", "皮克斯创意岛"),
  /* 经济 · 中国土地财政与化债 tc-097c55ac */
  "69d3078a": eco("tc-097c55ac/islands/economy_tc-097c55ac_island_69d3078a_lod1_v01.webp", "债务重构岛"),
  c729a893: eco("tc-097c55ac/islands/economy_tc-097c55ac_island_c729a893_lod1_v01.webp", "房地产引擎岛"),
  "9633400b": eco("tc-097c55ac/islands/economy_tc-097c55ac_island_9633400b_lod1_v01.webp", "土地信用岛"),
  /* 经济 · 金融泡沫与崩盘 tc-25dff437 */
  "1138db7c": eco("tc-25dff437/islands/economy_tc-25dff437_island_1138db7c_lod1_v01.webp", "雷曼崩塌岛"),
  c3ccd498: eco("tc-25dff437/islands/economy_tc-25dff437_island_c3ccd498_lod1_v01.webp", "AI 泡沫岛"),
  dec4f0de: eco("tc-25dff437/islands/economy_tc-25dff437_island_dec4f0de_lod1_v01.webp", "瑞郎之夜岛"),
  "791e6331": eco("tc-25dff437/islands/economy_tc-25dff437_island_791e6331_lod1_v01.webp", "繁荣萧条周期岛"),
  /* 历史 · 两晋沉沦 832cf0f1 */
  "316a1ad1": his("two-jin/islands/history_two-jin_island_316a1ad1_lod1_v01.webp", "边疆压力岛"),
  af291d55: his("two-jin/islands/history_two-jin_island_af291d55_lod1_v01.webp", "司马氏权力岛"),
  a0656cd5: his("two-jin/islands/history_two-jin_island_a0656cd5_lod1_v01.webp", "魏晋风气岛"),
  "41555de7": his("two-jin/islands/history_two-jin_island_41555de7_lod1_v01.webp", "八王之乱岛"),
  f224c71d: his("two-jin/islands/history_two-jin_island_f224c71d_lod1_v01.webp", "乱局前夕岛"),
  "80f334e1": his("two-jin/islands/history_two-jin_island_80f334e1_lod1_v01.webp", "贾南风覆灭岛"),
  /* 历史 · 散篇集 misc-his */
  "495910a7": his("misc-his/islands/history_misc-his_island_495910a7_lod1_v01.webp", "灰烬余温岛"),
  "7f45217b": his("misc-his/islands/history_misc-his_island_7f45217b_lod1_v01.webp", "罗斯福争议岛"),
  "2ccaf356": his("misc-his/islands/history_misc-his_island_2ccaf356_lod1_v01.webp", "煮酒论英雄岛"),
  /* 科技 · 散篇集 misc-tech + AI 算力竞争 tc-305aa55b */
  "55e6378f": tech("islands/technology_misc-tech_island_55e6378f_lod1_v01.webp", "AI 简史岛"),
  "51330f35": tech("islands/technology_misc-tech_island_51330f35_lod1_v01.webp", "多元算力岛"),
  "515942f1": tech("islands/technology_misc-tech_island_515942f1_lod1_v01.webp", "AI 电力瓶颈岛"),
  a72fe9e0: tech("islands/technology_misc-tech_island_a72fe9e0_lod1_v01.webp", "AI 意识前夜岛"),
  ea6dd19d: tech("islands/technology_misc-tech_island_ea6dd19d_lod1_v01.webp", "算力竞赛岛"),
  "812f0524": tech("islands/technology_misc-tech_island_812f0524_lod1_v01.webp", "AI 图像跃迁岛"),
  "9eda1db0": tech("islands/technology_misc-tech_island_9eda1db0_lod1_v01.webp", "科技帝国岛"),
  "040b8997": tech("islands/technology_misc-tech_island_040b8997_lod1_v01.webp", "AI 搭建工坊岛"),
  "748984ee": tech("islands/technology_misc-tech_island_748984ee_lod1_v01.webp", "AI 知识库岛"),
  /* 我的岛屿：只有这两座固定岛，不走类目池分配 */
  "my-thoughts": personal("thought-island.png", "想法岛"),
  "my-footprints": personal("footprint-island.png", "足迹岛"),
};

/* 新中国系列（07ae1f5b）按槽位顺序取岛，不走 entityId 映射；
   同时进入历史池供其他历史视频复用。 */
export const NEW_CHINA_ISLANDS: IslandArt[] = [
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_river-valley_lod1_v01.webp", label: "河谷档案岛" },
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_terraced-assembly_lod1_v01.webp", label: "梯田议事岛" },
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_circular-commons_lod1_v01.webp", label: "环形公社岛" },
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_aqueduct-ravine_lod1_v01.webp", label: "渡槽峡谷岛" },
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_ridge-settlement_lod1_v01.webp", label: "山脊聚落岛" },
  { href: "/map-runtime/archipelago/new-china/islands/new-china_island_orchard-delta_lod1_v01.webp", label: "果园三角洲岛" },
];

/* 备用岛：还没被任何视频占用（baseUse 0），分配时最先被用掉。 */
const TECH_RESERVE_ISLANDS: IslandArt[] = [
  tech("reserve/technology_reserve_chip_lod1_v01.webp", "芯片计算备用岛"),
  tech("reserve/technology_reserve_robotics_lod1_v01.webp", "机器人研究备用岛"),
  tech("reserve/technology_reserve_quantum_lod1_v01.webp", "量子实验备用岛"),
  tech("reserve/technology_reserve_security_lod1_v01.webp", "网络安全备用岛"),
  tech("reserve/technology_reserve_space_lod1_v01.webp", "航天通信备用岛"),
  tech("reserve/technology_reserve_biotech_lod1_v01.webp", "生物科技备用岛"),
];

/* 日常区美术是一组可跨合集复用的主题岛屿。只使用已经抠好透明通道的 alpha 版本；
   分配器会优先把尚未出现过的岛分给新视频，保证同一群岛内不重复。 */
const DAILY_ISLANDS: IslandArt[] = [
  daily("daily_island_beauty-atelier_alpha_v01.png", "美妆工坊岛"),
  daily("daily_island_skincare-spa_alpha_v01.png", "护肤疗愈岛"),
  daily("daily_island_fashion-atelier_alpha_v01.png", "穿搭工坊岛"),
  daily("daily_island_wellness-kitchen_alpha_v01.png", "健康厨房岛"),
  daily("daily_island_cozy-home_alpha_v01.png", "温馨居所岛"),
  daily("daily_island_life-tips-academy_alpha_v01.png", "生活知识岛"),
  daily("daily_island_hair-care_alpha_v01.png", "秀发护理岛"),
  daily("daily_island_fragrance-nail_alpha_v01.png", "香氛美甲岛"),
  daily("daily_island_womens-health_alpha_v01.png", "女性健康岛"),
  daily("daily_island_emotional-wellness_alpha_v01.png", "情绪疗愈岛"),
  daily("daily_island_home-care_alpha_v01.png", "家居养护岛"),
  daily("daily_island_travel-packing_alpha_v01.png", "旅行整装岛"),
  daily("daily_island_pet-life_alpha_v01.png", "宠物生活岛"),
  daily("daily_island_reading-hobbies_alpha_v01.png", "阅读兴趣岛"),
  daily("daily_island_craft-floral_alpha_v01.png", "手作花艺岛"),
  daily("daily_island_photo-journal_alpha_v01.png", "影像日记岛"),
  daily("daily_island_social-etiquette_alpha_v01.png", "社交礼仪岛"),
  daily("daily_island_career-growth_alpha_v01.png", "职场成长岛"),
];

interface PoolEntry extends IslandArt {
  /** 已有多少条视频固定使用这张图——最少使用优先的基线。 */
  baseUse: number;
}

const byCategory = (prefix: string): PoolEntry[] =>
  Object.values(DEDICATED_ISLAND_ART)
    .filter((art) => art.href.startsWith(prefix))
    .map((art) => ({ ...art, baseUse: 1 }));

const ISLAND_POOLS: Record<string, PoolEntry[]> = {
  unknown: UNKNOWN_SEA_ART.map((art) => ({ ...art, baseUse: 0 })),
  eco: byCategory("/map-runtime/archipelago/economy/"),
  his: [
    ...byCategory("/map-runtime/archipelago/history/"),
    ...NEW_CHINA_ISLANDS.map((art) => ({ ...art, baseUse: 1 })),
  ],
  tech: [
    ...TECH_RESERVE_ISLANDS.map((art) => ({ ...art, baseUse: 0 })),
    ...byCategory("/map-runtime/archipelago/technology/"),
  ],
  life: DAILY_ISLANDS.map((art) => ({ ...art, baseUse: 0 })),
  personal: byCategory("/map-runtime/personal/"),
};

const hashOf = (id: string) =>
  [...id].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 0);

/**
 * 为一个合集的全部视频解析岛屿资源。entityIds 必须按 createdAt 传入。
 * 类目没有资源池（soc/sci 等）时返回空 Map，调用方回落到通用 SVG 岛。
 */
export function assignIslandArt(categoryId: string, entityIds: string[]): Map<string, IslandArt> {
  const assigned = new Map<string, IslandArt>();
  const pool = ISLAND_POOLS[categoryId];
  if (!pool || pool.length === 0) return assigned;

  /* 同一张图在同一个群岛页出现两次会非常显眼——
     对本合集已占用的资源加大惩罚，池子未耗尽前不会同屏重复。 */
  const SAME_PAGE_PENALTY = 1000;
  const usedOnPage = new Set(
    entityIds.flatMap((id) => (DEDICATED_ISLAND_ART[id] ? [DEDICATED_ISLAND_ART[id].href] : [])),
  );
  const usage = pool.map((entry) => entry.baseUse);
  for (const entityId of entityIds) {
    const dedicated = DEDICATED_ISLAND_ART[entityId];
    if (dedicated) {
      assigned.set(entityId, dedicated);
      continue;
    }
    const scores = usage.map(
      (use, i) => use + (usedOnPage.has(pool[i].href) ? SAME_PAGE_PENALTY : 0),
    );
    const min = Math.min(...scores);
    const candidates = scores.flatMap((score, i) => (score === min ? [i] : []));
    const pick = candidates[hashOf(entityId) % candidates.length];
    usage[pick] += 1;
    usedOnPage.add(pool[pick].href);
    assigned.set(entityId, pool[pick]);
  }
  return assigned;
}
