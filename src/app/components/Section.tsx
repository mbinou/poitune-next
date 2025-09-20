type Props = {
  title: string;
  children: React.ReactNode;
};

export const Section = ({ title, children }: Props) => (
  <div className="rounded-2xl border p-4 shadow">
    <h3 className="mb-3 font-semibold">{title}</h3>
    <div className="flex flex-col gap-2">{children}</div>
  </div>
);
