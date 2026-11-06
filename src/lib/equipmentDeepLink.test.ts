import { describe, expect, it } from 'vitest';
import { equipmentDeepLink } from './equipmentDeepLink';

describe('series default equipment deep link', () => {
  it('opens a kit on the Kits tab', () => {
    expect(equipmentDeepLink({ kit_id: 'fc36e54b-a014-4864-9885-53952cb4a69c' })).toBe(
      '/equipment?tab=kits&kit=fc36e54b-a014-4864-9885-53952cb4a69c'
    );
  });
  it('opens an item on the Inventory tab', () => {
    expect(equipmentDeepLink({ equipment_item_id: '2f1c733b-e4a0-4e3a-b299-e511337225ce' })).toBe(
      '/equipment?tab=inventory&item=2f1c733b-e4a0-4e3a-b299-e511337225ce'
    );
  });
  it('prefers the kit when an entry is a kit', () => {
    expect(equipmentDeepLink({ kit_id: 'k1', equipment_item_id: 'i1' })).toBe('/equipment?tab=kits&kit=k1');
  });
  it('still links to Inventory when no equipment is recorded', () => {
    expect(equipmentDeepLink({})).toBe('/equipment?tab=inventory&item=');
  });
});
