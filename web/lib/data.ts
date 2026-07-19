/* ================================================================
   回响 · 种子数据（PRD V1.2 §8 数据模型）
   内容承接 prototype/data.js 已有的经济/历史/科技三个垂类真实文案，
   重排进 Category/Collection/Video/Node/Echo/Synthesis/CognitiveExpansion。
   ================================================================ */

export type VideoType = "argument" | "narrative" | "intro" | "compare" | "concept";

export const VIDEO_TYPE_LABEL: Record<VideoType, string> = {
  argument: "论证类",
  narrative: "叙事类",
  intro: "介绍类",
  compare: "对比类",
  concept: "概念类",
};

export interface Echo {
  targetTitle: string;
  targetVideoId?: string; // 有则可跳转；无则只做溯源展示，不裸跳
  creator: string;
  timestampText: string;
  relation: string; // 关系定性短标签（"唱反调"），不带"你看过的"前后缀
  oldSay?: string; // 方案 D：旧方一句，对着节点叙述写成"接话"；新方=节点 detail 本身，不复述
  oldFocus?: string; // oldSay 里的分歧焦点（子串），划暖金荧光
  nodeFocus?: string; // 节点 detail 里的对应原文短语（子串），划暖金荧光
  sentence?: string; // 旧格式的一句话展开（演示数据兜底，与 oldSay 互斥）
}

export interface Node {
  id: string;
  label: string;
  /** 节点在骨架中的环节名（"核心张力"/"论据"），左轨优先显示；缺席回落 timestampText。 */
  role?: string;
  timestampText: string;
  detail: string;
  echo?: Echo;
}

export interface CognitiveExpansion {
  gapFill: {
    gap?: string; // 补缺·戳破：视频承重却没铺的地基（门控：无则不渲染补缺块）
    fill?: string; // 补缺·补上：视频外的背景知识，与 gap 连读成一段；有 gap 必有 fill
    focus?: string; // fill 里要划琥珀高亮的关键子串（须原样出现在 fill 中）
    searchTerms?: string[]; // 补缺·去搜：2~3 个可直接拿去抖音搜的关键词，引导用户自己往下补
  };
  extend: { question: string; hint: string; voices: number }[]; // 开放问题 + 同题讨论门口人数（讨论区 P2 前为种子数）
}

/** 合集级补缺（往旁看）：整组共同绕开的相邻维度。与单视频补缺不同，也不重复各视频已补的内容。 */
export interface CollectionGapFill {
  gap: string;
  fill: string;
  focus?: string; // fill 里要划琥珀高亮的关键子串
  searchTerms?: string[]; // 2~3 个可直接拿去抖音搜的关键词
}

/** 合集级延伸：整组作为整体共同引出、单条视频够不着的开放议题。不重复各视频已问过的延伸。
    voices（同题讨论门口人数）在读取层补 0——讨论区 P2 前恒为种子数。 */
export interface CollectionExtendItem {
  question: string;
  hint: string;
}

/** Map-relevant business truth. Presentation details stay in map-config.ts. */
export interface VideoMapState {
  viewed: boolean;
  isNew: boolean;
  contentRich: boolean;
}

export interface Video extends VideoMapState {
  id: string;
  title: string;
  creator: string;
  duration: string;
  collectionId: string;
  /** 必填（V1.2 变更摘要 #14，群岛信息面板必显）。正式数据复用抖音封面，demo seed 用占位图。 */
  cover: string;
  /** 平台原视频链接（沿用 source_assets.sourceUrl）。缺失=上传文件兜底录入，群岛信息面板"查看原视频"入口整体隐藏。 */
  sourceUrl?: string;
  coreQuestion: string;
  videoType: VideoType;
  typeConfidence: number;
  nodes: Node[];
  cognitiveExpansion: CognitiveExpansion;
  mapItemId: string;
}

/** 知识点里的一个要点：脉络式左锚点 + 右解释。focus 划琥珀高亮，ref 是溯源序号（1-based）做上角标。 */
export interface SynthesisFacet {
  lead: string; // 左轨档位标签（该 relation 的固定档位），≤4字
  label: string; // 概念标题（收起时显示），≤14字
  detail: string; // 展开正文，2~4句
  focus?: string; // detail 里要高亮的子串（须原样出现在 detail 中）
  ref?: number; // 上角标数字 = 对应 sources 的序号（1-based）
  refs?: number[]; // 多条视频共同支撑该要点时的来源序号（1-based）
  text?: string; // 兼容旧数据：重生成前的一句话 facet
}

