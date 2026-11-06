import { describe, expect, it } from 'vitest';
import { stripLbaPrefix } from './eventNaming';

describe('stripLbaPrefix', () => {
  it('removes the LBA prefix with a space', () => {
    expect(stripLbaPrefix('LBA Hills')).toBe('Hills');
    expect(stripLbaPrefix('LBA Fairfield City')).toBe('Fairfield City');
  });

  it('removes the LBA prefix with a dash and extra spacing', () => {
    expect(stripLbaPrefix('LBA - Adelaide')).toBe('Adelaide');
    expect(stripLbaPrefix('LBA  - Central Melbourne')).toBe('Central Melbourne');
    expect(stripLbaPrefix('LBA  Camden')).toBe('Camden');
  });

  it('keeps the region and year for series names', () => {
    expect(stripLbaPrefix('LBA NSW 2026')).toBe('NSW 2026');
  });

  it('leaves non-LBA names unchanged', () => {
    expect(stripLbaPrefix('Champions of Business')).toBe('Champions of Business');
    expect(stripLbaPrefix('SBC 2026')).toBe('SBC 2026');
    expect(stripLbaPrefix('Smith Wedding')).toBe('Smith Wedding');
  });

  it('does not strip words that merely start with LBA', () => {
    expect(stripLbaPrefix('LBAR Conference')).toBe('LBAR Conference');
  });

  it('never returns a blank name', () => {
    expect(stripLbaPrefix('LBA')).toBe('LBA');
    expect(stripLbaPrefix('LBA -')).toBe('LBA');
  });
});
