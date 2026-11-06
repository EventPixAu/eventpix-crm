// Where a series default equipment entry opens in the Equipment library.
// Kits open the Kits tab with that kit selected; items open Inventory with that item's details.
export function equipmentDeepLink(entry: {
  kit_id?: string | null;
  equipment_item_id?: string | null;
}): string {
  if (entry.kit_id) return `/equipment?tab=kits&kit=${entry.kit_id}`;
  return `/equipment?tab=inventory&item=${entry.equipment_item_id ?? ''}`;
}
