export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
};

export const Num = ({ label, value, onChange, step = 1, min, max, suffix }: Props) => (
  <label className={"flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center"}>
    <span className="shrink-0 sm:w-36">{label}</span>
    <span className="flex w-full min-w-0 items-center gap-2">
      <input
        type="number"
        className="min-w-0 flex-1 rounded border px-2 py-1 text-right"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) =>
          onChange(clamp(parseFloat(e.target.value || "0"), min ?? -Infinity, max ?? Infinity))
        }
      />
      {suffix ? <span className="shrink-0 opacity-70">{suffix}</span> : null}
    </span>
  </label>
);
