import { describe, expect, it } from 'vitest';
import { crewSmsActivated, crewSmsActivationKey } from '../../supabase/functions/_shared/crewSmsActivation';

describe('explicit automatic SMS activation', () => {
  it('defaults automatic SMS off', () => {
    expect(crewSmsActivated(null, 'setup')).toBe(false);
    expect(crewSmsActivated(undefined, 'delivery')).toBe(false);
    expect(crewSmsActivated('{broken', 'setup')).toBe(false);
  });
  it('activates setup and delivery independently only when explicitly selected', () => {
    expect(crewSmsActivated('{"setup":true,"delivery":false}', 'setup')).toBe(true);
    expect(crewSmsActivated('{"setup":true,"delivery":false}', 'delivery')).toBe(false);
    expect(crewSmsActivated('{"setup":"true"}', 'setup')).toBe(false);
    expect(crewSmsActivated('{"delivery":true}', 'followup')).toBe(false);
    expect(crewSmsActivationKey('one')).not.toBe(crewSmsActivationKey('two'));
  });
});