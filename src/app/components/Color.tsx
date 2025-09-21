type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

export const Color = ({ label, value, onChange }: Props) => (
  <label className={"flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center"}>
    <span className="shrink-0 sm:w-36">{label}</span>
    <span className="flex w-full min-w-0 items-center gap-2">
      <input
        type="color"
        className="h-8 w-10 rounded border p-0 hover:cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color picker`}
      />
      <input
        type="text"
        inputMode="text"
        className="min-w-0 flex-1 rounded border px-2 py-1 font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        aria-label={`${label} hex code`}
      />
    </span>
  </label>
);
