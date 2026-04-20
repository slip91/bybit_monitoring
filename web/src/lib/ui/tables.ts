import { cn } from "./cn";

export const tables = {
  tableWrap() {
    return "overflow-x-auto rounded-[22px] border border-[var(--color-border-subtle)]";
  },
  dataTable() {
    return "min-w-full border-separate border-spacing-0 text-sm text-[var(--color-text-primary)]";
  },
  tableHeadRow() {
    return "text-left text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]";
  },
  tableHeadCell() {
    return "border-b border-[var(--color-border-subtle)] px-3 py-3";
  },
  tableBodyRow(options?: { excluded?: boolean }) {
    return cn("align-top", options?.excluded && "bg-[var(--color-error-surface)] text-[var(--color-text-muted)]");
  },
  tableCell() {
    return "border-b border-[var(--color-border-faint)] px-3 py-4";
  },
  actionStack() {
    return "grid gap-3";
  },
  actionRow() {
    return "flex flex-wrap gap-2";
  },
};
