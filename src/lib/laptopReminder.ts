export function laptopAllocation() {
  return { kitId: 'bring-laptop', category: 'computer' as const, label: 'Bring Laptop', items: [{ id: 'bring-laptop', brand: '', name: 'Laptop (bring to event)' }] };
}

export async function sendLaptopReminders(
  candidates: { userId: string; assignmentId: string; laptopSelected: boolean }[],
  send: (assignmentId: string) => Promise<void>,
) {
  const selected = [...new Map(candidates.filter(c => c.laptopSelected).map(c => [c.userId, c])).values()];
  return Promise.allSettled(selected.map(c => send(c.assignmentId)));
}