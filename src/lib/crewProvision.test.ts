import { expect, it } from 'vitest';
import { crewProvisionStatus } from './crewProvision';
it('retains yes, no and not-required meal/parking values for crew', () => {
  expect(crewProvisionStatus('yes', true)).toBe('Yes');
  expect(crewProvisionStatus('no', false)).toBe('No');
  expect(crewProvisionStatus('not_required', null)).toBe('Not required');
  expect(crewProvisionStatus(null, null)).toBe('To be confirmed');
});