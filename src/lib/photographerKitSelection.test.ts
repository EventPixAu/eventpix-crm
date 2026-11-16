import { describe, expect, it } from 'vitest';
import { kitItemKey, selectablePhotographerKits, selectedKitItems } from './photographerKitSelection';

const item = (id: string, name: string) => ({ id, name, brand: '', notes: '' });

describe('photographer kit selection', () => {
  it('selects the two lighting entries independently rather than allocating both', () => {
    const kits = selectablePhotographerKits({ camera: [], lighting: [item('ad400', '2 x AD400'), item('cob', '2 x cob lighting (battery)')], audio: [], backdrop: [], other: [] });
    const kit = kits[0];
    const selected = new Set([kitItemKey('evie', kit.id, 1)]);
    expect(selectedKitItems(kit.items, selected, 'evie', kit.id).map(i => i.id)).toEqual(['cob']);
    expect(selectedKitItems(kit.items, selected, 'other', kit.id)).toEqual([]);
    expect(selectablePhotographerKits({ camera: [], lighting: kit.items, audio: [], backdrop: [], other: [] })[0].id).toBe(kit.id);
  });

  it('keeps separately named kits and supports partial selection in every category', () => {
    const categories = ['camera', 'lighting', 'audio', 'backdrop', 'other'] as const;
    const source = categories.flatMap(category => [1, 2].map(n => ({ id: `${category}-${n}`, category, name: `${category} ${n}`, items: [item('a', 'A'), item('b', 'B')] })));
    const kits = selectablePhotographerKits({ version: 2, kits: source });
    expect(kits.map(k => k.id)).toEqual(source.map(k => k.id));
    for (const kit of kits) {
      expect(selectedKitItems(kit.items, new Set([kitItemKey('person', kit.id, 0)]), 'person', kit.id)).toEqual([item('a', 'A')]);
    }
  });
});