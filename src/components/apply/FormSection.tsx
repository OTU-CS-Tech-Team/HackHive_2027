interface FormSectionProps {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ id, title, description, children }: FormSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-2xl border border-hive-line bg-white p-6 shadow-[0_1px_0_rgba(19,47,64,0.04)] sm:p-8"
    >
      <div className="mb-6">
        <h2 className="flex items-center gap-2.5 font-display text-base font-semibold text-hive-ink">
          <span
            aria-hidden="true"
            className="h-3 w-[11px] bg-hive-honey [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          />
          {title}
        </h2>
        {description && <p className="mt-1.5 text-[13px] leading-relaxed text-hive-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
