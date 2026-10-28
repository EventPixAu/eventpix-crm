import { describe, it, expect } from 'vitest';
import { photographyPrice, catalogueItem, coverageDays } from '../../supabase/functions/generate-budget-from-sessions/pricing';

const products = [{ id: 'hourly', name: 'EPX1', unit_price: 275 }];
describe('client session budget pricing', () => {
  it('charges $825 ex GST for the first two hours', () => {
    const p = photographyPrice(2, products);
    expect(p.quantity * p.unit_price).toBe(825);
    expect(photographyPrice(1, products).quantity * p.unit_price).toBe(825);
  });
  it('charges $1100 ex GST for the three-hour Welcome reception', () => {
    const p = photographyPrice(3, products);
    expect(p.quantity).toBe(4);
    expect(p.unit_price).toBe(275);
    expect(p.quantity * p.unit_price).toBe(1100);
    expect(p.tax_rate).toBe(0.1);
  });
  it('charges each extra hour at the current Products rate', () => {
    expect(photographyPrice(4, products).quantity * 275).toBe(1375);
    expect(photographyPrice(3, [{ ...products[0], unit_price: 300 }]).unit_price).toBe(300);
  });
  it('rejects invented rates or missing Products', () => {
    expect(() => photographyPrice(3, [])).toThrow();
    expect(() => catalogueItem({ product_id: null, quantity: 1 }, products)).toThrow();
    expect(catalogueItem({ product_id: 'hourly', quantity: 1 }, products).unit_price).toBe(275);
  });
  it('uses coverage hours only and applies one minimum per session day', () => {
    const days = coverageDays([
      { session_date: '2027-07-07', start_time: '09:00:00', end_time: '12:30:00' },
      { session_date: '2027-07-07', start_time: '19:00:00', end_time: '21:00:00' },
      { session_date: '2027-07-08', start_time: '09:00:00', end_time: '11:00:00', session_type: 'post_production' },
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].hours).toBe(5.5);
    expect(photographyPrice(days[0].hours, products).quantity * 275).toBe(1787.5);
  });
});