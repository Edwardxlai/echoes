"use client";

import { useEffect, useState } from "react";

/* 新手小贴士（世界页右上角）：首次访问自动展开三行产品介绍，
   关闭后收成 (?) 圆钮并记入 localStorage，之后可随时点开重看。 */

const DISMISS_KEY = "zhiyin.worldTipDismissed";

const TIP_LINES = [
  "粘贴一条视频链接，点「开始解析」，AI 会把内容拆解清楚，并生成地图上的一个岛屿",
  "点地图上的区域，能看到一批相关视频；点进某一条，能看到它完整的讲解逻辑",
  "如果两条视频讲的内容有关联，系统会自动识别出来并标成「回响」，点开就能看到两边具体说了什么、怎么呼应上的",
];

export function WorldMapTip() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(DISMISS_KEY)) setOpen(true);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 隐私模式下写入失败也无妨，只影响下次是否自动展开 */
    }
  };

  return (
    <div className="worldMapTip">
      {open ? (
        <aside className="worldMapTip__card" aria-label="产品简介">
          <button
            type="button"
            className="worldMapTip__close"
            aria-label="关闭产品简介"
            onClick={dismiss}
          >
            ×
          </button>
          <p className="worldMapTip__eyebrow">知音 · 这是什么？</p>
          <ul className="worldMapTip__list">
            {TIP_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      ) : (
        <button
          type="button"
          className="worldMapTip__toggle"
          aria-label="查看产品简介"
          onClick={() => setOpen(true)}
        >
          ?
        </button>
      )}
    </div>
  );
}
