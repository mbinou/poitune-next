import { useEffect, useRef, useState } from "react";
import { buildColumnData, ColumnData, loadSourceImage, VisualPoiParams } from "./visualPoi";

// 画像 → 列データの構築・キャッシュ。描画ループは毎フレーム ref を読むだけ。
// innerFrac / repeats / exposure の変更では再構築しない。
export const useColumnData = (visual: VisualPoiParams) => {
  const columnDataRef = useRef<ColumnData | null>(null);
  const [columnVersion, setColumnVersion] = useState(0);

  const { imageSource, cols, leds, gain, flip } = visual;

  useEffect(() => {
    let cancelled = false;
    loadSourceImage(imageSource)
      .then((img) => {
        if (cancelled) return;
        columnDataRef.current = buildColumnData(img, { cols, leds, gain, flip });
        setColumnVersion((v) => v + 1);
      })
      .catch(() => {
        // ロード失敗時は直前のデータを維持
      });
    return () => {
      cancelled = true;
    };
  }, [imageSource, cols, leds, gain, flip]);

  return { columnDataRef, columnVersion };
};
