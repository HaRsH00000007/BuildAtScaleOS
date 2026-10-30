/** Build `path?query` from current params plus overrides; `undefined` removes a key. */
export function withParams(path: string, current: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...current, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v != null && v !== "") qs.set(k, v);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(searchParams: SearchParams): Promise<Record<string, string | undefined>> {
  const raw = await searchParams;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
