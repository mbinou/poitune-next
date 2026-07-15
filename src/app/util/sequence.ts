import { clamp } from "../components/Num";
import { CommonParams } from "../page";
import { LocusSide } from "./defaultSide";

// ===== シーケンス（プリセット再生リスト）の型と再生エンジン =====
// 再生中の角度は「経過実時間の純関数」として閉形式でサンプリングする。
// 増分積分をしないため、ドリフトが無く、effect 再起動やタブ非表示からの
// 復帰でも正確な位置から再開できる。

export type SequenceStep = {
  id: string; // React key / 並べ替え用
  presetName: string; // "ex:..."（ビルトイン）or ユーザープリセット名。再生時に解決
  holdSec: number; // 表示時間（実秒）
  transitionSec: number; // 次ステップへの遷移時間（実秒）
};

export type StoredSequence = { steps: SequenceStep[]; loop: boolean };

export const SEQ_LS_KEY = "poitune-sequences-v1";

// visual は意図的に持たない（v1 のシーケンサーはビジュアルポイ設定を切り替えない）
export type SeqPayload = { common: CommonParams; left: LocusSide; right: LocusSide };

export type Angles4 = { lHand: number; lPoi: number; rHand: number; rPoi: number };

export type ResolvedStep = {
  presetName: string;
  payload: SeqPayload; // 構築時に structuredClone 済み（再生中のプリセット削除に影響されない）
  holdSec: number;
  transitionSec: number;
};

type HoldSegment = {
  kind: "hold";
  stepIdx: number;
  startSec: number;
  durSec: number;
  theta0: Angles4;
};

type TransitionSegment = {
  kind: "transition";
  fromIdx: number;
  toIdx: number;
  startSec: number;
  durSec: number;
  theta0: Angles4; // 遷移開始時（from の hold 終端）の角度
  delta: Angles4; // ランデブー補正（各チャンネル (-π, π]）
};

type Segment = HoldSegment | TransitionSegment;

export type Timeline = {
  steps: ResolvedStep[];
  loop: boolean;
  segments: Segment[];
  totalSec: number; // 1周分。loop 時は剰余で折り返す
};

export type FrameSample = {
  finished: false;
  common: CommonParams;
  left: LocusSide;
  right: LocusSide;
  angles: Angles4;
  uiStepIdx: number; // hold はそのステップ、遷移中は行き先ステップ
  commitIdx: number; // 停止時にコミットするステップ
};

export type SampleResult = FrameSample | { finished: true; commitIdx: number };

export type Resolver = (name: string) => SeqPayload | null;

// ===== 補間プリミティブ =====

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (u: number) => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};

const parseHex = (s: string): [number, number, number] | null => {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
};

export const lerpColor = (a: string, b: string, t: number): string => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return t < 1 ? a : b; // パース不能時はスナップ扱い
  const ch = (i: number) =>
    Math.round(lerp(ca[i], cb[i], t))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};

// bool/enum は「遷移中はソース側、境界で切替」。遷移セグメント内で t=1 は
// サンプリングされない（u=1 時点では次の hold に入っている）ため、切替は
// セグメント境界で構造的に起こる。
export const lerpCommon = (a: CommonParams, b: CommonParams, t: number): CommonParams => ({
  fps: lerp(a.fps, b.fps, t),
  afterimage: lerp(a.afterimage, b.afterimage, t),
  speedRate: lerp(a.speedRate, b.speedRate, t),
  scale: lerp(a.scale, b.scale, t),
  numberOfLocus: t < 1 ? a.numberOfLocus : b.numberOfLocus,
  backgroundColor: lerpColor(a.backgroundColor, b.backgroundColor, t),
  grid: {
    show: t < 1 ? a.grid.show : b.grid.show,
    color: lerpColor(a.grid.color, b.grid.color, t),
  },
});

