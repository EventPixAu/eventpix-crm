import { describe, it, expect } from 'vitest';
import { phoneKitDetails, requiresPhoneKit, PHONE_KIT_MARKER, phoneUploadAllocation } from './phoneUploadKit';

describe('phone upload kit', () => {
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