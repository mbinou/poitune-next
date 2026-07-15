import { clamp } from "../components/Num";

export type SampleImageId = "text" | "rainbow" | "diamond" | "smile";

export type VisualImageSource =
  | { kind: "sample"; id: SampleImageId }
  | { kind: "upload"; dataUrl: string };

export type VisualPoiParams = {
  leds: number; // 1本あたりのLED数
  cols: 128 | 256 | 512; // 角度分解能（列数/周）
  innerFrac: number; // 0..0.5 手元〜LED先頭の割合
  gain: number; // LED輝度
  repeats: number; // 1周あたりの画像繰り返し回数
  flip: boolean; // false = 画像の上端がポイ先端側
  exposure: boolean; // 長時間露光モード
  imageSource: VisualImageSource;
};

export const defaultVisualPoi: VisualPoiParams = {
  leds: 64,
  cols: 256,
  innerFrac: 0.15,
  gain: 1,
  repeats: 1,
  flip: false,
  exposure: false,
  imageSource: { kind: "sample", id: "text" },
};

export type ColumnData = {
  // 列優先・ゲイン/flip 適用済み: ((col * leds + i) * 4)、i=0 が手元側 LED
  data: Uint8ClampedArray;
  cols: number;
  leds: number;
};

export const SAMPLE_IMAGE_LABELS: Record<SampleImageId, string> = {
  text: "テキスト",
  rainbow: "レインボー",
  diamond: "ダイヤ",
  smile: "スマイル",
};

export const mod1 = (x: number) => x - Math.floor(x);

export const columnIndex = (anglePoi: number, cols: number, repeats: number) =>
  Math.min(cols - 1, Math.floor(mod1((anglePoi / (Math.PI * 2)) * repeats) * cols));

// ===== サンプル画像（client-only: effect / ハンドラからのみ呼ぶこと） =====
export const buildSampleImage = (id: SampleImageId): HTMLCanvasElement => {
  const w = 640;
  const h = 160;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, w, h);

  if (id === "text") {
    const g = x.createLinearGradient(0, 0, w, 0);
    const stops = ["#ff5cc8", "#ffd24c", "#4de3ff", "#7dff8a", "#ff5cc8"];
    stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
    x.fillStyle = g;
    x.font = "700 92px 'Avenir Next Condensed','Arial Narrow',sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("VISUAL POI ★", w / 2, h / 2 + 4);
  } else if (id === "rainbow") {
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      x.fillStyle = `hsl(${(i / bands) * 330},95%,58%)`;
      x.fillRect(0, (i * h) / bands + 2, w, h / bands - 6);
    }
  } else if (id === "diamond") {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5) * w) / n;
      x.fillStyle = `hsl(${(i / n) * 360},95%,60%)`;
      x.beginPath();
      x.moveTo(cx, 12);
      x.lineTo(cx + (w / n) * 0.42, h / 2);
      x.lineTo(cx, h - 12);
      x.lineTo(cx - (w / n) * 0.42, h / 2);
      x.closePath();
      x.fill();
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const cx = ((i + 0.5) * w) / 4;
      const cy = h / 2;
      x.fillStyle = "#ffd24c";
      x.beginPath();
      x.arc(cx, cy, 62, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#1c1400";
      x.beginPath();
      x.arc(cx - 22, cy - 16, 9, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.arc(cx + 22, cy - 16, 9, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#1c1400";
      x.lineWidth = 8;
      x.lineCap = "round";
      x.beginPath();
      x.arc(cx, cy + 8, 32, 0.25 * Math.PI, 0.75 * Math.PI);
      x.stroke();
    }
  }
  return c;
};

export const loadSourceImage = (src: VisualImageSource): Promise<CanvasImageSource> => {
  if (src.kind === "sample") return Promise.resolve(buildSampleImage(src.id));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src.dataUrl;
  });
};

export const sourceSize = (img: CanvasImageSource): [number, number] => {
  if (img instanceof HTMLImageElement) return [img.naturalWidth, img.naturalHeight];
  if (img instanceof HTMLCanvasElement) return [img.width, img.height];
  return [0, 0];
};

