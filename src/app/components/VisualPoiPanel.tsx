import { useEffect, useRef } from "react";
import {
  buildStripImageData,
  loadSourceImage,
  SAMPLE_IMAGE_LABELS,
  SampleImageId,
  sourceSize,
  VisualPoiParams,
} from "../util/visualPoi";
import { Num } from "./Num";
import { Section } from "./Section";
import { Toggle } from "./Toggle";

type Props = {
  visual: VisualPoiParams;
  setVisual: (v: VisualPoiParams) => void;
  onImageFile: (f: File) => void;
};

export const VisualPoiPanel = ({ visual, setVisual, onImageFile }: Props) => {
  const origPrevRef = useRef<HTMLCanvasElement | null>(null);
  const dataPrevRef = useRef<HTMLCanvasElement | null>(null);

  const { imageSource, cols, leds, gain } = visual;

  // 元画像プレビュー
  useEffect(() => {
    let cancelled = false;
    loadSourceImage(imageSource)
      .then((img) => {
        const cv = origPrevRef.current;
        if (cancelled || !cv) return;
        const [w, h] = sourceSize(img);
        if (!w || !h) return;
        const scale = Math.min(1, 320 / w, 110 / h);
        cv.width = Math.max(1, Math.round(w * scale));
        cv.height = Math.max(1, Math.round(h * scale));
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageSource]);

  // ポイに書き込まれるデータのプレビュー（ゲイン適用後）
  useEffect(() => {
    let cancelled = false;
    loadSourceImage(imageSource)
      .then((img) => {
        const cv = dataPrevRef.current;
        if (cancelled || !cv) return;
        const strip = buildStripImageData(img, cols, leds, gain);
        cv.width = cols;
        cv.height = leds;
        cv.getContext("2d")!.putImageData(strip, 0, 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imageSource, cols, leds, gain]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="画像">
        <label className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center">
          <span className="shrink-0 sm:w-36">サンプル画像</span>
          <select
            className="min-w-0 flex-1 rounded border px-2 py-1"
            value={visual.imageSource.kind === "sample" ? visual.imageSource.id : ""}
            onChange={(e) =>
              setVisual({
                ...visual,
                imageSource: { kind: "sample", id: e.target.value as SampleImageId },
              })
            }
          >
            {visual.imageSource.kind === "upload" && (
              <option value="" disabled>
                （アップロード画像）
              </option>
            )}
            {(Object.keys(SAMPLE_IMAGE_LABELS) as SampleImageId[]).map((id) => (
              <option key={id} value={id}>
                {SAMPLE_IMAGE_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center">
          <span className="shrink-0 sm:w-36">画像アップロード</span>
          <input
            type="file"
            accept="image/*"
            className="min-w-0 flex-1 text-xs file:mr-2 file:rounded file:border file:bg-transparent file:px-3 file:py-1 file:text-neutral-100 hover:file:cursor-pointer"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-[11px] opacity-60">
          キャンバスへのドラッグ＆ドロップ / Ctrl+V 貼り付けにも対応しています。
        </p>

        <Toggle
          label="上下反転"
          value={visual.flip}
          onChange={(v) => setVisual({ ...visual, flip: v })}
        />
        <p className="text-[11px] opacity-60">OFF: 画像の上端がポイ先端側になります。</p>

        <div className="flex flex-col gap-1">
          <span className="text-sm opacity-80">元画像プレビュー</span>
          <canvas ref={origPrevRef} className="max-w-full rounded border bg-black" />
        </div>
      </Section>

      <Section title="LED 設定">
        <Num
          label="LED数（1本あたり）"
          value={visual.leds}
          min={8}
          max={144}
          step={8}
          onChange={(v) => setVisual({ ...visual, leds: Math.round(v / 8) * 8 })}
        />
        <label className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center">
          <span className="shrink-0 sm:w-36">角度分解能（列数）</span>
          <select
            className="min-w-0 flex-1 rounded border px-2 py-1"
            value={visual.cols}
            onChange={(e) =>
              setVisual({ ...visual, cols: Number(e.target.value) as 128 | 256 | 512 })
            }
          >
            <option value={128}>128 列 / 周</option>
            <option value={256}>256 列 / 周</option>
            <option value={512}>512 列 / 周</option>
          </select>
        </label>
        <Num
          label="内側オフセット"
          value={Math.round(visual.innerFrac * 100)}
          min={0}
          max={50}
          step={1}
          suffix="%"
          onChange={(v) => setVisual({ ...visual, innerFrac: v / 100 })}
        />
        <Num
          label="LED輝度"
          value={visual.gain}
          min={0.3}
          max={2}
          step={0.05}
          onChange={(v) => setVisual({ ...visual, gain: v })}
        />
        <Num
          label="1周あたりの繰り返し"
          value={visual.repeats}
          min={1}
          max={4}
          step={1}
          onChange={(v) => setVisual({ ...visual, repeats: Math.round(v) })}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm opacity-80">ポイに書き込まれるデータ（横=角度 / 縦=LED）</span>
          <canvas
            ref={dataPrevRef}
            className="w-full rounded border bg-black [image-rendering:pixelated]"
          />
        </div>
      </Section>

      <Section title="表示">
        <Toggle
          label="長時間露光"
          value={visual.exposure}
          onChange={(v) => setVisual({ ...visual, exposure: v })}
        />
        <p className="text-[11px] opacity-60">
          パターン1周期分を一括描画して完成形を確認できます（アニメーション停止）。ビジュアルポイが選択されている場合のみ有効です。
        </p>
        <p className="text-[11px] opacity-60">
          左右のポイ種別は Left / Right タブの「ポイ種別」で切り替えてください。
        </p>
      </Section>
    </div>
  );
};
