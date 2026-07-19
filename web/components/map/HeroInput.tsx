"use client";

import { useId, useState } from "react";
import { submitParse } from "@/lib/client/parsingTracker";

/* 统一输入口（PRD §6.4.1）：单条视频 / 现成合集 / 多条独立链接。
   识别在服务端做（短链展开后才知道是不是合集）：POST /api/parse 建资产并
   后台跑管线。提交后不跳页——入列跟踪即广播，右下角角标自动弹开
   亮出新任务行；解析等待页降级为详情页，从角标任务行点进。 */

type InputState = "idle" | "submitting" | "done" | "error";

export function HeroInput({ compact = false }: { compact?: boolean }) {
  const inputId = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<InputState>("idle");
  const [error, setError] = useState("");

  const submit = async () => {
    if (state === "submitting") return;
    if (!/https?:\/\//.test(value)) {
      setState("error");
      setError("先粘贴一条可识别的链接");
      return;
    }
    setState("submitting");
    try {
      await submitParse(value);
      setValue("");
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message || "解析失败，稍后再试");
    }
  };

  return (
    <div className={`mapInputBlock${compact ? " mapInputBlock--compact" : ""}`}>
      <form
        className={`mapInputRow${state === "error" ? " has-error" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="srOnly" htmlFor={inputId}>
          视频或合集链接
        </label>
        {!compact && (
          <span className="mapInputRow__icon" aria-hidden="true">
            ↗
          </span>
        )}
        <input
          id={inputId}
          type="text"
          inputMode="url"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (state !== "idle") { setState("idle"); setError(""); }
          }}
          placeholder="粘贴视频、合集，或一次粘贴多条链接"
          aria-describedby={`${inputId}-note`}
          aria-invalid={state === "error"}
          disabled={state === "submitting"}
        />
        <button type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "解析中…" : "开始解析"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="mapInputMeta" id={`${inputId}-note`} aria-live="polite">
        {state === "error" && <span className="mapInputMeta__error">{error}</span>}
        {state === "submitting" && (
          <span className="mapInputMeta__success">正在识别链接…合集需要十几秒枚举</span>
        )}
        {state === "done" && (
          <span className="mapInputMeta__success">已提交解析，右下角可查看进度</span>
        )}
        {state === "idle" && !compact && (
          <>
            <span>支持抖音单条视频 / 现成合集 / 自定义视频组</span>
            <span className="mapInputMeta__sample">试用示例 ↗</span>
          </>
        )}
      </div>
    </div>
  );
}
