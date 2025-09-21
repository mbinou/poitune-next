"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Section } from "./components/Section";
import { Toggle } from "./components/Toggle";
import { clamp, Num } from "./components/Num";
import { Color } from "./components/Color";
import { SidePanel } from "./components/SidePanel";
import { defaultSide, LocusSide, RotationParams } from "./util/defaultSide";
import { examplesMap } from "./util/examplesMap";
import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";

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

  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: "", show: false });
  const toastTimerRef = useRef<number | null>(null);
  const pushToast = (msg: string, ms = 1800) => {
    setToast({ msg, show: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), ms);
  };

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
  }, []);

  const [syncLR, setSyncLR] = useState(false);
  const [activeTab, setActiveTab] = useState<"General" | "Left" | "Right" | "Examples">("General");

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

  const shareParam = useMemo(() => encodeState({ common, left, right }), [common, left, right]);

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
          <a
            href="https://github.com/mbinou/poitune-next"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-70 transition hover:opacity-100"
          >
            <FaGithub />
          </a>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Panels"
          >
            {(["General", "Left", "Right", "Examples"] as const).map((t) => {
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
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-black p-3">
          {/* <div className="w-full overflow-hidden rounded-xl border bg-black">
            <canvas ref={canvasRef} className="block h-auto w-full" />
          </div> */}
          <div className="overflow-hidden rounded-xl border bg-black">
            <canvas ref={canvasRef} width={w} height={h} className="mx-auto block" />
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

        {activeTab === "Examples" && (
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

        <footer className="py-8 text-center text-sm opacity-70">
          © Poitune Next — rebuilt Poitune by mbinou.
        </footer>
      </main>
    </div>
  );
}
