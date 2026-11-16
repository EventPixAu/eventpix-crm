import { describe, expect, it } from 'vitest';
import { prepareOpsEmailMessage } from './opsEmailMessage';

describe('operational email preparation', () => {
  it('resolves the request subject and body before delivery', () => {
    const fields: Record<string, string> = { event_name: 'Stihl - Christmas Party', recipient_name: 'Evie' };
    const result = prepareOpsEmailMessage('Request to upload files – {{event_name}}', 'Hi {{recipient_name}}',
      text => text.replace(/\{\{(\w+)\}\}/g, (match, field) => fields[field] ?? match));
    expect(result.subject).toBe('Request to upload files – Stihl - Christmas Party');
    expect(result.bodyHtml).toBe('Hi Evie');
  });
  it('blocks an unresolved subject', () => {
    expect(() => prepareOpsEmailMessage('{{unknown}}', 'Hi Evie', text => text)).toThrow('unfilled fields');
  });
  it('blocks an unresolved body', () => {
    expect(() => prepareOpsEmailMessage('Request files', '{{unknown}}', text => text)).toThrow('unfilled fields');
  });
});