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
import { ConvertQuoteToEventError, convertQuoteToEvent } from '@/hooks/useSales';

describe('convertQuoteToEvent', () => {
  it('sends the same idempotency_key on repeated calls and returns the same event_id', async () => {
    const eventId = 'event-123';
    const quoteId = 'quote-123';
    const eventData = { event_name: 'Awards Night', event_date: '2026-04-30' };
    const idempotencyKey = `quote-convert-${quoteId}`;
    const rpc = vi.mocked(supabase.rpc);

    rpc.mockResolvedValue({
      data: { success: true, event_id: eventId },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

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

  it('throws a structured conversion error when the RPC returns success=false for an idempotency_key', async () => {
    const quoteId = 'quote-456';
    const eventData = { event_name: 'Launch Event', event_date: '2026-05-01' };
    const idempotencyKey = `quote-convert-${quoteId}`;
    const rpc = vi.mocked(supabase.rpc);

    rpc.mockResolvedValueOnce({
      data: {
        success: false,
        step: 'create_event',
        error: 'Event date is required',
        sqlstate: '23502',
      },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    await expect(convertQuoteToEvent({ quoteId, eventData, idempotencyKey })).rejects.toMatchObject({
      name: 'ConvertQuoteToEventError',
      message: 'Event date is required',
      step: 'create_event',
      sqlstate: '23502',
    });
    await expect(convertQuoteToEvent({ quoteId, eventData, idempotencyKey })).rejects.toBeInstanceOf(ConvertQuoteToEventError);
    expect(rpc).toHaveBeenCalledWith('convert_quote_to_event', {
      p_input: { quote_id: quoteId, event_data: eventData, idempotency_key: idempotencyKey },
    });
  });

  it('throws the RPC error when convert_quote_to_event fails for an idempotency_key', async () => {
    const quoteId = 'quote-789';
    const eventData = { event_name: 'Conference', event_date: '2026-06-15' };
    const idempotencyKey = `quote-convert-${quoteId}`;
    const rpcError = { message: 'permission denied for function convert_quote_to_event', code: '42501' };
    const rpc = vi.mocked(supabase.rpc);

    rpc.mockResolvedValueOnce({
      data: null,
      error: rpcError,
      count: null,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(convertQuoteToEvent({ quoteId, eventData, idempotencyKey })).rejects.toBe(rpcError);
    expect(rpc).toHaveBeenCalledWith('convert_quote_to_event', {
      p_input: { quote_id: quoteId, event_data: eventData, idempotency_key: idempotencyKey },
    });
  });
});