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
  <label className="flex items-center gap-2 text-sm">
    <span className="w-36 shrink-0">{label}</span>
    <input
      type="number"
      className="w-32 rounded border px-2 py-1"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) =>
        onChange(clamp(parseFloat(e.target.value || "0"), min ?? -Infinity, max ?? Infinity))
      }
    />
    {suffix ? <span className="opacity-70">{suffix}</span> : null}
  </label>
);
