import { describe, it, expect } from 'vitest';
import {
  filterClientSessions,
  filterClientConfirmationRecipients,
  filterVisibleAssignments,
  filterVisibleSessions,
} from './editorVisibility';

const editor = { user_id: 'u-editor', session_id: 's-post', staff_role: { name: 'Staff Editor - Zno Gallery (post event)' }, profile: { email: 'nat@example.com' } };
const photographer = { user_id: 'u-photo', session_id: 's-shoot', staff_role: { name: 'Photographer' }, profile: { email: 'nigel@example.com' } };
const postSession = { id: 's-post', session_type: 'post_production' };
const hyphenPostSession = { id: 's-post2', session_type: 'post-production' };
const shootSession = { id: 's-shoot', session_type: 'general' };

const admin = { isAdmin: true };
const editorViewer = { isAdmin: false, userId: 'u-editor', userEmail: 'nat@example.com' };
const otherCrew = { isAdmin: false, userId: 'u-other', userEmail: 'other@example.com' };

describe('client confirmation content', () => {
  it('excludes post-event editing sessions from the client schedule', () => {
    expect(filterClientSessions([shootSession, postSession]).map(s => s.id)).toEqual(['s-shoot']);
  });

  it('excludes hyphenated post-production sessions too', () => {
    expect(filterClientSessions([shootSession, hyphenPostSession]).map(s => s.id)).toEqual(['s-shoot']);
  });

  it('excludes editors from the client confirmation recipient list', () => {
    const recipients = [
      { type: 'client', email: 'sally@client.com' },
      { type: 'photographer', email: 'nigel@example.com' },
      { type: 'photographer', email: 'nat@example.com' },
    ];
    expect(filterClientConfirmationRecipients(recipients, [editor, photographer]).map(r => r.email))
      .toEqual(['sally@client.com', 'nigel@example.com']);
  });
});

describe('event page visibility', () => {
  it('hides editor assignments from other team members', () => {
    expect(filterVisibleAssignments([editor, photographer], otherCrew)).toEqual([photographer]);
  });

  it('shows editor assignments to admins', () => {
    expect(filterVisibleAssignments([editor, photographer], admin)).toHaveLength(2);
  });

  it('shows editors their own assignment and post-event session', () => {
    expect(filterVisibleAssignments([editor, photographer], editorViewer)).toHaveLength(2);
    expect(filterVisibleSessions([shootSession, postSession], [editor, photographer], editorViewer)).toHaveLength(2);
  });

  it('hides post-event sessions from other team members', () => {
    expect(filterVisibleSessions([shootSession, postSession], [editor, photographer], otherCrew).map(s => s.id))
      .toEqual(['s-shoot']);
  });

  it('shows onsite sessions and assignments to everyone', () => {
    expect(filterVisibleSessions([shootSession], [photographer], otherCrew)).toEqual([shootSession]);
    expect(filterVisibleAssignments([photographer], otherCrew)).toEqual([photographer]);
  });
});