export const lerpSide = (a: LocusSide, b: LocusSide, t: number): LocusSide => ({
  poiType: (t < 1 ? a.poiType : b.poiType) ?? "normal",
  objectVisible: t < 1 ? { ...a.objectVisible } : { ...b.objectVisible },
  segmentVisible: t < 1 ? { ...a.segmentVisible } : { ...b.segmentVisible },
  objectSize: {
    origin: lerp(a.objectSize.origin, b.objectSize.origin, t),
    hand: lerp(a.objectSize.hand, b.objectSize.hand, t),
    poi: lerp(a.objectSize.poi, b.objectSize.poi, t),
  },
  objectColor: {
    origin: lerpColor(a.objectColor.origin, b.objectColor.origin, t),
    hand: lerpColor(a.objectColor.hand, b.objectColor.hand, t),
    poi: lerpColor(a.objectColor.poi, b.objectColor.poi, t),
  },
  segmentSize: {
    arm: lerp(a.segmentSize.arm, b.segmentSize.arm, t),
    chain: lerp(a.segmentSize.chain, b.segmentSize.chain, t),
  },
  segmentColor: {
    arm: lerpColor(a.segmentColor.arm, b.segmentColor.arm, t),
    chain: lerpColor(a.segmentColor.chain, b.segmentColor.chain, t),
  },
  rotation: {
    radiusHand: lerp(a.rotation.radiusHand, b.rotation.radiusHand, t),
    radiusPoi: lerp(a.rotation.radiusPoi, b.rotation.radiusPoi, t),
    // omega は表示整合用の lerp（角度はエンジンが常に上書きする）
    omegaHand: lerp(a.rotation.omegaHand, b.rotation.omegaHand, t),
    omegaPoi: lerp(a.rotation.omegaPoi, b.rotation.omegaPoi, t),
    angleHand: 0,
    anglePoi: 0,
    originX: lerp(a.rotation.originX, b.rotation.originX, t),
    originY: lerp(a.rotation.originY, b.rotation.originY, t),
  },
});

// ===== 角度の閉形式 =====
// 仮想時間: 既存ループは dt = 実dtms/500 * speedRate なので、
// 1実秒 = VT × speedRate 仮想単位（VT = 1000/500 = 2）。
//
// hold:       θ(t) = θ0 + VT·ω·s·t
// transition: ω と speedRate が両方 smoothstep(u) で lerp されるため、
//             角速度 VT·lerp(ωA,ωB,e)·lerp(sA,sB,e) の積分は閉形式を持つ:
//   E1(u) = ∫e dv  = u³ − u⁴/2                E1(1) = 1/2
//   E2(u) = ∫e² dv = (9/5)u⁵ − 2u⁶ + (4/7)u⁷  E2(1) = 13/35
//   F(u)  = ωA·sA·u + (ωA·Δs + sA·Δω)·E1(u) + Δω·Δs·E2(u)
//   θ_base(u) = θ0 + VT·T·F(u)
// ランデブー補正: Δcorr = wrapPi(θtargetInit − θ_base(1)) を e(u) で加える。
// e'(0)=e'(1)=0 なので両端で角速度が連続（C¹）し、u=1 で
// θ ≡ θtargetInit (mod 2π) が厳密に成立する。ω=0 / speedRate=0 でも除算なし。

const VT = 2;
const TWO_PI = Math.PI * 2;

export const wrapPi = (x: number) => x - TWO_PI * Math.round(x / TWO_PI);

const E1 = (u: number) => u * u * u - (u * u * u * u) / 2;
const E2 = (u: number) => (9 / 5) * u ** 5 - 2 * u ** 6 + (4 / 7) * u ** 7;

type Channel = { omegaA: number; sA: number; omegaB: number; sB: number };

const channelF = (c: Channel, u: number) => {
  const dOmega = c.omegaB - c.omegaA;
  const dS = c.sB - c.sA;
  return c.omegaA * c.sA * u + (c.omegaA * dS + c.sA * dOmega) * E1(u) + dOmega * dS * E2(u);
};

const channels = (a: SeqPayload, b: SeqPayload): Record<keyof Angles4, Channel> => ({
  lHand: {
    omegaA: a.left.rotation.omegaHand,
    sA: a.common.speedRate,
    omegaB: b.left.rotation.omegaHand,
    sB: b.common.speedRate,
  },
  lPoi: {
    omegaA: a.left.rotation.omegaPoi,
    sA: a.common.speedRate,
    omegaB: b.left.rotation.omegaPoi,
    sB: b.common.speedRate,
  },
  rHand: {
    omegaA: a.right.rotation.omegaHand,
    sA: a.common.speedRate,
    omegaB: b.right.rotation.omegaHand,
    sB: b.common.speedRate,
  },
  rPoi: {
    omegaA: a.right.rotation.omegaPoi,
    sA: a.common.speedRate,
    omegaB: b.right.rotation.omegaPoi,
    sB: b.common.speedRate,
  },
});