// ===== 画像 → ポイ書き込みデータ =====
export const buildStripImageData = (
  img: CanvasImageSource,
  cols: number,
  leds: number,
  gain: number,
): ImageData => {
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = leds;
  const oc = off.getContext("2d")!;
  oc.imageSmoothingEnabled = true;
  oc.imageSmoothingQuality = "high";
  oc.fillStyle = "#000";
  oc.fillRect(0, 0, cols, leds);
  oc.drawImage(img, 0, 0, cols, leds);
  const strip = oc.getImageData(0, 0, cols, leds);
  const d = strip.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * gain;
    d[i + 1] = d[i + 1] * gain;
    d[i + 2] = d[i + 2] * gain;
    d[i + 3] = 255;
  }
  return strip;
};

export const packColumns = (strip: ImageData, flip: boolean): ColumnData => {
  const cols = strip.width;
  const leds = strip.height;
  const src = strip.data;
  const data = new Uint8ClampedArray(src.length);
  for (let c = 0; c < cols; c++) {
    for (let i = 0; i < leds; i++) {
      // i=0 は手元側。デフォルト（flip=false）は画像の上端＝先端側
      const row = flip ? i : leds - 1 - i;
      const from = (row * cols + c) * 4;
      const to = (c * leds + i) * 4;
      data[to] = src[from];
      data[to + 1] = src[from + 1];
      data[to + 2] = src[from + 2];
      data[to + 3] = 255;
    }
  }
  return { data, cols, leds };
};

export const buildColumnData = (
  img: CanvasImageSource,
  p: Pick<VisualPoiParams, "cols" | "leds" | "gain" | "flip">,
): ColumnData => packColumns(buildStripImageData(img, p.cols, p.leds, p.gain), p.flip);

// ===== アップロード画像 → dataURL（幅1024pxに制限） =====
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 1024;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      // POV 画像は黒背景前提なので JPEG 圧縮で十分（localStorage 節約）
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });

// ===== 露光モード: パターン1周期（angleHand / anglePoi が同時に元へ戻る仮想時間） =====
export const patternPeriod = (omegaHand: number, omegaPoi: number): number => {
  const EPS = 1e-9;
  const TWO_PI = Math.PI * 2;
  if (Math.abs(omegaHand) < EPS && Math.abs(omegaPoi) < EPS) return 0;
  if (Math.abs(omegaHand) < EPS) return TWO_PI / Math.abs(omegaPoi);
  const ratio = omegaPoi / omegaHand;
  for (let m = 1; m <= 32; m++) {
    const r = ratio * m;
    if (Math.abs(r - Math.round(r)) < 1e-4 * Math.max(1, Math.abs(r))) {
      return (m * TWO_PI) / Math.abs(omegaHand);
    }
  }
  return (32 * TWO_PI) / Math.abs(omegaHand);
};

// ===== 共有 / 復元 =====
export const sanitizeVisualForShare = (v: VisualPoiParams): VisualPoiParams =>
  v.imageSource.kind === "upload" ? { ...v, imageSource: { kind: "sample", id: "text" } } : v;

const isSampleId = (x: unknown): x is SampleImageId =>
  x === "text" || x === "rainbow" || x === "diamond" || x === "smile";

const mergeImageSource = (x: unknown): VisualImageSource => {
  if (x && typeof x === "object") {
    const s = x as { kind?: unknown; id?: unknown; dataUrl?: unknown };
    if (s.kind === "sample" && isSampleId(s.id)) return { kind: "sample", id: s.id };
    if (s.kind === "upload" && typeof s.dataUrl === "string" && s.dataUrl.startsWith("data:image/"))
      return { kind: "upload", dataUrl: s.dataUrl };
  }
  return defaultVisualPoi.imageSource;
};

export const mergeVisual = (partial: unknown): VisualPoiParams => {
  const p = (partial && typeof partial === "object" ? partial : {}) as Partial<VisualPoiParams>;
  const cols = p.cols === 128 || p.cols === 256 || p.cols === 512 ? p.cols : defaultVisualPoi.cols;
  return {
    leds: clamp(Math.round(Number(p.leds) || defaultVisualPoi.leds), 1, 144),
    cols,
    innerFrac: clamp(Number(p.innerFrac ?? defaultVisualPoi.innerFrac) || 0, 0, 0.5),
    gain: clamp(Number(p.gain) || defaultVisualPoi.gain, 0.3, 2),
    repeats: clamp(Math.round(Number(p.repeats) || defaultVisualPoi.repeats), 1, 4),
    flip: Boolean(p.flip),
    exposure: Boolean(p.exposure),
    imageSource: mergeImageSource(p.imageSource),
  };
};
