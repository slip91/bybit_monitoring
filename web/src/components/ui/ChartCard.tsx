import type { ReactNode } from "react";
import { cn, ui } from "../../lib/ui";

type ChartCardProps = {
  title: string;
  eyebrow?: string;
  aside?: string;
  children: ReactNode;
};

export function ChartCard({ title, eyebrow, aside, children }: ChartCardProps) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          {eyebrow && <p className={ui.eyebrow()}>{eyebrow}</p>}
          <h3 className={ui.heading()}>{title}</h3>
        </div>
        {aside && <span className={ui.sectionCount()}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}
