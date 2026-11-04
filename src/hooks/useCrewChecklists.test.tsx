import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useMyCrewChecklist } from './useCrewChecklists';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mocks }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'own-user' } }) }));

describe('personal checklist polling', () => {
  it('reads the own checklist without syncing or rewriting other users when unchanged', async () => {
    const checklist = {
      id: 'own-checklist', event_id: 'event', user_id: 'own-user', template_id: 'template',
      items: [{ id: 'item', checklist_id: 'own-checklist', item_text: 'Upload files', sort_order: 0, is_done: true, notes: 'Keep this', done_at: '2026-11-03T00:00:00Z' }],
      template: { id: 'template', items: [{ item_text: 'Upload files', sort_order: 0 }] },
    };
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: checklist, error: null }) };
    mocks.from.mockReturnValue(query);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useMyCrewChecklist('event'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await result.current.refetch();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls).toEqual([['crew_checklists'], ['crew_checklists']]);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'own-user');
    expect(result.current.data?.items[0]).toMatchObject({ is_done: true, notes: 'Keep this', done_at: '2026-11-03T00:00:00Z' });
    unmount();
    client.clear();
  });
});