import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { useUploadComplianceDocument } from './useCompliance';

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: mocks.from, storage: { from: () => ({ upload: mocks.upload }) } } }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: { id: 'admin-user' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('certificate upload ownership', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ['selected team member', 'team-member', 'team-member'],
    ['own documents', undefined, 'admin-user'],
  ])('stores uploads under the %s', async (_, target, expected) => {
    const lookup = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    const insert = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'document' }, error: null }) };
    mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(insert);
    mocks.upload.mockResolvedValue({ error: null });
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useUploadComplianceDocument(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ file: new File(['certificate'], 'certificate.pdf', { type: 'application/pdf' }), documentTypeId: 'insurance', userId: target });
    });
    expect(mocks.upload.mock.calls[0][0]).toMatch(new RegExp(`^${expected}/`));
    expect(lookup.eq).toHaveBeenCalledWith('user_id', expected);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: expected, document_type_id: 'insurance', status: 'pending_review' }));
    unmount();
    client.clear();
  });
});