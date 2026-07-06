export function EmptyState({
  icon = "🧊",
  title,
  description,
  action,
  className = "",
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700 ${className}`}
    >
      <div className="mb-2 text-3xl">{icon}</div>
      <p className="font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
