export const layout = {
  page() {
    return "grid gap-6";
  },
  statsGrid() {
    return "grid gap-4 md:grid-cols-2 xl:grid-cols-4";
  },
  settingsGrid() {
    return "grid gap-6 xl:grid-cols-2";
  },
  sectionHeader() {
    return "mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between";
  },
  sectionActions() {
    return "flex flex-wrap items-center gap-3";
  },
  sectionCount() {
    return "text-sm text-[var(--color-text-muted)]";
  },
  heroCopy() {
    return "mt-4 max-w-4xl text-[0.98rem] leading-7 text-[var(--color-text-muted)]";
  },
};
