type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

export const Color = ({ label, value, onChange }: Props) => (
  <label className="flex items-center gap-2 text-sm">
    <span className="w-36 shrink-0">{label}</span>
    <input
      type="color"
      className="h-8 w-10 rounded border p-0 hover:cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <input
      type="text"
      className="w-28 rounded border px-2 py-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);
