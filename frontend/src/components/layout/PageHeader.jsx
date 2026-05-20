export const PageHeader = ({
  title,
  subtitle,
  action,
  testIdPrefix = "page",
}) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p
          className="truncate text-xs uppercase tracking-[0.2em] text-muted-foreground"
          data-testid={`${testIdPrefix}-eyebrow`}
        >
          {subtitle}
        </p>
        <h1
          className="break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          data-testid={`${testIdPrefix}-title`}
        >
          {title}
        </h1>
      </div>
      <div
        className="page-toolbar relative z-20"
        data-testid={`${testIdPrefix}-actions`}
      >
        {action}
      </div>
    </div>
  );
};
