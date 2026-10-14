type SectionProps = {
  id: string;
  label: string;
};

export function Section({ id, label }: SectionProps) {
  return (
    <section
      id={id}
      aria-label={label}
      className="min-h-screen scroll-mt-16"
    />
  );
}
