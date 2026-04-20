export type MaybeClass = string | false | null | undefined;

export function cn(...parts: MaybeClass[]) {
  return parts.filter(Boolean).join(" ");
}
