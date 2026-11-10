import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, forwardRef } from "react";

/* ── Table Root ── */
const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className = "", ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={`w-full text-sm ${className}`} {...props} />
    </div>
  )
);
Table.displayName = "Table";

/* ── Table Head ── */
const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <thead ref={ref} className={`border-b border-ql-border ${className}`} {...props} />
  )
);
TableHeader.displayName = "TableHeader";

/* ── Table Body ── */
const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = "", ...props }, ref) => (
    <tbody ref={ref} className={`divide-y divide-ql-border/50 ${className}`} {...props} />
  )
);
TableBody.displayName = "TableBody";

/* ── Table Row ── */
const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = "", ...props }, ref) => (
    <tr
      ref={ref}
      className={`transition-colors duration-100 hover:bg-ql-bg/60 ${className}`}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

/* ── Table Head Cell ── */
const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className = "", ...props }, ref) => (
    <th
      ref={ref}
      className={`px-4 py-3 text-left text-xs font-medium text-ql-muted uppercase tracking-wider ${className}`}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

/* ── Table Data Cell ── */
const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className = "", ...props }, ref) => (
    <td ref={ref} className={`px-4 py-3 text-ql-text ${className}`} {...props} />
  )
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };

