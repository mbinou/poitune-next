import { newStepId, SequenceStep } from "../util/sequence";
import { Num } from "./Num";
import { Section } from "./Section";
import { Toggle } from "./Toggle";

type Props = {
  steps: SequenceStep[];
  setSteps: (s: SequenceStep[]) => void;
  loop: boolean;
  setLoop: (b: boolean) => void;
  playing: boolean;
  currentStep: number; // -1 = 停止中
  builtInNames: string[]; // "ex:..." キー（displayName ソート済み）
  userNames: string[]; // ソート済み
  displayName: (n: string) => string;
  onPlay: () => void;
  onStop: () => void;
};

export const SequencePanel = ({
  steps,
  setSteps,
  loop,
  setLoop,
  playing,
  currentStep,
  builtInNames,
  userNames,
  displayName,
  onPlay,
  onStop,
}: Props) => {
  const updateStep = (i: number, patch: Partial<SequenceStep>) =>
    setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  const addStep = () =>
    setSteps([
      ...steps,
      {
        id: newStepId(),
        presetName: builtInNames[0] ?? userNames[0] ?? "",
        holdSec: 4,
        transitionSec: 2,
      },
    ]);

  const knownName = (n: string) => builtInNames.includes(n) || userNames.includes(n);

  return (
    <Section title="シーケンス">
      {/* トランスポート */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={[
            "rounded-full border px-4 py-2 text-sm whitespace-nowrap",
            "hover:cursor-pointer focus:ring-2 focus:ring-white/40 focus:outline-none",
            "disabled:opacity-40",
            playing ? "bg-white text-black" : "bg-transparent",
          ].join(" ")}
          disabled={steps.length === 0 && !playing}
          onClick={playing ? onStop : onPlay}
        >
          {playing ? "停止" : "再生"}
        </button>
        <div className="max-w-60">
          <Toggle label="ループ" value={loop} onChange={setLoop} />
        </div>
      </div>

      {steps.length === 0 && (
        <p className="text-sm opacity-60">
          ステップがありません。「ステップを追加」でプリセットを並べてください。
        </p>
      )}

      {/* ステップ一覧 */}
      {steps.map((step, i) => {
        const missing = !knownName(step.presetName);
        return (
          <div
            key={step.id}
            className={[
              "flex flex-col gap-2 rounded-xl border p-3",
              i === currentStep ? "bg-white/10 ring-2 ring-white" : "border-white/15",
              missing ? "text-red-400" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm opacity-70">{i + 1}.</span>
              <select
                className="min-w-0 flex-1 rounded border bg-neutral-950 px-2 py-1 text-sm"
                value={step.presetName}
                onChange={(e) => updateStep(i, { presetName: e.target.value })}
              >
                {missing && (
                  <option value={step.presetName}>
                    {displayName(step.presetName)}（削除済み）
                  </option>
                )}
                <optgroup label="サンプル">
                  {builtInNames.map((n) => (
                    <option key={n} value={n}>
                      {displayName(n)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="マイプリセット">
                  {userNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="flex shrink-0 gap-1">
                <button
                  className="rounded border px-2 py-1 text-xs hover:cursor-pointer disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => moveStep(i, -1)}
                  aria-label="上へ移動"
                >
                  ↑
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs hover:cursor-pointer disabled:opacity-30"
                  disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                  aria-label="下へ移動"
                >
                  ↓
                </button>
                <button
                  className="rounded border px-2 py-1 text-xs hover:cursor-pointer"
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                >
                  削除
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Num
                label="表示 (秒)"
                value={step.holdSec}
                min={0}
                max={3600}
                step={0.5}
                onChange={(v) => updateStep(i, { holdSec: v })}
              />
              <div className="flex flex-col gap-1">
                <Num
                  label="遷移 (秒)"
                  value={step.transitionSec}
                  min={0}
                  max={3600}
                  step={0.5}
                  onChange={(v) => updateStep(i, { transitionSec: v })}
                />
                {i === steps.length - 1 && !loop && (
                  <span className="text-[11px] opacity-60">（ループ時のみ使用）</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <button
        className="rounded-xl border px-3 py-2 text-sm hover:cursor-pointer disabled:opacity-40"
        disabled={builtInNames.length === 0 && userNames.length === 0}
        onClick={addStep}
      >
        ステップを追加
      </button>

      <div className="flex flex-col gap-1 text-[11px] opacity-60">
        <p>
          ビジュアルポイの画像・LED 設定はシーケンスでは切り替わらず、「Visual
          Poi」タブの全体設定がそのまま使われます。
        </p>
        <p>
          再生中は各タブでの変更は表示に反映されず、停止時にシーケンスのプリセットで上書きされます。
        </p>
        <p>再生中のステップ編集は次回の再生から反映されます。</p>
      </div>
    </Section>
  );
};
