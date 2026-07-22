"use client";

import Link from "next/link";
import type { Echo } from "@/lib/data";

/** 焦点荧光：focus 是 text 的子串则划暖金荧光，配不上就素排（管线已校验，这里再兜一层）。 */
export function FocusMark({ text, focus }: { text: string; focus?: string }) {
  const i = focus ? text.indexOf(focus) : -1;
  if (!focus || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="efx">{focus}</span>
      {text.slice(i + focus.length)}
    </>
  );
}

/* 回响块（Spine / SynthesisPoints 共用），方案 D「只留旧方」：
   新方说法=上方节点叙述本身，不复述；这里只出关系词 + 旧方一句（分歧焦点划荧光），
   出处和跳转收在末行。演示数据没有 oldSay，退回"关系句 + 展开"。
   只保留跨视频来源跳转；讨论入口已在 Phase 0 退出。 */
export function EchoBlock({ echo }: { echo: Echo }) {
  return (
    <div className="echoIn">
      {echo.oldSay ? (
        <>
          <div className="er">✦ {echo.relation}</div>
          <div className="eq">
            <FocusMark text={echo.oldSay} focus={echo.oldFocus} />
          </div>
        </>
      ) : (
        <>
          <div className="er">
            ✦ {echo.relation.includes("《") ? echo.relation : `《${echo.targetTitle}》${echo.relation}`}
          </div>
          {echo.sentence && <div className="ef">{echo.sentence}</div>}
        </>
      )}
      {/* 出处行：标题列可收缩省略，链接列定宽不折行——长标题挤压时不再换行错位 */}
      <div className="esrc">
        <span className="esrc-t">
          来自《{echo.targetTitle}》
          {!echo.targetVideoId && <> · {echo.creator} · {echo.timestampText}</>}
        </span>
        {echo.targetVideoId && (
          <Link
            className="ejump"
            href={`/video/${echo.targetVideoId}`}
            onClick={(e) => e.stopPropagation()}
          >
            看解析 →
          </Link>
        )}
      </div>
    </div>
  );
}
