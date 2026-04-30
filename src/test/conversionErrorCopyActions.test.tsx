import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastStore = vi.hoisted(() => {
  type ToastSnapshot = { title: React.ReactNode; options?: any } | null;
  let latest: ToastSnapshot = null;
  const listeners = new Set<() => void>();
  const publish = (title: React.ReactNode, options?: any) => {
    latest = { title, options };
    listeners.forEach((listener) => listener());
  };

  return {
    getLatest: () => latest,
    reset: () => {
      latest = null;
      listeners.clear();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn((title, options) => toastStore.publish(title, options)),
    info: vi.fn((title, options) => toastStore.publish(title, options)),
    success: vi.fn((title, options) => toastStore.publish(title, options)),
  },
}));

import { ConversionErrorCopyActions } from '@/pages/sales/QuoteDetail';

function MockToastOutlet() {
  const [toast, setToast] = useState(toastStore.getLatest());

  useEffect(() => toastStore.subscribe(() => setToast(toastStore.getLatest())), []);

  if (!toast) return null;

  return (
    <div role="alert">
      <div>{toast.title}</div>
      <div>{toast.options?.description}</div>
      <div>{toast.options?.action}</div>
      <div>{toast.options?.cancel}</div>
    </div>
  );
}

function renderCopyActions(copyToClipboard: (text: string) => Promise<void>) {
  render(
    <>
      <ConversionErrorCopyActions
        conversionError={{ step: 'create_event', message: 'Event date is required' }}
        copyToClipboard={copyToClipboard}
      />
      <MockToastOutlet />
    </>,
  );
}

describe('ConversionErrorCopyActions aria-live announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastStore.reset();
  });

  it('announces when the copy format toggles', async () => {
    renderCopyActions(vi.fn().mockRejectedValue(new Error('Clipboard unavailable')));

    fireEvent.click(screen.getByRole('button', { name: /copy error/i }));
    const formatToggle = await screen.findByRole('button', { name: /switch conversion error copy format/i });

    fireEvent.click(formatToggle);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copy format switched to prettified conversion error text.');
    });
  });

  it('announces when Preview completes', async () => {
    renderCopyActions(vi.fn().mockRejectedValue(new Error('Clipboard unavailable')));

    fireEvent.click(screen.getByRole('button', { name: /copy error/i }));
    const preview = await screen.findByRole('button', { name: /preview raw conversion error text before copying/i });

    fireEvent.click(preview);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Preview showing raw conversion error text.');
    });
  });

  it('announces when Retry completes successfully', async () => {
    const copyToClipboard = vi.fn().mockRejectedValueOnce(new Error('Clipboard unavailable')).mockResolvedValueOnce(undefined);
    renderCopyActions(copyToClipboard);

    fireEvent.click(screen.getByRole('button', { name: /copy error/i }));
    const retry = await screen.findByRole('button', { name: /retry copying raw conversion error text/i });

    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Retry completed. Conversion error text copied successfully.');
    });
  });

  it('announces the latest reason when Retry fails', async () => {
    const copyToClipboard = vi
      .fn()
      .mockRejectedValueOnce(new Error('Clipboard unavailable'))
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    renderCopyActions(copyToClipboard);

    fireEvent.click(screen.getByRole('button', { name: /copy error/i }));
    const retry = await screen.findByRole('button', { name: /retry copying raw conversion error text/i });

    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Retry failed. Clipboard permission was denied.');
    });
  });
});