"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "./components/Section";
import { Toggle } from "./components/Toggle";
import { clamp, Num } from "./components/Num";
import { Color } from "./components/Color";
import { SidePanel } from "./components/SidePanel";
import { defaultSide, LocusSide, RotationParams } from "./util/defaultSide";
import { examplesMap } from "./util/examplesMap";
import { useSearchParams, useRouter } from "next/navigation";

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

// ===== URL share utilities =====
type SharePayload = {
  common: CommonParams;
  left: LocusSide;
  right: LocusSide;
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

  const searchParams = useSearchParams();
  const router = useRouter();

  // Restore from ?p= on mount
  useEffect(() => {
    const p = searchParams.get("p");
    if (!p) return;
    const restored = decodeState(p);
    if (!restored) return;
    setCommon((prev) => ({ ...prev, ...restored.common }));
    setLeft(restored.left);
    setRight(restored.right);
    // If you want to remove the query after restore:
    // router.replace("?", { scroll: false });
  }, [searchParams]); // mount only

  const [syncLR, setSyncLR] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "left" | "right" | "examples">("general");

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

    const drawGrid = () => {
      if (!common.grid.show) return;
      ctx.save();
      ctx.strokeStyle = common.grid.color;
      ctx.lineWidth = 1;
      const step = 20;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      ctx.restore();
    };

    // local copies (don’t mutate React state in RAF)
    const l = structuredClone(left);
    const r = structuredClone(right);

    const render = () => {
      const now = performance.now();
      const dt = ((now - prev) / 500) * common.speedRate; // arbitrary scale
      prev = now;

      // afterimage effect
      ctx.globalAlpha = 1 - clamp(common.afterimage, 0, 1);
      ctx.fillStyle = common.backgroundColor;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1;
      drawGrid();

      const sides: LocusSide[] = common.numberOfLocus === 2 ? [l, r] : [l];

      for (const side of sides) {
        const {
          rotation,
          objectVisible,
          objectSize,
          objectColor,
          segmentVisible,
          segmentSize,
          segmentColor,
        } = side;

        rotation.angleHand += rotation.omegaHand * dt;
        rotation.anglePoi += rotation.omegaPoi * dt;

        const hx =
          rotation.originX + Math.cos(rotation.angleHand) * rotation.radiusHand * common.scale;
        const hy =
          rotation.originY + Math.sin(rotation.angleHand) * rotation.radiusHand * common.scale;
        const px = hx + Math.cos(rotation.anglePoi) * rotation.radiusPoi * common.scale;
        const py = hy + Math.sin(rotation.anglePoi) * rotation.radiusPoi * common.scale;

        if (segmentVisible.chain) {
          ctx.strokeStyle = segmentColor.chain;
          ctx.lineWidth = segmentSize.chain;
          ctx.beginPath();
          ctx.moveTo(rotation.originX, rotation.originY);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }

        if (segmentVisible.arm) {
          ctx.strokeStyle = segmentColor.arm;
          ctx.lineWidth = segmentSize.arm;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(px, py);
          ctx.stroke();
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
        if (objectVisible.poi) drawDot(px, py, objectSize.poi, objectColor.poi);
      }

      animId = requestAnimationFrame(render);
    };

    // initial clear
    ctx.fillStyle = common.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    drawGrid();

    prev = performance.now();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [common, left, right, w, h]);

  // ===== share URL =====
  const shareParam = useMemo(() => encodeState({ common, left, right }), [common, left, right]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin + window.location.pathname;
    return `${base}?p=${shareParam}`;
  }, [shareParam]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Copied the share URL!");
    } catch {
      window.prompt("Copy the share URL:", shareUrl);
    }
  };

  const applyExample = (key: string) => {
    const { left: l, right: r, common: c } = examplesMap[key];
    if (syncLR) setSyncLR(false);
    setLeft(l);
    setRight(r);
    if (c) setCommon({ ...common, ...c });
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="sticky top-0 z-10 border-b bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="font-bold tracking-wide">Poitune Next</div>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        {/* <header className="flex items-end justify-between gap-4"></header> */}

        <div className="flex justify-between text-sm">
          <div className="flex gap-2">
            {(["general", "left", "right", "examples"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`rounded-full border px-3 py-2 hover:cursor-pointer ${
                  activeTab === t ? "bg-white text-black" : "bg-transparent"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`rounded-xl border px-3 py-2 hover:cursor-pointer ${
                syncLR ? "bg-white text-black" : "bg-transparent"
              }`}
              onClick={() => setSyncLR((v) => !v)}
            >
              Sync L-R {syncLR ? "ON" : "OFF"}
            </button>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => {
                setCommon(defaultCommon);
                const l = defaultSide(70, 70, 1, -3, 0, 0);
                const r = defaultSide(70, 70, 1, -3, Math.PI, Math.PI);
                setLeft(l);
                setRight(r);
                setSyncLR(false);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-black p-3">
          <div className="overflow-hidden rounded-xl border bg-black">
            <canvas ref={canvasRef} width={w} height={h} className="mx-auto block" />
          </div>

          {/* === URL Share UI === */}
          <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <input
              className="flex-1 rounded border bg-neutral-950 px-2 py-2 text-xs"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-xs hover:cursor-pointer"
                onClick={handleCopy}
              >
                Copy share URL
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-xs hover:cursor-pointer"
                onClick={() => router.replace(`?p=${shareParam}`, { scroll: false })}
              >
                Apply to URL
              </button>
            </div>
          </div>
        </div>

        {activeTab === "general" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="General settings">
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
              <label className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0">Locus count</span>
                <select
                  className="rounded border px-2 py-1"
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

        {activeTab === "left" && (
          <SidePanel
            title="Left"
            side={left}
            setSide={(s) => (syncLR ? applySyncFromLeft(s) : setLeft(s))}
          />
        )}

        {activeTab === "right" && <SidePanel title="Right" side={right} setSide={setRight} />}

        {activeTab === "examples" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Examples">
              <div className="flex flex-wrap gap-2">
                {Object.keys(examplesMap).map((k) => (
                  <button
                    key={k}
                    className="rounded-xl border px-3 py-2 hover:cursor-pointer"
                    onClick={() => applyExample(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm opacity-80">
                Clicking an example overwrites current parameters. Sync L-R will be turned OFF
                automatically.
              </p>
            </Section>
            <Section title="Hints">
              <ul className="list-disc space-y-1 pl-5 text-sm opacity-90">
                <li>Radius/velocity ratios change the petal shape.</li>
                <li>Relative initial angles control vertical/horizontal symmetry.</li>
                <li>Higher afterimage helps visualize trails.</li>
                <li>Grid + lower speed is great for analysis.</li>
              </ul>
            </Section>
          </div>
        )}

        <footer className="py-8 text-center text-sm opacity-70">
          © Poitune Next — rebuilt Poitune by mbino.
        </footer>
      </main>
    </div>
  );
}
