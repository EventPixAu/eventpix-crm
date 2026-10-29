import { describe, expect, it } from 'vitest';
import { eventDeliveryDateValues } from './eventDeliveryDates';

describe('recipient delivery dates', () => {
  it('keeps photographer, guest and client dates independent', () => {
    expect(eventDeliveryDateValues({
      delivery_deadline_photographer: '2026-11-02',
      delivery_deadline_guests: '2026-11-03',
      delivery_deadline: '2026-11-04',
    })).toEqual({
      delivery_deadline_photographer: '2026-11-02',
      delivery_deadline_guests: '2026-11-03',
      delivery_deadline: '2026-11-04',
    });
  });

  it('retains an existing client deadline without assigning it to photographers or guests', () => {
    expect(eventDeliveryDateValues({ delivery_deadline: '2026-11-02' })).toEqual({
      delivery_deadline_photographer: null,
      delivery_deadline_guests: null,
      delivery_deadline: '2026-11-02',
    });
  });

  it('clears only the recipient whose date was removed', () => {
    expect(eventDeliveryDateValues({
      delivery_deadline_photographer: '',
      delivery_deadline_guests: '2026-11-03',
      delivery_deadline: '2026-11-04',
    })).toEqual({
      delivery_deadline_photographer: null,
      delivery_deadline_guests: '2026-11-03',
      delivery_deadline: '2026-11-04',
    });
  });
});