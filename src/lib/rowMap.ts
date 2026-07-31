// Helper de mapping partiel type applicatif -> colonnes SQL (snake_case).
export function toRow<T>(
  patch: Partial<T>,
  map: Partial<Record<keyof T, string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const col = map[k];
    if (col !== undefined) out[col] = patch[k];
  }
  return out;
}
