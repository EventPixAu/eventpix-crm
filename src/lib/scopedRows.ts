/** Fetch related rows in bounded requests without silently truncating large groups. */
export async function fetchScopedRows<T>(
  ids: string[],
  fetchPage: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  const uniqueIds = [...new Set(ids)];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const batch = uniqueIds.slice(offset, offset + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await fetchPage(batch, from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}