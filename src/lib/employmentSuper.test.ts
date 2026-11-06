import { describe, it, expect } from 'vitest';
import { superAmount } from './employmentSuper';

describe('employee super', () => {
  it('adds 12% super to employee pay: $40/hr x 5hrs = $200 + $24', () => {
    expect(superAmount(200, 'employee')).toBe(24);
  });
  it('adds no super for contractors', () => {
    expect(superAmount(200, 'contract')).toBe(0);
    expect(superAmount(200, null)).toBe(0);
  });
});
