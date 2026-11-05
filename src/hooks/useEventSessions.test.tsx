import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useCreateEventSession, useUpdateEventSession } from './useEventSessions';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: mocks }));

describe('live offsite session timing', () => {
  it('creates a live offsite session with independent photographer-style call and coverage times', async () => {
    const session = { event_id: 'event', session_date: '2026-11-05', session_type: 'live_offsite', arrival_time: '18:00', start_time: '18:30', end_time: '21:30' };
    const query = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'session', ...session }, error: null }) };
    mocks.from.mockReturnValue(query);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useCreateEventSession(), { wrapper });
    await act(async () => { await result.current.mutateAsync(session); });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ session_type: 'live_offsite', arrival_time: '18:00', start_time: '18:30', end_time: '21:30' }));
    unmount();
    client.clear();
  });

  it('keeps live offsite timing when an existing session is edited', async () => {
    const updates = { session_type: 'live_offsite', arrival_time: '09:00', start_time: '09:30', end_time: '12:30' };
    const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'session', event_id: 'event', ...updates }, error: null }) };
    mocks.from.mockReturnValue(query);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useUpdateEventSession(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: 'session', ...updates }); });
    expect(query.update).toHaveBeenCalledWith(updates);
    expect(query.eq).toHaveBeenCalledWith('id', 'session');
    unmount();
    client.clear();
  });
});