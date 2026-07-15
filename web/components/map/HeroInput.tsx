"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

/* 统一输入口（PRD §6.4.1）：单条视频 / 现成合集 / 多条独立链接。
   识别在服务端做（短链展开后才知道是不是合集）：POST /api/parse 建资产并
   后台跑管线，这里只负责提交和跳到对应的解析等待页。 */

type InputState = "idle" | "submitting" | "error";

export function HeroInput({ compact = false }: { compact?: boolean }) {
  const inputId = useId();
  const router = useRouter();
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
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `接入失败（${res.status}）`);
      router.push(
        data.kind === "single"
          ? `/parsing/${data.assetId}`
          : `/parsing/group/${data.groupId}`
      );
    } catch (e) {
      setState("error");
      setError((e as Error).message || "接入失败，稍后再试");
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
          {state === "submitting" ? "接入中…" : "接入脉络"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <div className="mapInputMeta" id={`${inputId}-note`} aria-live="polite">
        {state === "error" && <span className="mapInputMeta__error">{error}</span>}
        {state === "submitting" && (
          <span className="mapInputMeta__success">正在识别链接…合集需要十几秒枚举</span>
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
