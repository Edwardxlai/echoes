"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/* 统一输入口的类型识别（PRD §6.4.1）：单条视频 / 现成合集 / 多条独立链接。
   真实产品里短链要服务端展开后才能判断是不是合集（eval/server.mjs 已实现）；
   这里是前端演示版，只按 URL 特征分流，v.douyin 短链一律按单视频处理。 */
const URL_RE = /https?:\/\/[^\s，。、"'<>【】]+/g;
const COLLECTION_RE = /\/mix\/detail\/\d+|\/collection\/\d+|[?&]object_id=\d+/;

type LinkKind = "single" | "collection" | "multi";
type InputState = "idle" | "empty" | LinkKind;

const KIND_LABEL: Record<LinkKind, string> = {
  single: "单条视频，进入解析页",
  collection: "现成合集，进入合集解析页",
  multi: "多条独立视频，进入合集解析页",
};

/* 演示数据落点：单视频 → v1 解析页；合集/多视频 → c1 的合集解析结果页 */
const KIND_ROUTE: Record<LinkKind, string> = {
  single: "/video/v1",
  collection: "/collection/c1/synthesis",
  multi: "/collection/c1/synthesis",
};

function classify(text: string): LinkKind | null {
  const urls = text.match(URL_RE) ?? [];
  if (!urls.length) return null;
  if (urls.length > 1) return "multi";
  return COLLECTION_RE.test(urls[0]!) ? "collection" : "single";
}

export function HeroInput() {
  const inputId = useId();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<InputState>("idle");

  return (
    <div className="mapInputBlock">
      <form
        className={`mapInputRow${state === "empty" ? " has-error" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          const kind = classify(value);
          if (!kind) {
            setState("empty");
            return;
          }
          setState(kind);
          router.push(KIND_ROUTE[kind]);
        }}
      >
        <label className="srOnly" htmlFor={inputId}>
          视频或合集链接
        </label>
        <span className="mapInputRow__icon" aria-hidden="true">
          ↗
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="url"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (state !== "idle") setState("idle");
          }}
          placeholder="粘贴视频、合集，或一次粘贴多条链接"
          aria-describedby={`${inputId}-note`}
          aria-invalid={state === "empty"}
        />
        <button type="submit">
          接入脉络
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="mapInputMeta" id={`${inputId}-note`} aria-live="polite">
        {state === "empty" && <span className="mapInputMeta__error">先粘贴一条可识别的链接</span>}
        {state !== "empty" && state !== "idle" && (
          <span className="mapInputMeta__success">识别为{KIND_LABEL[state]}（演示数据）…</span>
        )}
        {state === "idle" && (
          <>
            <span>支持单条视频 / 现成合集 / 自定义视频组</span>
            <span className="mapInputMeta__sample">试用示例 ↗</span>
          </>
        )}
      </div>
    </div>
  );
}
