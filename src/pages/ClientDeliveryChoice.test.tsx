import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientDeliveryChoice from './ClientDeliveryChoice';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const token = '11111111-1111-4111-8111-111111111111';
function openForm() {
  render(<MemoryRouter initialEntries={[`/delivery-choice/${token}`]}><Routes><Route path="/delivery-choice/:token" element={<ClientDeliveryChoice />} /></Routes></MemoryRouter>);
}

describe('client event confirmation', () => {
  beforeEach(() => rpc.mockReset());
  afterEach(cleanup);

  it('saves onsite contact and special instructions together with the delivery option', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'valid', event_name: 'Test event', choice: 'dropbox_only' } });
    rpc.mockResolvedValueOnce({ data: { status: 'confirmed' } });
    openForm();
    const name = await screen.findByLabelText('Contact name');
    expect(screen.getByRole('button', { name: 'Confirm event details' })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Test Contact' } });
    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '0400000000' } });
    fireEvent.change(screen.getByLabelText('Email (optional)'), { target: { value: 'contact@example.com' } });
    fireEvent.change(screen.getByLabelText('Special instructions (optional)'), { target: { value: 'Use the loading dock.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm event details' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('submit_booking_confirmation', {
      p_token: token, p_choice: 'dropbox_only', p_timing: '', p_social_media_access: false,
      p_branding_notes: '', p_onsite_contact_name: 'Test Contact', p_onsite_contact_phone: '0400000000',
      p_onsite_contact_email: 'contact@example.com', p_special_instructions: 'Use the loading dock.',
    }));
    await screen.findByRole('button', { name: 'Change my details' });
  });

  it('retains saved delivery choices while requesting missing onsite details on older responses', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'valid', event_name: 'Test event', choice: 'dropbox_only', confirmed_at: '2026-10-06T00:00:00Z' } });
    openForm();
    expect(await screen.findByLabelText('Contact name')).toHaveValue('');
    expect(screen.getByRole('radio', { name: /Dropbox only/ })).toHaveAttribute('data-state', 'checked');
  });

  it('restores confirmed onsite details and instructions when the client edits their response', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'valid', event_name: 'Test event', choice: 'dropbox_only', confirmed_at: '2026-10-06T00:00:00Z', onsite_contact_name: 'Test Contact', onsite_contact_phone: '0400000000', onsite_contact_email: 'contact@example.com', special_instructions: 'Use the loading dock.' } });
    openForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Change my details' }));
    expect(screen.getByLabelText('Contact name')).toHaveValue('Test Contact');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('0400000000');
    expect(screen.getByLabelText('Special instructions (optional)')).toHaveValue('Use the loading dock.');
  });
});