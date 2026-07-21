import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h2 className="font-display text-2xl md:text-3xl leading-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  empty = "Aucune donnée — module en cours de câblage.",
}: {
  columns: string[];
  rows: (string | number | ReactNode)[][];
  empty?: string;
}) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr className="text-left text-[11px] uppercase tracking-wider">
              {columns.map((c) => (
                <th key={c} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "secondary" | "gold";
}) {
  const toneMap = {
    primary: "border-l-primary",
    secondary: "border-l-secondary",
    gold: "border-l-gold",
  };
  return (
    <div className={`card-elevated p-4 border-l-4 ${toneMap[tone]}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1 leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
