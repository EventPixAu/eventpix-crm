import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase';
import { convertQuoteToEvent } from '@/hooks/useSales';

describe('convertQuoteToEvent', () => {
  it('sends the same idempotency_key on repeated calls and returns the same event_id', async () => {
    const eventId = 'event-123';
    const quoteId = 'quote-123';
    const eventData = { event_name: 'Awards Night', event_date: '2026-04-30' };
    const idempotencyKey = `quote-convert-${quoteId}`;
    const rpc = vi.mocked(supabase.rpc);

    rpc.mockResolvedValue({ data: { success: true, event_id: eventId }, error: null });

    const firstResult = await convertQuoteToEvent({ quoteId, eventData, idempotencyKey });
    const retryResult = await convertQuoteToEvent({ quoteId, eventData, idempotencyKey });

    expect(firstResult.event_id).toBe(eventId);
    expect(retryResult.event_id).toBe(eventId);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, 'convert_quote_to_event', {
      p_input: { quote_id: quoteId, event_data: eventData, idempotency_key: idempotencyKey },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'convert_quote_to_event', {
      p_input: { quote_id: quoteId, event_data: eventData, idempotency_key: idempotencyKey },
    });
  });
});