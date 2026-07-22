"use client";

import { useEffect } from "react";
import { ensureDemoJournalSeed, ensureSampleThoughtsSeed } from "@/lib/client/journal";

/* 全局挂在根 layout：任何入口进站（不只是 /me）都补一次示例想法/足迹，
   保证首次打开我的岛屿时想法岛/足迹岛不是空的。只播种一次，见 journal.ts 头注释。
   ensureSampleThoughtsSeed 额外给 /samples 的五模板样例与合集 c1 补想法，独立播种一次。 */
export function JournalDemoSeed() {
  useEffect(() => {
    ensureDemoJournalSeed();
    ensureSampleThoughtsSeed();
  }, []);
  return null;
}
