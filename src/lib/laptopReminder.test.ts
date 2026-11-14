import { describe, it, expect, vi } from 'vitest';
import { laptopAllocation, sendLaptopReminders } from './laptopReminder';

describe('bring laptop', () => {
  it('provides an allocation without requiring laptop profile details', () => {
    expect(laptopAllocation()).toMatchObject({ category: 'computer', items: [{ name: 'Laptop (bring to event)' }] });
  });
  it('reminds only selected people once without reading laptop specifications', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const selected = { userId: 'evie', assignmentId: 'assignment-1', laptopSelected: true };
    await sendLaptopReminders([selected, selected, { userId: 'nat', assignmentId: 'assignment-2', laptopSelected: false }], send);
    expect(send).toHaveBeenCalledExactlyOnceWith('assignment-1');
  });
  it('keeps individual reminder failures separate', async () => {
    const results = await sendLaptopReminders([{ userId: 'evie', assignmentId: 'assignment-1', laptopSelected: true }], async () => { throw new Error('Unable to send'); });
    expect(results[0].status).toBe('rejected');
  });
});