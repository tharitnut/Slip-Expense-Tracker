import { type ReactNode } from "react";

interface EmptyLedgerStateProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

/**
 * Shared dashed-border empty state card used across ledger views.
 */
export function EmptyLedgerState({
  eyebrow,
  title,
  description,
  action,
}: EmptyLedgerStateProps) {
  return (
    <div className="receipt-border rounded-2xl bg-ql-surface/60 px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-mono text-ql-muted">
          {eyebrow}
        </p>
        <h3 className="text-base font-serif font-semibold text-ql-text">
          {title}
        </h3>
        <p className="text-xs text-ql-muted">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
