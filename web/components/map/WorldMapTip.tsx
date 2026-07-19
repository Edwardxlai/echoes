"use client";

import { useEffect, useState } from "react";

/* 新手小贴士（世界页右上角）：首次访问自动展开三行产品介绍，
   关闭后收成 (?) 圆钮并记入 localStorage，之后可随时点开重看。 */

const DISMISS_KEY = "zhiyin.worldTipDismissed";

const TIP_LINES = [
  "粘贴视频链接，「开始解析」会把内容整理成这张知识地图",
  "点选区域进入合集，再深入到单条视频的脉络",
  "「回响」标记不同视频观点之间的互相应答",
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
