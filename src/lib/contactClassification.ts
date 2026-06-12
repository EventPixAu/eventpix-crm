/**
 * CRM Contact Classification
 *
 * Fixed enums for contact Status and Category fields.
 */

export const CONTACT_STATUSES = [
  { value: 'Current', label: 'Current', description: 'Clients with events in the past 12 months' },
  { value: 'Previous', label: 'Previous', description: 'Contacts dealt with in the past 5 years' },
  { value: 'Old', label: 'Old', description: 'No contact in over 5 years' },
  { value: 'Prospect', label: 'Prospect', description: 'Never booked, potential client' },
] as const;

export type ContactStatus = typeof CONTACT_STATUSES[number]['value'];

export const CONTACT_CATEGORY_GROUPS = [
  {
    label: 'Client',
    options: [
      'Schools',
      'Event Management',
      'Professional Conference Organiser (PCO)',
      'Marketing and PR',
      'Venue Management',
    ],
  },
  {
    label: 'Supplier',
    options: ['Photographer', 'Videographer', 'AV Production', 'Event Supplier'],
  },
] as const;

export const CONTACT_CATEGORIES = CONTACT_CATEGORY_GROUPS.flatMap((g) => g.options);
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];