const initialAngles = (p: SeqPayload): Angles4 => ({
  lHand: p.left.rotation.angleHand,
  lPoi: p.left.rotation.anglePoi,
  rHand: p.right.rotation.angleHand,
  rPoi: p.right.rotation.anglePoi,
});

const holdEndAngles = (p: SeqPayload, holdSec: number): Angles4 => {
  const s = p.common.speedRate;
  const t0 = initialAngles(p);
  return {
    lHand: t0.lHand + VT * p.left.rotation.omegaHand * s * holdSec,
    lPoi: t0.lPoi + VT * p.left.rotation.omegaPoi * s * holdSec,
    rHand: t0.rHand + VT * p.right.rotation.omegaHand * s * holdSec,
    rPoi: t0.rPoi + VT * p.right.rotation.omegaPoi * s * holdSec,
  };
};

// ===== タイムライン構築 =====

const sanitizeSec = (x: number) => clamp(Number.isFinite(x) ? x : 0, 0, 3600);

export const buildTimeline = (
  steps: SequenceStep[],
  loop: boolean,
  resolve: Resolver,
): { ok: true; timeline: Timeline } | { ok: false; missing: string } => {
  const resolved: ResolvedStep[] = [];
  for (const step of steps) {
    const payload = resolve(step.presetName);
    if (!payload) return { ok: false, missing: step.presetName };
    resolved.push({
      presetName: step.presetName,
      payload: structuredClone(payload),
      holdSec: sanitizeSec(step.holdSec),
      transitionSec: sanitizeSec(step.transitionSec),
    });
  }

  const segments: Segment[] = [];
  let cursor = 0;

  // 1ステップ + ループ: 自己遷移による位相スナップを避け、無限 hold にする
  if (loop && resolved.length === 1) {
    segments.push({
      kind: "hold",
      stepIdx: 0,
      startSec: 0,
      durSec: Infinity,
      theta0: initialAngles(resolved[0].payload),
    });
    return {
      ok: true,
      timeline: { steps: resolved, loop, segments, totalSec: Infinity },
    };
  }

  for (let i = 0; i < resolved.length; i++) {
    const cur = resolved[i];
    segments.push({
      kind: "hold",
      stepIdx: i,
      startSec: cursor,
      durSec: cur.holdSec,
      theta0: initialAngles(cur.payload),
    });
    cursor += cur.holdSec;

    const isLast = i === resolved.length - 1;
    if (isLast && !loop) break; // 非ループでは最終ステップの transitionSec は未使用

    const next = resolved[(i + 1) % resolved.length];
    const T = cur.transitionSec;
    const theta0 = holdEndAngles(cur.payload, cur.holdSec);
    const ch = channels(cur.payload, next.payload);
    const target = initialAngles(next.payload);
    const delta: Angles4 = {
      lHand: wrapPi(target.lHand - (theta0.lHand + VT * T * channelF(ch.lHand, 1))),
      lPoi: wrapPi(target.lPoi - (theta0.lPoi + VT * T * channelF(ch.lPoi, 1))),
      rHand: wrapPi(target.rHand - (theta0.rHand + VT * T * channelF(ch.rHand, 1))),
      rPoi: wrapPi(target.rPoi - (theta0.rPoi + VT * T * channelF(ch.rPoi, 1))),
    };
    segments.push({
      kind: "transition",
      fromIdx: i,
      toIdx: (i + 1) % resolved.length,
      startSec: cursor,
      durSec: T,
      theta0,
      delta,
    });
    cursor += T;
  }

  return { ok: true, timeline: { steps: resolved, loop, segments, totalSec: cursor } };
};

// ===== サンプラー =====