export interface SynthesisPoint {
  label: string;
  relation: string; // "立场分布/补充印证/对撞/衔接"，AI 一句话生成，不做枚举硬分类
  stance?: { tag: "a" | "b" | "c"; text: string }[]; // 争议型可选：立场统计
  facets?: SynthesisFacet[]; // 结构化要点（新）；有它就走脉络式渲染
  note?: string; // 兜底：老数据/未重生成时的一整段话
  sources: { videoId: string; title: string; timestampText: string }[];
  echo?: Echo;
}

export interface Synthesis {
  seriesQuestion: string;
  points: SynthesisPoint[];
}

export interface Collection {
  id: string;
  name: string;
  categoryId: string;
  videoIds: string[];
  echoCount: number;
  terrain: string; // 地貌隐喻标签，§5.2.2（"不要求一一写实对应"）
  glyphKind: "city" | "tower" | "ruins" | "port"; // 区域地图页地标图形
  synthesis?: Synthesis;
  cognitiveExpansion?: CognitiveExpansion; // scope=整组，§6.3"作用范围随查看层级变化"
  mapItemId: string;
}

export interface Category {
  id: string;
  name: string;
  collectionIds: string[];
  echoCount: number;
  mapItemId: string;
}

const nodesOf = (videoId: string, list: Omit<Node, "id">[]): Node[] =>
  list.map((n, i) => ({ ...n, id: `${videoId}-n${i + 1}` }));

