import { describe, expect, it, vi } from 'vitest';
import { fetchScopedRows } from './scopedRows';

describe('scoped related-row reads', () => {
  it('does not fetch any unrelated records for an empty list', async () => {
    const fetch = vi.fn();
    expect(await fetchScopedRows([], fetch)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps all rows beyond the response limit and deduplicates requested IDs', async () => {
    const calls: unknown[] = [];
    const rows = await fetchScopedRows(['event-a', 'event-a'], async (ids, from, to) => {
      calls.push([ids, from, to]);
      return { data: from === 0 ? Array.from({ length: 1000 }, (_, id) => id) : [1000], error: null };
    });
    expect(rows).toHaveLength(1001);
    expect(rows[1000]).toBe(1000);
    expect(calls).toEqual([[['event-a'], 0, 999], [['event-a'], 1000, 1999]]);
  });
  it('bounds ID batches and propagates read failures', async () => {
    const fetch = vi.fn(async (ids: string[]) => ({ data: ids, error: null }));
    expect(await fetchScopedRows(Array.from({ length: 101 }, (_, i) => String(i)), fetch)).toHaveLength(101);
    expect(fetch.mock.calls.map(([ids]) => ids.length)).toEqual([100, 1]);
    await expect(fetchScopedRows(['a'], async () => ({data: null, error: new Error('denied')}))).rejects.toThrow('denied');
  });
});