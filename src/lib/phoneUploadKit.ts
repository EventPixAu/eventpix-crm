export const PHONE_KIT_MARKER = '[Phone upload kit required]';
export const PHONE_UPLOAD_CABLES = ['USB-C to USB-C cable', 'OTG converter cable', 'Not available'] as const;

export function phoneUploadAllocation() {
  // A stable name lets the existing allocator reuse the person's kit after profile updates.
  return { kitId: 'phone-upload', category: 'phone' as const, label: 'Phone Upload Kit', items: [{ id: 'phone-upload', brand: '', name: 'Phone upload kit' }] };
}

export function phoneKitDetails(equipment: unknown) {
  const phone = equipment && typeof equipment === 'object' && 'phone' in equipment
    ? (equipment as { phone?: { model?: string; usb?: string; uploadCable?: string } }).phone : undefined;
  const missing: string[] = [];
  if (!phone?.model?.trim()) missing.push('phone model');
  if (!phone?.usb?.trim()) missing.push('phone connection');
  if (!phone?.uploadCable || phone.uploadCable === 'Not available') missing.push('USB-C to USB-C cable or OTG converter');
  return { phone, missing, ready: missing.length === 0 };
}

export function requiresPhoneKit(notes?: string | null, allocations: { status?: string; equipment_item?: { name?: string; category?: string }; equipment_kit?: { name?: string } | null }[] = []) {
  return !!notes?.includes(PHONE_KIT_MARKER) || allocations.some(a =>
    a.status !== 'returned' && a.status !== 'missing' &&
    (/phone|upload kit/i.test(`${a.equipment_item?.name || ''} ${a.equipment_kit?.name || ''}`) || a.equipment_item?.category?.toLowerCase() === 'phone'));
}