export const VIDEOS: Record<string, Video> = {
  v1: {
    id: "v1",
    title: "通胀到底是谁的锅",
    creator: "老唐说经济",
    duration: "15:20",
    collectionId: "c1",
    cover: "/covers/v1.svg",
    sourceUrl: "https://www.douyin.com/video/7314092837465021751",
    coreQuestion: "通胀，到底是货币现象，还是一场分配的结果？",
    videoType: "argument",
    typeConfidence: 0.86,
    viewed: true,
    isNew: false,
    contentRich: true,
    nodes: nodesOf("v1", [
      {
        label: "货币多了，物价就一定涨吗",
        timestampText: "1:20",
        detail:
          "钱要真的进入消费、流通速度不降，「印钱→涨价」才成立——2008 后大放水却长期低通胀就是反例。",
      },
      {
        label: "需求拉动 vs 成本推动",
        timestampText: "4:05",
        detail:
          "需求拉动是「钱追商品」，成本推动是「原材料涨价」。区分它，直接决定该不该加息。",
        echo: {
          targetTitle: "央行加息在加什么",
          targetVideoId: "v2",
          creator: "老唐说经济",
          timestampText: "4:05",
          relation: "跟这条唱反调",
          sentence:
            "那条说加息能快速压下通胀；这条认为对成本推动型通胀，加息几乎无效，只会误伤就业。两条正面对撞。",
        },
      },
      {
        label: "谁在为通胀买单",
        timestampText: "7:30",
        detail:
          "通胀是隐形的财富再分配：持币者、固定工资者受损，持实物与负债者受益。",
      },
      {
        label: "加息的代价",
        timestampText: "11:10",
        detail:
          "加息压通胀不是免费的：同时压投资、压就业、抬债务负担。代价落谁头上，这里没细讲。",
        echo: {
          targetTitle: "为什么工资涨了还是变穷",
          targetVideoId: "v3",
          creator: "财经小林",
          timestampText: "8:12",
          relation: "把「代价」讲透了",
          sentence:
            "这条一笔带过的「加息的代价」，《为什么工资涨了还是变穷》讲透了：账单和房贷利息先涨，普通人体感更穷。",
        },
      },
      {
        label: "通胀预期会自我实现",
        timestampText: "14:40",
        detail:
          "所有人都信会涨价，就提前囤货、要求涨薪——预期本身把通胀变成现实。",
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question:
            "如果通胀是「隐形的再分配」，那「温和通胀有益」这个主流共识，究竟站在谁的立场上？",
          hint: "视频点破了通胀让持币者受损、负债者受益，却没往下问：既然有输有赢，「2% 温和通胀是健康的」到底替谁说话——央行、作为最大债务人的政府、还是储户？换个立场，结论可能就反过来。",
          voices: 3,
        },
        {
          question:
            "视频把「加息的代价」一笔带过。如果代价主要落在有房贷的普通人头上，那「加息抗通胀」本身算不算又一次再分配？",
          hint: "抗通胀被讲成一个中性的技术操作，但它的账单有人付。顺着视频「谁为通胀买单」的逻辑追下去：抗通胀的过程，很可能制造了新一轮再分配。",
          voices: 0,
        },
      ],
    },
    mapItemId: "island-v1",
  },
  v2: {
    id: "v2",
    title: "央行加息在加什么",
    creator: "老唐说经济",
    duration: "9:40",
    collectionId: "c1",
    cover: "/covers/v2.svg",
    sourceUrl: "https://www.douyin.com/video/7318554120963344672",
    coreQuestion: "央行一「加息」，到底在加哪个数字，凭什么能管住物价？",
    videoType: "concept",
    typeConfidence: 0.74,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v2", [
      {
        label: "加的是基准利率",
        timestampText: "0:50",
        detail: "抬高银行间基准利率，传导到房贷、企业贷，让借钱变贵、花钱谨慎。",
      },
      {
        label: "加息压需求的链条",
        timestampText: "3:10",
        detail: "贵→少借→少花→需求降→物价压下来。对需求拉动型有效。",
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "如果借钱变贵能压需求，那本身不靠借贷消费的人，加息对他们还有用吗？",
          hint: "链条的每一环都假设「花钱靠借」，现金支付、无杠杆的群体几乎不在这条传导路径里——加息的效力天然不均匀。",
          voices: 2,
        },
      ],
    },
    mapItemId: "island-v2",
  },
  v3: {
    id: "v3",
    title: "为什么工资涨了还是变穷",
    creator: "财经小林",
    duration: "12:10",
    collectionId: "c1",
    cover: "/covers/v3.svg",
    sourceUrl: "https://www.douyin.com/video/7322017465908346118",
    coreQuestion: "名义工资在涨，为什么体感反而更穷了？",
    videoType: "argument",
    typeConfidence: 0.81,
    viewed: false,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v3", [
      {
        label: "名义 vs 实际工资",
        timestampText: "1:05",
        detail: "工资涨 5%、物价涨 7%，实际购买力负增长。「变穷」不是错觉。",
      },
      {
        label: "加息账单先到",
        timestampText: "8:12",
        detail: "浮动房贷利息立刻上调，账单先涨、资产后跌，夹在中间最难受。",
        echo: {
          targetTitle: "通胀到底是谁的锅",
          targetVideoId: "v1",
          creator: "老唐说经济",
          timestampText: "11:10",
          relation: "回答了它留下的问题",
          sentence:
            "《通胀到底是谁的锅》问「加息的代价落谁头上」，答案就在这：最先落在有房贷的普通人身上。",
        },
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "如果实际购买力常年负增长，「涨薪」这件事对雇主和雇员来说，各自意味着什么？",
          hint: "雇主报出的涨幅是名义数字，员工体感的是购买力——同一个「涨薪 5%」，在双方的叙事里可能完全是两件事。",
          voices: 0,
        },
      ],
    },
    mapItemId: "island-v3",
  },
  v4: {
    id: "v4",
    title: "赤壁之战的另一种真相",
    creator: "史谈",
    duration: "11:00",
    collectionId: "c3",
    cover: "/covers/v4.svg",
    sourceUrl: "https://www.douyin.com/video/7296733814501283136",
    coreQuestion: "赤壁之战，真的是一把火决定的吗？",
    videoType: "argument",
    typeConfidence: 0.83,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v4", [
      {
        label: "火攻的分量被夸大了",
        timestampText: "2:00",
        detail: "正史里火攻只是收尾。疫病、水土不服、后勤过长，才是溃败的底子。",
      },
      {
        label: "瘟疫这条线",
        timestampText: "5:40",
        detail: "《三国志》明写「大疫，吏士多死」。战前曹军战斗力已被瘟疫掏空。",
        echo: {
          targetTitle: "三国里的瘟疫",
          creator: "史谈",
          timestampText: "3:20",
          relation: "和这条互相印证",
          sentence:
            "北方军队南下水土不服、疫病流行，《三国志》「大疫，吏士多死」——和这条互相印证，瘟疫才是底子。",
        },
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "如果瘟疫才是胜负手，为什么一千多年来大家更愿意记住「火烧赤壁」？",
          hint: "比起「军队病倒了」，「一把火定乾坤」更有戏剧性、更适合传颂。历史记忆筛选掉了什么、留下了什么，本身就值得想。",
          voices: 5,
        },
        {
          question: "如果瘟疫才是常态，「天时地利人和」这套解释框架，是不是把偶然的军事细节过度浪漫化了？",
          hint: "把胜负归给统帅的谋略和天命，比归给一场谁都无法预测的传染病，更符合叙事对「英雄」的需要。",
          voices: 2,
        },
      ],
    },
    mapItemId: "island-v4",
  },
  v5: {
    id: "v5",
    title: "诸葛亮被高估了吗",
    creator: "史谈",
    duration: "13:30",
    collectionId: "c3",
    // 无 sourceUrl：上传文件兜底录入的示例，面板"查看原视频"入口应整体隐藏（变更摘要 #14）
    cover: "/covers/v5.svg",
    coreQuestion: "剥开演义的滤镜，诸葛亮的真实分量在哪？",
    videoType: "compare",
    typeConfidence: 0.7,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v5", [
      {
        label: "军事被演义放大",
        timestampText: "3:15",
        detail: "借东风、空城计多为文学演绎。正史中他更像卓越的战略与后勤组织者。",
      },
      {
        label: "治蜀才是硬功",
        timestampText: "7:50",
        detail: "法度、屯田、稳定后方，让弱蜀撑了那么久。",
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "演义把军事神化、正史把治理落实——两种记录方式各自在为谁的期待服务？",
          hint: "戏剧化的军事奇谋更好传播，制度性的治理成果更难被普通人感知，这本身就是一种筛选偏差。",
          voices: 1,
        },
      ],
    },
    mapItemId: "island-v5",
  },
  v6: {
    id: "v6",
    title: "GDP 到底算了什么",
    creator: "老唐说经济",
    duration: "10:20",
    collectionId: "c2",
    cover: "/covers/v6.svg",
    sourceUrl: "https://www.douyin.com/video/7305128847229310242",
    coreQuestion: "GDP 增长，到底增的是什么？",
    videoType: "concept",
    typeConfidence: 0.78,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v6", [
      { label: "流量不是存量", timestampText: "1:30", detail: "GDP 是一年的产出流量，不等于国家的财富存量。" },
      { label: "被漏掉的部分", timestampText: "5:00", detail: "家务、免费数字服务、环境损耗都不进 GDP。" },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "一个国家 GDP 涨、但环境损耗也在涨，这算「增长」还是「透支未来」？",
          hint: "流量指标天然不扣损耗——GDP 能记录砍树卖木材的收入，记录不了森林消失的代价。",
          voices: 0,
        },
      ],
    },
    mapItemId: "island-v6",
  },
  v7: {
    id: "v7",
    title: "汇率为什么会波动",
    creator: "财经小林",
    duration: "8:50",
    collectionId: "c2",
    cover: "/covers/v7.svg",
    sourceUrl: "https://www.douyin.com/video/7331946205178691874",
    coreQuestion: "一国货币的价格，凭什么涨跌？",
    videoType: "concept",
    typeConfidence: 0.69,
    viewed: true,
    isNew: true,
    contentRich: false,
    nodes: nodesOf("v7", [
      { label: "利差与资本流动", timestampText: "2:10", detail: "哪边利率高、更安全，钱就往哪流，推高那边的汇率。" },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "如果加息同时压国内需求、又推高汇率，这两个效果对不同的人分别是好事还是坏事？",
          hint: "出口商可能因汇率上升受损，进口消费者可能受益——同一个利率决策，在不同角色身上是相反的答案。",
          voices: 2,
        },
      ],
    },
    mapItemId: "island-v7",
  },
  v8: {
    id: "v8",
    title: "AI 不会抢你工作",
    creator: "硅基观察",
    duration: "14:10",
    collectionId: "c4",
    cover: "/covers/v8.svg",
    sourceUrl: "https://www.douyin.com/video/7327764519082226982",
    coreQuestion: "AI 到来，是取代你，还是重塑你的工作？",
    videoType: "argument",
    typeConfidence: 0.79,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v8", [
      {
        label: "取代任务，不是取代人",
        timestampText: "2:40",
        detail: "AI 擅长拆下来的任务，人负责判断、协作与责任——岗位被重组而非删除。",
        echo: {
          targetTitle: "被 AI 取代的第一批人",
          targetVideoId: "v9",
          creator: "硅基观察",
          timestampText: "6:40",
          relation: "和这条正面对撞",
          sentence:
            "这条说 AI 重塑而非取代；那条认为例行岗位会被整体替代。你看过的人在这点上分成两派。",
        },
      },
      {
        label: "新工种正在长出来",
        timestampText: "8:30",
        detail: "每次技术革命都消灭一些岗位、长出更多新岗位，关键是迁移速度。",
      },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "「取代任务不取代人」成立的前提，是人能及时迁移到新任务。如果迁移速度跟不上呢？",
          hint: "视频乐观的地方藏了个假设：被替代的人学得会新技能、找得到新岗位。一旦迁移摩擦很大，「重塑」对具体某个人来说，体感就等于「取代」。",
          voices: 4,
        },
        {
          question: "历史上那几次技术革命里，被淘汰的那代人，本人最后怎么样了？",
          hint: "「长出更多新岗位」是宏观真话，但缺了微观：织布工、马车夫本人有没有等到红利。补上这段，才知道「重塑」对个体意味着什么。",
          voices: 0,
        },
      ],
    },
    mapItemId: "island-v8",
  },
  v9: {
    id: "v9",
    title: "被 AI 取代的第一批人",
    creator: "硅基观察",
    duration: "11:40",
    collectionId: "c4",
    cover: "/covers/v9.svg",
    sourceUrl: "https://www.douyin.com/video/7334102938475203913",
    coreQuestion: "哪些人会最先被 AI 顶掉？",
    videoType: "intro",
    typeConfidence: 0.62,
    viewed: true,
    isNew: false,
    contentRich: false,
    nodes: nodesOf("v9", [
      { label: "高度例行的岗位", timestampText: "1:50", detail: "规则清晰、重复度高、无需现场判断的岗位最先受冲击。" },
    ]),
    cognitiveExpansion: {
      gapFill: {
      },
      extend: [
        {
          question: "如果例行岗位先被顶掉，谁来决定「例行」的边界该划多宽？",
          hint: "今天看起来需要现场判断的工作，可能只是因为还没被拆解成规则——「例行」不是天生固定的分类。",
          voices: 1,
        },
      ],
    },
    mapItemId: "island-v9",
  },
};

