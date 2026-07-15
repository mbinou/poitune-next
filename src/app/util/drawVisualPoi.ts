import { clamp } from "../components/Num";
import { LocusSide, RotationParams } from "./defaultSide";
import { ColumnData, columnIndex, patternPeriod, VisualPoiParams } from "./visualPoi";

const TWO_PI = Math.PI * 2;

type LedMetrics = {
  r0: number; // 手元〜LED先頭の距離
  spacing: number;
  sizeCore: number;
  sizeGlow: number;
};

const ledMetrics = (
  rot: RotationParams,
  innerFrac: number,
  leds: number,
  commonScale: number,
  viewScale: number,
): LedMetrics => {
  const segLen = rot.radiusPoi * commonScale;
  let r0 = innerFrac * segLen;
  const span = segLen - r0;
  const spacing = leds > 1 ? span / (leds - 1) : 0;
  if (leds === 1) r0 += span; // LED 1灯なら先端に配置
  const sizeCore = clamp(spacing * 0.55, 1.1 / viewScale, 4);
  return { r0, spacing, sizeCore, sizeGlow: sizeCore * 3.1 };
};

const drawLedColumn = (
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  ux: number,
  uy: number,
  m: LedMetrics,
  colIdx: number,
  col: ColumnData,
) => {
  const base = colIdx * col.leds * 4;
  for (let i = 0; i < col.leds; i++) {
    const o = base + i * 4;
    const r = col.data[o];
    const g = col.data[o + 1];
    const b = col.data[o + 2];
    if (r + g + b < 24) continue; // 消灯扱い（ほぼ黒）
    const d = m.r0 + m.spacing * i;
    const x = hx + ux * d;
    const y = hy + uy * d;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(x, y, m.sizeGlow, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, m.sizeCore, 0, TWO_PI);
    ctx.fill();
  }
};

// ライブ描画: 1フレーム分の角度変化を両角サブステップして LED 列を敷き詰める
export const drawVisualSideLive = (
  ctx: CanvasRenderingContext2D,
  rot: RotationParams,
  prevHand: number,
  prevPoi: number,
  col: ColumnData,
  vp: Pick<VisualPoiParams, "innerFrac" | "repeats">,
  commonScale: number,
  viewScale: number,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const m = ledMetrics(rot, vp.innerFrac, col.leds, commonScale, viewScale);
  const dH = rot.angleHand - prevHand;
  const dP = rot.anglePoi - prevPoi;
  const colAngle = TWO_PI / (col.cols * vp.repeats);
  const steps = clamp(Math.ceil(Math.max(Math.abs(dP), Math.abs(dH)) / colAngle), 1, 48);

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const ah = prevHand + dH * t;
    const ap = prevPoi + dP * t;
    const hx = rot.originX + Math.cos(ah) * rot.radiusHand * commonScale;
    const hy = rot.originY + Math.sin(ah) * rot.radiusHand * commonScale;
    drawLedColumn(
      ctx,
      hx,
      hy,
      Math.cos(ap),
      Math.sin(ap),
      m,
      columnIndex(ap, col.cols, vp.repeats),
      col,
    );
  }
  ctx.restore();
};

// 長時間露光: パターン1周期分の LED 列を一括描画（フェードなし）。
// 背景クリア・view 変換・グリッドは呼び出し側が済ませておくこと。
export const renderExposure = (
  ctx: CanvasRenderingContext2D,
  sides: LocusSide[],
  col: ColumnData,
  vp: Pick<VisualPoiParams, "innerFrac" | "repeats">,
  commonScale: number,
  viewScale: number,
) => {
  for (const side of sides) {
    const rot = side.rotation;
    const hx = rot.originX + Math.cos(rot.angleHand) * rot.radiusHand * commonScale;
    const hy = rot.originY + Math.sin(rot.angleHand) * rot.radiusHand * commonScale;
    const px = hx + Math.cos(rot.anglePoi) * rot.radiusPoi * commonScale;
    const py = hy + Math.sin(rot.anglePoi) * rot.radiusPoi * commonScale;
    const isVisual = side.poiType === "visual";

    const drawDot = (x: number, y: number, size: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TWO_PI);
      ctx.fill();
    };

    if (side.segmentVisible.chain) {
      ctx.strokeStyle = side.segmentColor.chain;
      ctx.lineWidth = side.segmentSize.chain;
      ctx.beginPath();
      ctx.moveTo(rot.originX, rot.originY);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    if (side.segmentVisible.arm && !isVisual) {
      ctx.strokeStyle = side.segmentColor.arm;
      ctx.lineWidth = side.segmentSize.arm;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    if (side.objectVisible.origin)
      drawDot(rot.originX, rot.originY, side.objectSize.origin, side.objectColor.origin);
    if (side.objectVisible.hand) drawDot(hx, hy, side.objectSize.hand, side.objectColor.hand);
    if (side.objectVisible.poi && !isVisual)
      drawDot(px, py, side.objectSize.poi, side.objectColor.poi);

    if (!isVisual) continue;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const m = ledMetrics(rot, vp.innerFrac, col.leds, commonScale, viewScale);
    const T = patternPeriod(rot.omegaHand, rot.omegaPoi);
    const colAngle = TWO_PI / (col.cols * vp.repeats);
    const sweep = Math.max(Math.abs(rot.omegaPoi), Math.abs(rot.omegaHand)) * T;
    const steps = T === 0 ? 1 : Math.min(Math.ceil(sweep / colAngle), 40000);

    for (let s = 0; s < steps; s++) {
      const tau = (T * s) / steps;
      const ah = rot.angleHand + rot.omegaHand * tau;
      const ap = rot.anglePoi + rot.omegaPoi * tau;
      const cx = rot.originX + Math.cos(ah) * rot.radiusHand * commonScale;
      const cy = rot.originY + Math.sin(ah) * rot.radiusHand * commonScale;
      drawLedColumn(
        ctx,
        cx,
        cy,
        Math.cos(ap),
        Math.sin(ap),
        m,
        columnIndex(ap, col.cols, vp.repeats),
        col,
      );
    }
    ctx.restore();
  }
};
