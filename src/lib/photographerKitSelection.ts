import type { EquipmentKit, StoredEquipment, PhotographyEquipment } from '@/components/PhotographyEquipmentEditor';

const categories = ['camera', 'lighting', 'audio', 'backdrop', 'other'] as const;
const labels = ['Camera Kit', 'Lighting Kit', 'Audio Kit', 'Backdrop Kit', 'Other'];

/** Keep named kits intact; legacy categories still allow selecting their entries separately. */
export function selectablePhotographerKits(data: StoredEquipment): EquipmentKit[] {
  if ('version' in data && data.version === 2) {
    return data.kits.map(kit => ({ ...kit, items: kit.items.filter(item => item.name?.trim()) }))
      .filter(kit => kit.items.length > 0);
  }
  const legacy = data as PhotographyEquipment & { cameras?: PhotographyEquipment['camera']; lights?: PhotographyEquipment['lighting']; backdrops?: PhotographyEquipment['backdrop']; lenses?: PhotographyEquipment['other'] };
  const entries = [legacy.camera ?? legacy.cameras, legacy.lighting ?? legacy.lights, legacy.audio, legacy.backdrop ?? legacy.backdrops, legacy.other ?? legacy.lenses];
  return categories.flatMap((category, index) => {
    const items = (entries[index] ?? []).filter(item => item.name?.trim());
    return items.length ? [{ id: `legacy-${category}`, name: labels[index], category, items }] : [];
  });
}

export function kitItemKey(ownerId: string, kitId: string, index: number): string {
  return JSON.stringify([ownerId, kitId, index]);
}

export function selectedKitItems<T>(items: T[], selected: Set<string>, ownerId: string, kitId: string): T[] {
  return items.filter((_, index) => selected.has(kitItemKey(ownerId, kitId, index)));
}