export type Product = { id: string; name: string; unit_price: number; tax_rate?: number | null; description?: string | null };
export type Session = { session_date: string; start_time: string | null; end_time: string | null; label?: string | null; session_type?: string | null };

export function photographyPrice(hours: number, products: Product[]) {
  const product = products.find(p => p.name.trim().toUpperCase() === 'EPX1');
  if (!product || !Number.isFinite(Number(product.unit_price)) || Number(product.unit_price) <= 0) {
    throw new Error('Set an active EPX1 hourly photography rate in Products before creating this budget.');
  }
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Each coverage session needs a valid start and finish time.');
  const quantity = Math.max(hours, 2) + 1;
  return { product_id: product.id, quantity, unit_price: Number(product.unit_price), tax_rate: 0.1 };
}

export function coverageDays(sessions: Session[]) {
  const days = new Map<string, { date: string; hours: number; labels: string[] }>();
  for (const s of sessions) {
    if (s.session_type === 'post_production') continue;
    const minutes = (time: string | null) => {
      if (!time || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new Error('Each coverage session needs a valid start and finish time.');
      const [h, m] = time.split(':').map(Number);
      if (h > 23 || m > 59) throw new Error('Invalid session time.');
      return h * 60 + m;
    };
    let duration = minutes(s.end_time) - minutes(s.start_time);
    if (duration < 0) duration += 24 * 60;
    if (duration === 0) throw new Error('Session start and finish cannot be the same.');
    const day = days.get(s.session_date) || { date: s.session_date, hours: 0, labels: [] };
    day.hours += duration / 60;
    if (s.label?.trim()) day.labels.push(s.label.trim());
    days.set(s.session_date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function catalogueItem(item: { product_id: string | null; quantity: number }, products: Product[]) {
  const product = products.find(p => p.id === item.product_id);
  if (!product || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error('Every proposed item must match an active Product with a valid quantity. No estimated rates were added.');
  }
  return { product_id: product.id, quantity: item.quantity, unit_price: Number(product.unit_price), tax_rate: 0.1 };
}