import { describe, it, expect } from 'vitest';
import { unitsAfterLightingSetup } from './assignmentPaidHours';
describe('lighting setup units', () => {
  it('7hr call with lighting kit = 6 call units, 7 with the lighting unit', () => {
    expect(unitsAfterLightingSetup(7, 1)).toBe(6);
    expect(unitsAfterLightingSetup(7, 1) + 1).toBe(7);
  });
  it('no lighting leaves units unchanged', () => expect(unitsAfterLightingSetup(7, 0)).toBe(7));
});
