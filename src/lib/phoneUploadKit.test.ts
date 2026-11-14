import { describe, it, expect, vi } from 'vitest';
import { phoneKitDetails, requiresPhoneKit, PHONE_KIT_MARKER, phoneUploadAllocation, requestMissingPhoneKitDetails } from './phoneUploadKit';

describe('phone upload kit', () => {
  it('automatically requests missing details once for a selected phone kit', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const candidate = { userId: 'evie', assignmentId: 'assignment-1', phoneSelected: true };
    await requestMissingPhoneKitDetails([candidate, candidate], async () => ({}), send);
    expect(send).toHaveBeenCalledExactlyOnceWith('assignment-1');
  });
  it('does not request details already supplied or an unselected phone kit', async () => {
    const send = vi.fn();
    const read = vi.fn().mockResolvedValue({ phone: { model: 'iPhone 15', usb: 'USB-C', uploadCable: 'USB-C to USB-C cable' } });
    await requestMissingPhoneKitDetails([
      { userId: 'evie', assignmentId: 'assignment-1', phoneSelected: true },
      { userId: 'nat', assignmentId: 'assignment-2', phoneSelected: false },
    ], read, send);
    expect(read).toHaveBeenCalledExactlyOnceWith('evie');
    expect(send).not.toHaveBeenCalled();
  });
  it('reports a request failure without failing successful requests', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('Email unavailable')).mockResolvedValueOnce(undefined);
    const results = await requestMissingPhoneKitDetails([
      { userId: 'evie', assignmentId: 'assignment-1', phoneSelected: true },
      { userId: 'nat', assignmentId: 'assignment-2', phoneSelected: true },
    ], async () => ({}), send);
    expect(results.map(r => r.status)).toEqual(['rejected', 'fulfilled']);
  });
  it('allows allocating a phone kit before phone details have been supplied', () => {
    expect(phoneKitDetails({}).ready).toBe(false);
    expect(phoneUploadAllocation()).toMatchObject({ category: 'phone', items: [{ name: 'Phone upload kit' }] });
    expect(requiresPhoneKit('', [{ equipment_item: phoneUploadAllocation().items[0] }])).toBe(true);
  });
  it('requires the phone and a cable, not just the connection', () => {
    expect(phoneKitDetails({ phone: { model: 'iPhone 15', usb: 'USB-C' } }).missing).toEqual(['USB-C to USB-C cable or OTG converter']);
  });
  it.each(['USB-C to USB-C cable', 'OTG converter cable'])('accepts %s', uploadCable => {
    expect(phoneKitDetails({ phone: { model: 'Samsung S24', usb: 'USB-C', uploadCable } }).ready).toBe(true);
  });
  it('flags unavailable cables', () => {
    expect(phoneKitDetails({ phone: { model: 'iPhone', usb: 'Lightning', uploadCable: 'Not available' } }).ready).toBe(false);
  });
  it('detects explicit requirements and allocated phones, not returned kits', () => {
    expect(requiresPhoneKit(PHONE_KIT_MARKER)).toBe(true);
    expect(requiresPhoneKit('', [{ equipment_item: { category: 'phone' } }])).toBe(true);
    expect(requiresPhoneKit('', [{ status: 'returned', equipment_item: { category: 'phone' } }])).toBe(false);
    expect(requiresPhoneKit('Lighting kit')).toBe(false);
  });
});