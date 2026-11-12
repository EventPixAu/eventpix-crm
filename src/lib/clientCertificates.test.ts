import { describe, expect, it } from 'vitest';
import { CLIENT_CERTIFICATE_TYPES, clientCertificateAssignment } from '../../supabase/functions/_shared/clientCertificates';
describe('client certificate privacy', () => {
  it('includes public liability and staff compliance certificates', () => {
    expect(CLIENT_CERTIFICATE_TYPES.has('Public Liability Insurance')).toBe(true);
    expect(CLIENT_CERTIFICATE_TYPES.has('WWCC / Blue Card')).toBe(true);
  });
  it('excludes identity, tax and employment documents', () => {
    for (const name of ['Photo ID', 'Tax File Declaration', 'Contractor Agreement', 'Equipment Agreement']) expect(CLIENT_CERTIFICATE_TYPES.has(name)).toBe(false);
  });
  it('excludes internal editors and declined allocations', () => {
    expect(clientCertificateAssignment({ role_on_event: 'Staff Editor' })).toBe(false);
    expect(clientCertificateAssignment({ role_on_event: 'Photographer', assignment_status: 'declined' })).toBe(false);
    expect(clientCertificateAssignment({ role_on_event: 'Photographer', assignment_status: 'confirmed' })).toBe(true);
  });
});