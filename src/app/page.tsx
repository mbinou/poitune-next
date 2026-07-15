"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Section } from "./components/Section";
import { Toggle } from "./components/Toggle";
import { clamp, Num } from "./components/Num";
import { Color } from "./components/Color";
import { SidePanel } from "./components/SidePanel";
import { VisualPoiPanel } from "./components/VisualPoiPanel";
import { defaultSide, LocusSide, RotationParams } from "./util/defaultSide";
import { examplesMap } from "./util/examplesMap";
import { useRouter } from "next/navigation";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import {
  defaultVisualPoi,
  fileToDataUrl,
  mergeVisual,
  sanitizeVisualForShare,
  VisualPoiParams,
} from "./util/visualPoi";
import { useColumnData } from "./util/useColumnData";
import { drawVisualSideLive, renderExposure } from "./util/drawVisualPoi";
import { SequencePanel } from "./components/SequencePanel";
import {
  Angles4,
  buildTimeline,
  parseStoredSequence,
  Resolver,
  sampleTimeline,
  saveStoredSequence,
  SEQ_LS_KEY,
  SequenceStep,
  Timeline,
  wrapPi,
} from "./util/sequence";

export type CommonParams = {
  fps: number;
  afterimage: number; // 0..1
  speedRate: number; // 0.1..10
  scale: number; // 0.1..10
  numberOfLocus: 1 | 2; // 1=Left only / 2=Both
  backgroundColor: string;
  grid: { show: boolean; color: string };
};

const defaultCommon: CommonParams = {
  fps: 30,
  afterimage: 0.9,
  speedRate: 1,
  scale: 1,
  numberOfLocus: 2,
  backgroundColor: "#000000",
  grid: { show: true, color: "#333333" },
};

const BUILTIN_PREFIX = "ex:"; // 内部識別用（UI には出さない）

const builtInPresets: PresetMap = Object.fromEntries(
  Object.entries(examplesMap).map(([k, v]) => [
    `${BUILTIN_PREFIX}${k}`,
    {
      // common が未指定の Example もある想定なので defaultCommon をベースにマージ
      common: v.common ? { ...defaultCommon, ...v.common } : { ...defaultCommon },
      left: v.left,
      right: v.right,
    },
  ]),
);

// name が built-in かどうか
const isBuiltIn = (name: string) => name.startsWith(BUILTIN_PREFIX);

// 表示名（UI 用に prefix を外す）
const displayName = (name: string) => (isBuiltIn(name) ? name.slice(BUILTIN_PREFIX.length) : name);

type SharePayload = {
  common: CommonParams;
  left: LocusSide;
  right: LocusSide;
  visual?: VisualPoiParams;
};

const LS_KEY = "poitune-presets-v1";
type PresetMap = Record<string, SharePayload>;

// シーケンス再生の実体（React state に置かず ref で保持し、RAF が毎フレーム読む）
type PlaybackState = {
  timeline: Timeline;
  startTime: number; // performance.now() の絶対値 → effect 再起動やタブ非表示に耐える
  lastAngles: Angles4 | null; // ビジュアルポイのサブステップ用 prev 角
  lastUiStepIdx: number; // setSeqCurrentStep の変化ガード
  lastCommitIdx: number; // 手動停止時にコミットするステップ
};

const safeParsePresets = (raw: string | null): PresetMap => {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as PresetMap) : {};
  } catch {
    return {};
  }
};

const encodeState = (payload: SharePayload) => {
  const json = JSON.stringify(payload);
  return typeof window === "undefined" ? "" : btoa(unescape(encodeURIComponent(json)));
};

