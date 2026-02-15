export const PageHeader = ({
  title,
  subtitle,
  action,
  testIdPrefix = "page",
}) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
          data-testid={`${testIdPrefix}-eyebrow`}
        >
          {subtitle}
        </p>
        <h1
          className="text-3xl font-bold tracking-tight text-foreground"
          data-testid={`${testIdPrefix}-title`}
        >
          {title}
        </h1>
      </div>
      <div
        className="relative z-20 flex flex-wrap items-center gap-3"
        data-testid={`${testIdPrefix}-actions`}
      >
        {action}
      </div>
    </div>
  );
};