export const COLLECTIONS: Record<string, Collection> = {
  c1: {
    id: "c1",
    name: "看懂通胀这门课",
    categoryId: "eco",
    videoIds: ["v1", "v2", "v3"],
    echoCount: 3,
    terrain: "一座有裂痕的城市",
    glyphKind: "city",
    mapItemId: "landmark-c1",
    synthesis: {
      seriesQuestion: "通胀如何形成，又由谁承担代价？",
      points: [
        {
          label: "加息能不能压住通胀？",
          relation: "正面对撞",
          stance: [
            { tag: "a", text: "✔ 1 认同" },
            { tag: "b", text: "＋ 1 补充" },
            { tag: "c", text: "✗ 1 反对" },
          ],
          facets: [
            { lead: "正方", label: "需求型通胀，加息管用", detail: "面对需求拉动型通胀，加息压住过热的总需求，确实能把物价摁下来——这一方主张利率工具对症。", focus: "确实能把物价摁下来", ref: 1 },
            { lead: "反方", label: "成本型通胀，加息无效", detail: "若通胀由成本推动（能源、供给冲击），加息压的是需求端，对成本端基本无效，反方据此反对一刀切加息。", focus: "基本无效", ref: 2 },
            { lead: "争点", label: "加息的就业代价", detail: "双方真正的分歧在代价：硬加息会连带压低投资与招工、误伤就业，这一刀值不值，是争论的焦点。", focus: "误伤就业", ref: 3 },
          ],
          sources: [
            { videoId: "v2", title: "央行加息在加什么", timestampText: "3:10" },
            { videoId: "v1", title: "通胀到底是谁的锅", timestampText: "4:05" },
            { videoId: "v3", title: "为什么工资涨了还是变穷", timestampText: "8:12" },
          ],
        },
        {
          label: "「工资—物价螺旋」是真的吗？",
          relation: "拼图互补",
          facets: [
            { lead: "侧面", label: "名义工资与物价互相追赶", detail: "一块拼图讲机制：物价上涨推着工资谈涨、涨薪又推高成本与物价，名义工资和物价互相追赶，滚成螺旋。", focus: "互相追赶", ref: 1 },
            { lead: "侧面", label: "账面涨薪，购买力缩水", detail: "另一块讲错觉：账面上薪水涨了，物价却涨得更快，实际购买力反而缩水，钱变多了人却更穷。", focus: "反而缩水", ref: 1 },
            { lead: "合观", label: "通胀由谁买单的答案", detail: "两块拼在一起才看清：工资螺旋正是「通胀最终由谁买单」的答案——普通劳动者用被稀释的购买力，替这轮通胀垫了账。", focus: "谁买单", ref: 2 },
          ],
          sources: [
            { videoId: "v3", title: "为什么工资涨了还是变穷", timestampText: "1:05" },
            { videoId: "v1", title: "通胀到底是谁的锅", timestampText: "14:40" },
          ],
        },
      ],
    },
    cognitiveExpansion: {
      gapFill: {
        gap: "通胀的正对面，是同样棘手、却很少被并置来看的通缩。",
        fill: "通缩不是「通胀变小」，而是物价持续下跌、自我强化的另一套螺旋：企业利润缩水、居民推迟消费、债务的实际负担越滚越重，日本「失去的三十年」是最常被援引的样本——它也解释了央行为何宁愿容忍温和通胀，也要极力躲开通缩。",
        focus: "另一套螺旋",
      },
      extend: [
        {
          question: "各国央行这轮激进加息，最后真把通胀压下来了吗？代价多大？",
          hint: "三条视频讲清了成因机制，但缺一张「真实成绩单」：这轮加息到底是有效、还是运气（能源价格自己回落）？有没有换来衰退和失业？补上这块，机制才落到现实。",
          voices: 3,
        },
      ],
    },
  },
  c2: {
    id: "c2",
    name: "宏观经济 30 讲",
    categoryId: "eco",
    videoIds: ["v6", "v7"],
    echoCount: 0,
    terrain: "一座秩序感较强的中央塔楼",
    glyphKind: "tower",
    mapItemId: "landmark-c2",
  },
  c3: {
    id: "c3",
    name: "三国的另一种读法",
    categoryId: "his",
    videoIds: ["v4", "v5"],
    echoCount: 1,
    terrain: "一片古老遗迹",
    glyphKind: "ruins",
    mapItemId: "landmark-c3",
    synthesis: {
      seriesQuestion: "正史剥开演义的滤镜之后，还剩下什么？",
      points: [
        {
          label: "赤壁曹军溃败，主因是火攻还是瘟疫？",
          relation: "纠偏戳破",
          facets: [
            { lead: "误区", label: "演义把溃败全归火攻", detail: "《三国演义》的经典叙事里，曹军是被一把大火烧垮的，火攻几乎独占了赤壁溃败的全部戏份。", focus: "火攻", ref: 1 },
            { lead: "纠偏", label: "正史记「大疫，吏士多死」", detail: "《三国志》另有底账：「大疫，吏士多死」——瘟疫先重创了曹军战力，这才是溃败的底子。", focus: "大疫，吏士多死", ref: 1 },
            { lead: "实情", label: "火攻只是收尾一击", detail: "把两条线并起来看，火攻至多是压垮一支病军的收尾一击，而非独立主因——戏剧性的解释挤掉了沉闷的真相。", focus: "收尾一击", ref: 1 },
          ],
          sources: [
            { videoId: "v4", title: "赤壁之战的另一种真相", timestampText: "5:40" },
          ],
        },
      ],
    },
    cognitiveExpansion: {
      gapFill: {
        gap: "被演义重写的远不止赤壁一战，而是整部三国的叙事骨架。",
        fill: "官渡、夷陵这些关键战役同样在演义里被大幅戏剧化，而三国故事其实叠着三层文本：陈寿《三国志》的简笔正史、裴松之注补进的大量异闻、罗贯中《演义》的再创作。分清你读到的是哪一层，才知道哪些「常识」本就是叙事的产物。",
        focus: "三层文本",
      },
      extend: [
        {
          question: "如果连赤壁都被戏剧化重写了，还有哪些「常识级」的历史结论，其实也是叙事筛选的产物？",
          hint: "赤壁不是特例，是一个方法论：越有戏剧性的解释，越容易挤掉沉闷但更接近真相的那个。",
          voices: 2,
        },
      ],
    },
  },
  c4: {
    id: "c4",
    name: "AI 浪潮下的工作",
    categoryId: "tech",
    videoIds: ["v8", "v9"],
    echoCount: 2,
    terrain: "一座繁忙港口",
    glyphKind: "port",
    mapItemId: "landmark-c4",
    synthesis: {
      seriesQuestion: "AI 会取代大多数工作，还是重塑它们？",
      points: [
        {
          label: "AI 会取代大多数工作，还是重塑它们？",
          relation: "正面对撞",
          stance: [
            { tag: "a", text: "✔ 1 重塑" },
            { tag: "c", text: "✗ 1 取代" },
          ],
          facets: [
            { lead: "正方", label: "AI 改写岗位，而非消灭", detail: "重塑派认为 AI 改写的是岗位内容、接手其中的重复环节，让人腾出手做判断与协作，而非整段消灭工作。", focus: "而非整段消灭", ref: 1 },
            { lead: "反方", label: "例行岗位会被整段替代", detail: "取代派针锋相对：高度例行、可标准化的岗位没有转型空间，会被整段替代，冲击落在最没有议价力的一批人身上。", focus: "整段替代", ref: 2 },
          ],
          sources: [
            { videoId: "v8", title: "AI 不会抢你工作", timestampText: "2:40" },
            { videoId: "v9", title: "被 AI 取代的第一批人", timestampText: "1:50" },
          ],
        },
      ],
    },
    cognitiveExpansion: {
      gapFill: {
        gap: "「会不会被取代」这道题，上一轮自动化其实早已跑完一遍完整答案。",
        fill: "上世纪八十年代起，工业机器人在汽车、电子产线大规模上岗，结果既非「工人全下岗」也非「岗位原样保留」：总就业没崩，但岗位结构被劈成两头——高技能的调试运维和低薪的边角环节，中间的熟练工被掏空。这条「极化」曲线，正是判断 AI 这轮冲击的现成参照。",
        focus: "劈成两头",
      },
      extend: [
        {
          question: "如果迁移速度是关键变量，什么样的社会/教育机制能加快个体的迁移速度？",
          hint: "两条视频都没细讲「怎么迁移」，只讲了「要不要迁移」——这恰好是能补的那一半。",
          voices: 6,
        },
      ],
    },
  },
};

