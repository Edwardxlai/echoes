"use client";

import { useState } from "react";
import type { ScenarioDeform, ScenarioRenderData } from "@/lib/analysis-contract";
import { EchoBlock, FocusMark } from "../EchoBlock";

/* 条件推演类：一个可调条件的开关，切换史实链 ↔ 反事实链。三种形变靠边框+褪色区分（不靠颜色，
   暖金留给回响）：转变=实线黑左条、断裂=褪色虚线删除线、分叉=满色虚线黑左条。箭头一律直下。 */
const DEFORM: Record<ScenarioDeform, string> = {
  none: "",
  shift: "is-shift",
  broken: "is-broken",
  fork: "is-fork",
};

export function ScenarioSandbox({ data }: { data: ScenarioRenderData }) {
  const [on, setOn] = useState(false);
  const steps = on ? data.on : data.off;

  return (
    <div className="sb">
      <div className="sb__ctl">
        <span className="q">条件 · {data.condition}</span>
        <button
          type="button"
          className="sw"
          aria-pressed={on}
          onClick={() => setOn((v) => !v)}
        >
          <span className="sw__track" />
          <span className="sw__state">{on ? data.onState : data.offState}</span>
        </button>
      </div>
      <div className="sb__flow">
        <div className="sb__step is-cond">
          <span className="sb__tag">{data.premise.tag}</span>
          <h5>{data.premise.title}</h5>
          <p>
            <FocusMark text={data.premise.detail} focus={data.premise.echo?.nodeFocus} />
          </p>
          {data.premise.echo && <EchoBlock echo={data.premise.echo} />}
        </div>
        {steps.map((s, i) => (
          <div key={i} className={`sb__step ${DEFORM[s.deform]}`.trimEnd()}>
            <span className="sb__tag">{s.tag}</span>
            <h5>{s.title}</h5>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
