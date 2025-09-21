type Props = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

export const Toggle = ({ label, value, onChange }: Props) => (
  <label className={"flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center"}>
    <span className="shrink-0 sm:w-36">{label}</span>
    <button
      type="button"
      className={[
        "rounded border px-3 py-1 font-mono",
        "transition hover:cursor-pointer",
        value ? "bg-white text-black" : "bg-black text-white",
        "self-start sm:self-auto",
      ].join(" ")}
      onClick={() => onChange(!value)}
    >
      {value ? "ON" : "OFF"}
    </button>
  </label>
);
