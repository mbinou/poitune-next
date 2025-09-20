type Props = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

export const Toggle = ({ label, value, onChange }: Props) => (
  <label className="flex items-center gap-2 text-sm">
    <span className="w-36 shrink-0">{label}</span>
    <button
      className={"rounded border bg-black px-3 py-1 text-white hover:cursor-pointer"}
      onClick={() => onChange(!value)}
    >
      {value ? "ON" : "OFF"}
    </button>
  </label>
);
