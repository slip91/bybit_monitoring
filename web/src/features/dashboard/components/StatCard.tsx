import type { ReactNode } from "react";
import { cn, ui } from "@lib/ui";

type StatCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "warm" | "cool";
  footnote?: ReactNode;
  labelHint?: string;
  valueClassName?: string;
};

export function StatCard({ label, value, tone = "neutral", footnote, labelHint, valueClassName = "" }: StatCardProps) {
  return (
    <article className={cn(ui.panel(), "p-5", toneClassName(tone))}>
      <span className="inline-flex items-center gap-2">
        <span className={ui.subtitle()}>{label}</span>
        {labelHint ? (
          <span className={ui.infoIcon()} title={labelHint} aria-label={labelHint}>
            i
          </span>
        ) : null}
      </span>
      <strong className={cn("mt-3 block text-[1.9rem] leading-none tracking-[-0.03em]", valueClassName)}>
        {value}
      </strong>
      {footnote && <span className={cn("mt-3 grid gap-1 text-sm", ui.subtitle())}>{footnote}</span>}
    </article>
  );
}

function toneClassName(tone: StatCardProps["tone"]) {
  if (tone === "cool") return "border-[var(--color-brand-surface-md)] shadow-[inset_0_0_0_1px_var(--color-brand-inset)]";
  if (tone === "warm") return "border-[var(--color-warm-surface-md)] shadow-[inset_0_0_0_1px_var(--color-warm-inset)]";
  return "border-[var(--color-border)]";
}