const decodeState = (p: string): SharePayload | null => {
  try {
    const json = decodeURIComponent(escape(atob(p)));
    const obj = JSON.parse(json);
    if (!obj || !obj.common || !obj.left || !obj.right) return null;
    return obj as SharePayload;
  } catch {
    return null;
  }
};

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [w, h] = [640, 340];

  const [common, setCommon] = useState<CommonParams>(defaultCommon);
  const [left, setLeft] = useState<LocusSide>(() => defaultSide(70, 70, 1, -3, 0, 0));
  const [right, setRight] = useState<LocusSide>(() => defaultSide(70, 70, 1, -3, Math.PI, Math.PI));

  // ===== Visual poi (POV/LED) =====
  const [visual, setVisual] = useState<VisualPoiParams>(defaultVisualPoi);
  const { columnDataRef, columnVersion } = useColumnData(visual);

  // ===== Sequence (パターン遷移の再生リスト) =====
  const [seqSteps, setSeqSteps] = useState<SequenceStep[]>([]);
  const [seqLoop, setSeqLoop] = useState(false);
  const [seqPlaying, setSeqPlaying] = useState(false); // 描画 effect の依存に入れる
  const [seqCurrentStep, setSeqCurrentStep] = useState(-1); // UI ハイライト専用（依存に入れない）
  const playbackRef = useRef<PlaybackState | null>(null);
  const seqLoadedRef = useRef(false);

  useEffect(() => {
    const s = parseStoredSequence(localStorage.getItem(SEQ_LS_KEY));
    setSeqSteps(s.steps);
    setSeqLoop(s.loop);
    seqLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!seqLoadedRef.current) return;
    saveStoredSequence({ steps: seqSteps, loop: seqLoop });
  }, [seqSteps, seqLoop]);

  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: "", show: false });
  const toastTimerRef = useRef<number | null>(null);
  const pushToast = useCallback((msg: string, ms = 1800) => {
    setToast({ msg, show: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), ms);
  }, []);

  const applyImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        setVisual((v) => ({ ...v, imageSource: { kind: "upload", dataUrl } }));
        pushToast("画像を読み込みました");
      } catch {
        pushToast("画像の読み込みに失敗しました");
      }
    },
    [pushToast],
  );

  const router = useRouter();

  // Restore from ?p= on mount
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("p");
    if (!p) return;
    const restored = decodeState(p);
    if (!restored) return;
    setCommon((prev) => ({ ...prev, ...restored.common }));
    setLeft(restored.left);
    setRight(restored.right);
    if (restored.visual) setVisual(mergeVisual(restored.visual));
  }, []);

  const [syncLR, setSyncLR] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "General" | "Left" | "Right" | "Visual Poi" | "Sequence" | "Examples"
  >("General");

  // ===== Presets (state) =====
  const [userPresets, setUserPresets] = useState<PresetMap>({});

  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  // 初期ロード
  useEffect(() => {
    const loaded = safeParsePresets(localStorage.getItem(LS_KEY));
    setUserPresets(loaded);
    const names = [
      ...Object.keys(builtInPresets).map((n) => n),
      ...Object.keys(loaded).map((n) => n),
    ];
    if (names.length) setSelectedPreset(names[0]);
  }, []);

  const currentPayload: SharePayload = useMemo(
    () => ({ common, left, right, visual }),
    [common, left, right, visual],
  );

  const savePreset = (name: string, overwrite = false) => {
    const trimmed = name.trim();
    if (!trimmed) return pushToast("Enter a preset name");

    // built-in と同名は禁止
    if (builtInPresets[`${BUILTIN_PREFIX}${trimmed}`]) {
      return pushToast("This name is reserved for a built-in example");
    }

    if (!overwrite && userPresets[trimmed]) {
      return pushToast("Name exists (use Overwrite)");
    }
    if (overwrite && !userPresets[trimmed]) {
      return pushToast("Nothing to overwrite");
    }

    // 大きすぎるアップロード画像は localStorage 圧迫を避けてサンプルにフォールバック
    const tooLarge =
      visual.imageSource.kind === "upload" && visual.imageSource.dataUrl.length > 400_000;
    const payload: SharePayload = tooLarge
      ? { ...currentPayload, visual: sanitizeVisualForShare(visual) }
      : currentPayload;

    const next = { ...userPresets, [trimmed]: payload };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      return pushToast("保存容量を超えたためプリセットを保存できませんでした");
    }
    setUserPresets(next);
    setSelectedPreset(trimmed);
    if (tooLarge) pushToast("画像が大きいためプリセットには保存されません");
    else pushToast(overwrite ? "Preset overwritten" : "Preset saved");
  };

  const loadPreset = (name: string) => {
    const p = isBuiltIn(name) ? builtInPresets[name] : userPresets[name];

    if (!p) return;
    setCommon((prev) => ({ ...prev, ...p.common }));
    setLeft(p.left);
    setRight(p.right);
    setVisual(p.visual ? mergeVisual(p.visual) : defaultVisualPoi);
    pushToast(`Loaded "${displayName(name)}"`);
  };

  const deletePreset = (name: string) => {
    if (isBuiltIn(name)) {
      return pushToast("Built-in presets cannot be deleted");
    }
    if (!userPresets[name]) return;

    const { [name]: _, ...rest } = userPresets;
    setUserPresets(rest);
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
    // 次の選択：残っている built-in > user の順で先頭
    const nextNames = [...Object.keys(builtInPresets), ...Object.keys(rest)];
    setSelectedPreset(nextNames[0] ?? "");
    pushToast(`Deleted "${name}"`);
  };

  // ===== Sequence 再生制御 =====
  const startSequence = () => {
    if (seqPlaying || seqSteps.length === 0) return;
    const resolver: Resolver = (name) => {
      const p = isBuiltIn(name) ? builtInPresets[name] : userPresets[name];
      if (!p) return null;
      // visual はシーケンスでは切り替えない（グローバル設定を使用）ため捨てる
      return { common: { ...defaultCommon, ...p.common }, left: p.left, right: p.right };
    };
    const res = buildTimeline(seqSteps, seqLoop, resolver);
    if (!res.ok) {
      return pushToast(
        `プリセット「${displayName(res.missing)}」が見つかりません。再生を中止しました`,
      );
    }
    if (res.timeline.loop && res.timeline.totalSec <= 0) {
      return pushToast("合計時間が 0 のためループ再生できません");
    }
    playbackRef.current = {
      timeline: res.timeline,
      startTime: performance.now(),
      lastAngles: null,
      lastUiStepIdx: -1,
      lastCommitIdx: 0,
    };
    setSeqCurrentStep(0);
    setSeqPlaying(true);
  };

  // 停止時は補間途中の値ではなく「現在向かっているステップ」のプリセットをコミットする
  const commitSequenceStep = (pb: PlaybackState | null, commitIdx: number) => {
    const p = pb?.timeline.steps[commitIdx]?.payload;
    if (p) {
      setCommon((prev) => ({ ...prev, ...p.common }));
      setLeft(structuredClone(p.left));
      setRight(structuredClone(p.right));
      // setVisual は呼ばない（シーケンスは visual を扱わない）
    }
  };

  const stopSequence = () => {
    const pb = playbackRef.current;
    playbackRef.current = null;
    setSeqPlaying(false);
    setSeqCurrentStep(-1);
    if (pb) commitSequenceStep(pb, pb.lastCommitIdx);
  };

  // View state (pan & zoom)
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });

  const dragRef = useRef<{
    dragging: boolean;
    sx: number;
    sy: number;
    tx0: number;
    ty0: number;
  } | null>(null);

  // Pointer drag to pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      // 左クリックのみ開始（タッチは button===0 で来るのでOK）
      if (e.button !== 0) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = {
        dragging: true,
        sx: e.clientX,
        sy: e.clientY,
        tx0: view.tx,
        ty0: view.ty,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const dr = dragRef.current; // ← ローカルに退避
      if (!dr || !dr.dragging) return;
      const dx = e.clientX - dr.sx;
      const dy = e.clientY - dr.sy;
      // dr が存在する前提で dr.tx0 / dr.ty0 を参照
      setView((v) => ({ ...v, tx: dr.tx0 + dx, ty: dr.ty0 + dy }));
    };

    const end = (_e?: PointerEvent) => {
      dragRef.current = null;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", end);
    canvas.addEventListener("lostpointercapture", end);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("pointerleave", end);
      canvas.removeEventListener("lostpointercapture", end);
    };
    // view.tx / view.ty は pointerdown 時点で取り込むだけなので依存は無くてもOK。
    // ただし「常に最新の tx/ty からドラッグ開始したい」意図なら依存に入れてもよいです。
  }, [view.tx, view.ty]);

  // Wheel to zoom (cursor-centered)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoom = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const newScale = clamp(v.scale * zoom, 0.25, 4);
        const k = newScale / v.scale;
        // keep cursor position visually fixed
        const tx = cx - k * (cx - v.tx);
        const ty = cy - k * (cy - v.ty);
        return { tx, ty, scale: newScale };
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Visual poi: 画像のドラッグ＆ドロップ / クリップボード貼り付け
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) applyImageFile(f);
    };
    const onPaste = (e: ClipboardEvent) => {
      // 入力欄への貼り付け（hex カラー等）は妨げない
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) applyImageFile(f);
          break;
        }
      }
    };

    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [applyImageFile]);

  // Sync L->R (add +180° to initial angles)
  const applySyncFromLeft = (nextLeft: LocusSide) => {
    setLeft(nextLeft);
    if (syncLR) {
      const l = nextLeft.rotation;
      const rRot: RotationParams = {
        ...l,
        angleHand: l.angleHand + Math.PI,
        anglePoi: l.anglePoi + Math.PI,
      };
      setRight({ ...nextLeft, rotation: rRot });
    }
  };

  // ===== Render loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev = performance.now();

    const drawGrid = (grid: CommonParams["grid"]) => {
      if (!grid.show) return;
      ctx.save();
      ctx.strokeStyle = grid.color;
      ctx.lineWidth = 1 / view.scale; // keep roughly 1px appearance
      // visible world-rect from screen rect
      const vw = {
        left: -view.tx / view.scale,
        top: -view.ty / view.scale,
        right: (w - view.tx) / view.scale,
        bottom: (h - view.ty) / view.scale,
      };
      const step = 10;
      const startX = Math.floor(vw.left / step) * step;
      const startY = Math.floor(vw.top / step) * step;

      ctx.beginPath();
      for (let x = startX; x <= vw.right; x += step) {
        ctx.moveTo(x + 0.5, vw.top);
        ctx.lineTo(x + 0.5, vw.bottom);
      }
      for (let y = startY; y <= vw.bottom; y += step) {
        ctx.moveTo(vw.left, y + 0.5);
        ctx.lineTo(vw.right, y + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    };

    // local copies (don’t mutate React state in RAF)
    const l = structuredClone(left);
    const r = structuredClone(right);

    const shownSides: LocusSide[] = common.numberOfLocus === 2 ? [l, r] : [l];
    const anyVisual = shownSides.some((s) => (s.poiType ?? "normal") === "visual");

    // 長時間露光: パターン1周期分を静的に一括描画（RAF なし）。シーケンス再生中はバイパス
    if (!seqPlaying && visual.exposure && anyVisual && columnDataRef.current) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = common.backgroundColor;
      ctx.fillRect(0, 0, w, h);
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);
      drawGrid(common.grid);
      renderExposure(ctx, shownSides, columnDataRef.current, visual, common.scale, view.scale);
      return;
    }

    // side 1つ分の描画（角度は確定済み。prev 角はビジュアルポイのサブステップ用）
    const drawSideFrame = (
      side: LocusSide,
      prevHand: number,
      prevPoi: number,
      fc: CommonParams,
    ) => {
      const {
        rotation,
        objectVisible,
        objectSize,
        objectColor,
        segmentVisible,
        segmentSize,
        segmentColor,
      } = side;

      const colData = columnDataRef.current;
      const isVisual = (side.poiType ?? "normal") === "visual" && colData !== null;

      const hx = rotation.originX + Math.cos(rotation.angleHand) * rotation.radiusHand * fc.scale;
      const hy = rotation.originY + Math.sin(rotation.angleHand) * rotation.radiusHand * fc.scale;
      const px = hx + Math.cos(rotation.anglePoi) * rotation.radiusPoi * fc.scale;
      const py = hy + Math.sin(rotation.anglePoi) * rotation.radiusPoi * fc.scale;

      if (segmentVisible.chain) {
        ctx.strokeStyle = segmentColor.chain;
        ctx.lineWidth = segmentSize.chain;
        ctx.beginPath();
        ctx.moveTo(rotation.originX, rotation.originY);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }

      // ビジュアルポイでは Arm 線が LED バーを塗り潰してしまうため描かない（露光モードと同じ扱い）
      if (segmentVisible.arm && !isVisual) {
        ctx.strokeStyle = segmentColor.arm;
        ctx.lineWidth = segmentSize.arm;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      if (isVisual && colData) {
        drawVisualSideLive(ctx, rotation, prevHand, prevPoi, colData, visual, fc.scale, view.scale);
      }

      const drawDot = (x: number, y: number, size: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      };
      if (objectVisible.origin)
        drawDot(rotation.originX, rotation.originY, objectSize.origin, objectColor.origin);
      if (objectVisible.hand) drawDot(hx, hy, objectSize.hand, objectColor.hand);
      if (objectVisible.poi && !isVisual) drawDot(px, py, objectSize.poi, objectColor.poi);
    };

    // シーケンスの自然終了（非ループ）: 行き先ステップをコミットして停止
    const finishPlayback = (commitIdx: number) => {
      const pb = playbackRef.current;
      playbackRef.current = null;
      const p = pb?.timeline.steps[commitIdx]?.payload;
      if (p) {
        setCommon((prevC) => ({ ...prevC, ...p.common }));
        setLeft(structuredClone(p.left));
        setRight(structuredClone(p.right));
      }
      setSeqPlaying(false);
      setSeqCurrentStep(-1);
    };

    const render = () => {
      const now = performance.now();
      const pb = seqPlaying ? playbackRef.current : null;

      let fc: CommonParams;
      const frame: { side: LocusSide; prevHand: number; prevPoi: number }[] = [];

      if (pb) {
        // ===== シーケンス再生: 経過実時間の純関数としてサンプリング =====
        const s = sampleTimeline(pb.timeline, (now - pb.startTime) / 1000);
        if (s.finished) {
          finishPlayback(s.commitIdx);
          return; // 次の RAF は予約しない（state 変化で effect が再起動する）
        }
        fc = s.common;
        const pa = pb.lastAngles ?? s.angles;
        // 遷移終端・ループ折返しでは角度の数値が 2πk 飛ぶ（位相は同一）。
        // ビジュアルポイのサブステップが全周スミアを描かないよう、
        // prev 角を現在角の ±π 以内にラップしてから渡す。
        const wrapPrev = (cur: number, prevA: number) => cur + wrapPi(prevA - cur);
        frame.push({
          side: s.left,
          prevHand: wrapPrev(s.angles.lHand, pa.lHand),
          prevPoi: wrapPrev(s.angles.lPoi, pa.lPoi),
        });
        if (fc.numberOfLocus === 2) {
          frame.push({
            side: s.right,
            prevHand: wrapPrev(s.angles.rHand, pa.rHand),
            prevPoi: wrapPrev(s.angles.rPoi, pa.rPoi),
          });
        }
        pb.lastAngles = s.angles;
        pb.lastCommitIdx = s.commitIdx;
        if (s.uiStepIdx !== pb.lastUiStepIdx) {
          pb.lastUiStepIdx = s.uiStepIdx;
          setSeqCurrentStep(s.uiStepIdx); // effect 依存に無いので再起動しない
        }
      } else {
        // ===== 通常: 増分で角度を前進 =====
        const dt = ((now - prev) / 500) * common.speedRate; // arbitrary scale
        fc = common;
        const sides: LocusSide[] = common.numberOfLocus === 2 ? [l, r] : [l];
        for (const side of sides) {
          const rotation = side.rotation;
          const prevHand = rotation.angleHand;
          const prevPoi = rotation.anglePoi;
          rotation.angleHand += rotation.omegaHand * dt;
          rotation.anglePoi += rotation.omegaPoi * dt;
          frame.push({ side, prevHand, prevPoi });
        }
      }
      prev = now;

      // 1) reset transform (screen space)
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // 2) afterimage background clear in screen space
      ctx.globalAlpha = 1 - clamp(fc.afterimage, 0, 1);
      ctx.fillStyle = fc.backgroundColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // 3) apply view (pan & zoom)
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);

      // 4) draw grid & content in world space
      drawGrid(fc.grid);
      for (const f of frame) drawSideFrame(f.side, f.prevHand, f.prevPoi, fc);

      animId = requestAnimationFrame(render);
    };

    // initial clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = common.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    prev = performance.now();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    common,
    left,
    right,
    w,
    h,
    view.tx,
    view.ty,
    view.scale,
    visual,
    columnVersion,
    columnDataRef,
    seqPlaying, // 再生開始/停止でのみ再起動（ステップ境界では再起動しない＝残像維持）
  ]);

  const shareParam = useMemo(
    () => encodeState({ common, left, right, visual: sanitizeVisualForShare(visual) }),
    [common, left, right, visual],
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin + window.location.pathname;
    return `${base}?p=${shareParam}`;
  }, [shareParam]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      pushToast("Copied share URL");
    } catch {
      pushToast("Clipboard unavailable. Select & copy manually");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <Header />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="rounded-2xl border bg-black p-3">
          <div className="overflow-hidden rounded-xl border bg-black">
            <canvas
              ref={canvasRef}
              width={w}
              height={h}
              className="mx-auto block aspect-[32/17] w-full touch-none hover:cursor-move"
            />
          </div>

          {/* URL Share 行：モバイルで縦積み、sm以上で横並び */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              className="min-w-0 flex-1 rounded border bg-neutral-950 px-3 py-2 text-xs sm:text-[13px]"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <button
                className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer"
                onClick={handleCopy}
              >
                Copy Share URL
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer"
                onClick={() => router.replace(`?p=${shareParam}`, { scroll: false })}
              >
                Apply to URL
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {/* Save */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-neutral-950/50 p-3">
              <div className="text-sm font-semibold opacity-80 sm:text-xs">Save Preset</div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="min-w-0 flex-1 rounded border bg-neutral-950 px-3 py-2 text-sm sm:text-xs"
                  placeholder="Preset name (e.g. Clover-Blue)"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <button
                    className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer"
                    onClick={() => savePreset(presetName, false)}
                  >
                    Save
                  </button>
                  <button
                    className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer"
                    onClick={() => savePreset(presetName, true)}
                  >
                    Overwrite
                  </button>
                </div>
              </div>

              <p className="text-[12px] opacity-60 sm:text-[11px]">
                Saves current parameters (general/left/right) to your browser.
              </p>
            </div>

            {/* Load/Delete */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-neutral-950/50 p-3">
              <div className="text-sm font-semibold opacity-80 sm:text-xs">
                Load / Delete My Presets
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="min-w-0 flex-1 rounded border bg-neutral-950 px-3 py-2 pr-8 text-sm sm:text-xs"
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                >
                  {/* Built-in */}
                  <optgroup label="Built-in (Examples)">
                    {Object.keys(builtInPresets)
                      .sort((a, b) =>
                        displayName(a).localeCompare(displayName(b), undefined, {
                          sensitivity: "base",
                        }),
                      )
                      .map((n) => (
                        <option key={n} value={n}>
                          {displayName(n)} {/* prefix を外して表示 */}
                        </option>
                      ))}
                  </optgroup>

                  {/* User */}
                  <optgroup label="My Presets">
                    {Object.keys(userPresets)
                      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    {Object.keys(userPresets).length === 0 && (
                      <option value="">(No presets)</option>
                    )}
                  </optgroup>
                </select>

                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <button
                    disabled={!selectedPreset}
                    className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer"
                    onClick={() => selectedPreset && loadPreset(selectedPreset)}
                  >
                    Load
                  </button>
                  <button
                    disabled={!selectedPreset || isBuiltIn(selectedPreset)}
                    className="rounded-xl border px-3 py-2 text-xs whitespace-nowrap hover:cursor-pointer disabled:opacity-40"
                    onClick={() => selectedPreset && deletePreset(selectedPreset)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-[12px] opacity-60 sm:text-[11px]">
                Presets are stored only on this browser.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Panels"
          >
            {(["General", "Left", "Right", "Visual Poi", "Sequence"] as const).map((t) => {
              const active = activeTab === t;
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t}`}
                  onClick={() => setActiveTab(t)}
                  className={[
                    "rounded-full border px-3 py-2 text-xs whitespace-nowrap",
                    "hover:cursor-pointer focus:ring-2 focus:ring-white/40 focus:outline-none",
                    active ? "bg-white text-black" : "bg-transparent",
                  ].join(" ")}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={[
                "rounded-full border px-3 py-2 text-xs whitespace-nowrap",
                "hover:cursor-pointer focus:ring-2 focus:ring-white/40 focus:outline-none",
                syncLR ? "bg-white text-black" : "bg-transparent",
              ].join(" ")}
              onClick={() => setSyncLR((v) => !v)}
            >
              Sync L-R {syncLR ? "ON" : "OFF"}
            </button>

            <button
              className={[
                "rounded-full border px-3 py-2 text-xs whitespace-nowrap",
                "hover:cursor-pointer focus:ring-2 focus:ring-white/40 focus:outline-none",
              ].join(" ")}
              onClick={() => {
                setCommon(defaultCommon);
                const l = defaultSide(70, 70, 1, -3, 0, 0);
                const r = defaultSide(70, 70, 1, -3, Math.PI, Math.PI);
                setLeft(l);
                setRight(r);
                setSyncLR(false);
                setVisual(defaultVisualPoi);
                setView({ tx: 0, ty: 0, scale: 1 });
              }}
            >
              Reset
            </button>

            <button
              className={[
                "rounded-full border px-3 py-2 text-xs whitespace-nowrap",
                "hover:cursor-pointer focus:ring-2 focus:ring-white/40 focus:outline-none",
              ].join(" ")}
              onClick={() => setView({ tx: 0, ty: 0, scale: 1 })}
            >
              Reset View
            </button>
          </div>
        </div>

        {activeTab === "General" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="General Settings">
              <Num
                label="FPS"
                value={common.fps}
                min={1}
                max={240}
                onChange={(v) => setCommon({ ...common, fps: v })}
              />
              <Num
                label="Afterimage (0..1)"
                value={common.afterimage}
                step={0.05}
                min={0}
                max={1}
                onChange={(v) => setCommon({ ...common, afterimage: v })}
              />
              <Num
                label="Speed rate"
                value={common.speedRate}
                step={0.1}
                min={0.1}
                max={10}
                onChange={(v) => setCommon({ ...common, speedRate: v })}
              />
              <Num
                label="Scale"
                value={common.scale}
                step={0.1}
                min={0.1}
                max={10}
                onChange={(v) => setCommon({ ...common, scale: v })}
              />
              <label className={"flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center"}>
                <span className="shrink-0 sm:w-36">Locus count</span>
                <select
                  className="min-w-0 flex-1 rounded border px-2 py-1"
                  value={common.numberOfLocus}
                  onChange={(e) =>
                    setCommon({
                      ...common,
                      numberOfLocus: Number(e.target.value) as 1 | 2,
                    })
                  }
                >
                  <option value={2}>Both</option>
                  <option value={1}>Left only</option>
                </select>
              </label>
              <Color
                label="Background color"
                value={common.backgroundColor}
                onChange={(v) => setCommon({ ...common, backgroundColor: v })}
              />
            </Section>
            <Section title="Grid">
              <Toggle
                label="Show"
                value={common.grid.show}
                onChange={(v) => setCommon({ ...common, grid: { ...common.grid, show: v } })}
              />
              <Color
                label="Color"
                value={common.grid.color}
                onChange={(v) => setCommon({ ...common, grid: { ...common.grid, color: v } })}
              />
            </Section>
          </div>
        )}

        {activeTab === "Left" && (
          <SidePanel
            title="Left"
            side={left}
            setSide={(s) => (syncLR ? applySyncFromLeft(s) : setLeft(s))}
          />
        )}

        {activeTab === "Right" && <SidePanel title="Right" side={right} setSide={setRight} />}

        {activeTab === "Visual Poi" && (
          <VisualPoiPanel visual={visual} setVisual={setVisual} onImageFile={applyImageFile} />
        )}

        {activeTab === "Sequence" && (
          <SequencePanel
            steps={seqSteps}
            setSteps={setSeqSteps}
            loop={seqLoop}
            setLoop={setSeqLoop}
            playing={seqPlaying}
            currentStep={seqCurrentStep}
            builtInNames={Object.keys(builtInPresets).sort((a, b) =>
              displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" }),
            )}
            userNames={Object.keys(userPresets).sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: "base" }),
            )}
            displayName={displayName}
            onPlay={startSequence}
            onStop={stopSequence}
          />
        )}

        <div
          className={[
            "fixed bottom-5 left-1/2 -translate-x-1/2",
            "transition-all duration-200",
            toast.show
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0",
          ].join(" ")}
          aria-live="polite"
        >
          <div className="rounded-xl border border-white/15 bg-neutral-950/80 px-3 py-2 text-sm backdrop-blur">
            {toast.msg}
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}