export const sampleTimeline = (tl: Timeline, elapsedSec: number): SampleResult => {
  let e = Math.max(0, elapsedSec);
  if (tl.loop) {
    if (Number.isFinite(tl.totalSec)) e = e % tl.totalSec;
  } else if (e >= tl.totalSec) {
    return { finished: true, commitIdx: tl.steps.length - 1 };
  }

  // 0秒セグメント（hold=0 / transition=0 のハードカット）は選ばれず自然にスキップされる
  let seg: Segment | null = null;
  for (const s of tl.segments) {
    if (e < s.startSec + s.durSec) {
      seg = s;
      break;
    }
  }
  if (!seg) seg = tl.segments[tl.segments.length - 1]; // 浮動小数の境界誤差の保険

  if (seg.kind === "hold") {
    const step = tl.steps[seg.stepIdx];
    const p = step.payload;
    const t = e - seg.startSec;
    const s = p.common.speedRate;
    const angles: Angles4 = {
      lHand: seg.theta0.lHand + VT * p.left.rotation.omegaHand * s * t,
      lPoi: seg.theta0.lPoi + VT * p.left.rotation.omegaPoi * s * t,
      rHand: seg.theta0.rHand + VT * p.right.rotation.omegaHand * s * t,
      rPoi: seg.theta0.rPoi + VT * p.right.rotation.omegaPoi * s * t,
    };
    return {
      finished: false,
      common: { ...p.common, grid: { ...p.common.grid } },
      left: withAngles(p.left, angles.lHand, angles.lPoi),
      right: withAngles(p.right, angles.rHand, angles.rPoi),
      angles,
      uiStepIdx: seg.stepIdx,
      commitIdx: seg.stepIdx,
    };
  }

  const a = tl.steps[seg.fromIdx].payload;
  const b = tl.steps[seg.toIdx].payload;
  const u = (e - seg.startSec) / seg.durSec;
  const tEase = smoothstep(u);
  const ch = channels(a, b);
  const angles: Angles4 = {
    lHand: seg.theta0.lHand + VT * seg.durSec * channelF(ch.lHand, u) + seg.delta.lHand * tEase,
    lPoi: seg.theta0.lPoi + VT * seg.durSec * channelF(ch.lPoi, u) + seg.delta.lPoi * tEase,
    rHand: seg.theta0.rHand + VT * seg.durSec * channelF(ch.rHand, u) + seg.delta.rHand * tEase,
    rPoi: seg.theta0.rPoi + VT * seg.durSec * channelF(ch.rPoi, u) + seg.delta.rPoi * tEase,
  };
  return {
    finished: false,
    common: lerpCommon(a.common, b.common, tEase),
    left: withAngles(lerpSide(a.left, b.left, tEase), angles.lHand, angles.lPoi),
    right: withAngles(lerpSide(a.right, b.right, tEase), angles.rHand, angles.rPoi),
    angles,
    uiStepIdx: seg.toIdx,
    commitIdx: seg.toIdx,
  };
};

const withAngles = (side: LocusSide, angleHand: number, anglePoi: number): LocusSide => ({
  ...side,
  rotation: { ...side.rotation, angleHand, anglePoi },
});

// ===== localStorage IO（関数内でのみ localStorage に触れる） =====

export const newStepId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const parseStoredSequence = (raw: string | null): StoredSequence => {
  const fallback: StoredSequence = { steps: [], loop: false };
  if (!raw) return fallback;
  try {
    const obj = JSON.parse(raw) as Partial<StoredSequence>;
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.steps)) return fallback;
    const steps: SequenceStep[] = [];
    for (const s of obj.steps) {
      if (!s || typeof s !== "object") continue;
      const st = s as Partial<SequenceStep>;
      if (typeof st.presetName !== "string" || !st.presetName) continue;
      const sec = (v: unknown, def: number) => {
        const n = Number(v);
        return Number.isFinite(n) ? sanitizeSec(n) : def;
      };
      steps.push({
        id: typeof st.id === "string" && st.id ? st.id : newStepId(),
        presetName: st.presetName,
        holdSec: sec(st.holdSec, 4),
        transitionSec: sec(st.transitionSec, 2),
      });
    }
    return { steps, loop: Boolean(obj.loop) };
  } catch {
    return fallback;
  }
};

export const saveStoredSequence = (seq: StoredSequence): void => {
  try {
    localStorage.setItem(SEQ_LS_KEY, JSON.stringify(seq));
  } catch {
    // quota 等は無視（シーケンスは軽量なので実質発生しない）
  }
};
