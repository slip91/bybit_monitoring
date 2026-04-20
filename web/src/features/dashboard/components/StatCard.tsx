import type { ReactNode } from "react";
import { cn, ui } from "../../../lib/ui";

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
  if (tone === "cool") return "border-[rgba(84,208,200,0.18)] shadow-[inset_0_0_0_1px_rgba(84,208,200,0.16)]";
  if (tone === "warm") return "border-[rgba(255,159,104,0.18)] shadow-[inset_0_0_0_1px_rgba(255,159,104,0.16)]";
  return "border-[var(--color-border)]";
}