export const CATEGORIES: Record<string, Category> = {
  eco: { id: "eco", name: "经济", collectionIds: ["c1", "c2"], echoCount: 3, mapItemId: "region-eco" },
  his: { id: "his", name: "历史", collectionIds: ["c3"], echoCount: 1, mapItemId: "region-his" },
  tech: { id: "tech", name: "科技", collectionIds: ["c4"], echoCount: 2, mapItemId: "region-tech" },
  soc: { id: "soc", name: "社会思想", collectionIds: [], echoCount: 0, mapItemId: "region-soc" },
  sci: { id: "sci", name: "自然科学", collectionIds: [], echoCount: 0, mapItemId: "region-sci" },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

/* 世界地图页回响 feed（§5.1 回响三处露出之二） */
export const ECHO_FEED = [
  { a: "通胀到底是谁的锅", b: "央行加息在加什么", relation: "两条唱反调", videoId: "v1" },
  { a: "赤壁之战的另一种真相", b: "三国里的瘟疫", relation: "互相印证", videoId: "v4" },
  { a: "AI 不会抢你工作", b: "被 AI 取代的第一批人", relation: "正面对撞", videoId: "v8" },
];

export function getVideo(id: string) {
  return VIDEOS[id];
}
export function getCollection(id: string) {
  return COLLECTIONS[id];
}
export function getCategory(id: string) {
  return CATEGORIES[id];
}
export function videosOf(collectionId: string) {
  return COLLECTIONS[collectionId]?.videoIds.map((id) => VIDEOS[id]) ?? [];
}
export function collectionsOf(categoryId: string) {
  return CATEGORIES[categoryId]?.collectionIds.map((id) => COLLECTIONS[id]) ?? [];
}
