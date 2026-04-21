import { cn } from "./cn";

export const recipes = {
  panel(options?: { tone?: "default" | "hero"; interactive?: boolean }) {
    const tone = options?.tone ?? "default";
    return cn(
      "text-[var(--color-text-primary)] shadow-[0_24px_70px_var(--color-shadow-deep)]",
      tone === "hero"
        ? "rounded-[32px] border border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-bg-panel),var(--color-bg-deep))] backdrop-blur-[16px]"
        : "rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-[14px]",
      options?.interactive &&
        "transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand-border)] hover:bg-[var(--color-surface-hover)]"
    );
  },
  heading(options?: { size?: "section" | "hero" }) {
    const size = options?.size ?? "section";
    return cn(
      "font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,serif] tracking-[-0.03em]",
      size === "hero" ? "text-[clamp(1.7rem,2.6vw,2.8rem)] leading-tight" : "text-3xl leading-none"
    );
  },
  eyebrow() {
    return "mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-brand)]";
  },
  subtitle() {
    return "text-sm text-[var(--color-text-muted)]";
  },
  card(options?: { subtle?: boolean }) {
    return cn(
      options?.subtle
        ? "rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
        : recipes.panel(),
      "p-5"
    );
  },
  emptyState() {
    return "rounded-[22px] border border-dashed border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-text-muted)]";
  },
  note(options?: { tone?: "default" | "success" | "error" | "warning" }) {
    const tone = options?.tone ?? "default";
    return cn(
      "rounded-[18px] px-4 py-3 text-sm leading-6",
      tone === "default" && "border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]",
      tone === "success" && "border border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]",
      tone === "error" && "border border-[var(--color-error-border)] bg-[var(--color-error-surface)] text-[var(--color-error-text)]",
      tone === "warning" && "border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
    );
  },
  pill(options?: { tone?: "default" | "brand" | "success" | "running" | "stale" | "error" }) {
    const tone = options?.tone ?? "default";
    return cn(
      "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]",
      tone === "brand"   && "border-[var(--color-brand-border)] bg-[var(--color-brand-surface)] text-[var(--color-brand-text)]",
      tone === "success" && "border-[var(--color-green-glow-xl)] bg-[var(--color-green-glow)] text-[#d9f99d]",
      tone === "running" && "border-[var(--color-running-border)] bg-[var(--color-running-surface)] text-[var(--color-running-text)]",
      tone === "stale"   && "border-[var(--color-stale-border)] bg-[var(--color-stale-surface)] text-[var(--color-stale-text)]",
      tone === "error"   && "border-[var(--color-error-border)] bg-[var(--color-error-surface)] text-[var(--color-error-text)]",
      tone === "default" && "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
    );
  },
  formControl() {
    return "h-11 w-full rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3 leading-6 text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-brand-border-focus)] focus:bg-[var(--color-overlay-soft)]";
  },
  checkbox() {
    return "flex items-center gap-3 text-sm text-[var(--color-text-primary)]";
  },
  field() {
    return "grid gap-2";
  },
  button(options?: { tone?: "primary" | "ghost" }) {
    const tone = options?.tone ?? "primary";
    return cn(
      "rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
      tone === "primary" &&
        "border border-[var(--color-brand-border)] bg-[var(--color-brand-surface)] text-[var(--color-brand-text)] hover:border-[var(--color-brand-border-hover)] hover:bg-[var(--color-brand-glow-lg)]",
      tone === "ghost" &&
        "border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-blue-mid)] hover:bg-[var(--color-overlay-soft)]"
    );
  },
  leverageBadge() {
    return "inline-flex items-center rounded-full border border-[var(--color-blue-soft)] bg-[var(--color-overlay-soft)] px-2 py-0.5 text-[0.7rem] font-medium tracking-[0.08em] text-[var(--color-brand-text)]";
  },
  infoIcon() {
    return "inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-muted)]";
  },
};
