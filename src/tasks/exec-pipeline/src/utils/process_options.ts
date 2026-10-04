import * as tl from "azure-pipelines-task-lib";

/**
 * Accept "main" as well as "refs/heads/main" (or a tag ref) without
 * producing "refs/heads/refs/heads/main".
 */
export function normalizeBranch(branch: string): string {
  const value = branch.trim();
  return value.startsWith("refs/") ? value : `refs/heads/${value}`;
}

/**
 * Read an optional numeric input, falling back to the default when it is
 * empty, not a number or out of range.
 */
export function parseNumberInput(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    tl.warning(
      `Invalid value "${raw}" for ${name} (expected ${min}-${max}), using ${fallback}.`
    );
    return fallback;
  }
  return value;
}
