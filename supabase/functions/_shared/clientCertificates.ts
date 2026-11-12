export const CLIENT_CERTIFICATE_TYPES = new Set([
  'Public Liability Insurance', 'Professional Indemnity Insurance',
  'Workers Comp', 'Workers Compensation', 'Venue Inductions', 'WWCC / Blue Card',
]);

export function clientCertificateAssignment(a: any) {
  const role = a.staff_role?.name || a.role_on_event || a.staff?.role || '';
  return !/editor|retoucher|post[-\s]?production/i.test(role)
    && !['declined', 'cancelled', 'removed'].includes(a.assignment_status || '');
}

export async function companyCertificates(db: any) {
  const { data, error } = await db.from('company_insurance_policies')
    .select('id,insurance_type,renewal_due_date,coc_file_path,coc_file_name')
    .eq('is_active', true).order('sort_order');
  if (error) throw error;
  return Promise.all((data || []).filter((p: any) => p.coc_file_path).map(async (p: any) => {
    const { data: signed, error: signError } = await db.storage.from('insurance-documents').createSignedUrl(p.coc_file_path, 3600);
    if (signError) throw signError;
    return { id: p.id, name: p.insurance_type, expiry_date: p.renewal_due_date, url: signed?.signedUrl };
  }));
}

export async function teamCertificates(db: any, eventId: string) {
  const { data: assignments, error } = await db.from('event_assignments')
    .select('user_id,assignment_status,role_on_event,staff_role:staff_roles(name),profile:profiles!event_assignments_user_id_fkey(full_name),staff:staff_id(user_id,name,role)')
    .eq('event_id', eventId);
  if (error) throw error;
  const members = new Map<string, string>();
  for (const a of assignments || []) {
    const id = a.user_id || a.staff?.user_id;
    if (id && clientCertificateAssignment(a)) members.set(id, a.profile?.full_name || a.staff?.name || 'Team member');
  }
  if (!members.size) return [];
  const { data: docs, error: docError } = await db.from('staff_compliance_documents')
    .select('id,user_id,document_url,expiry_date,document_type:compliance_document_types(name)')
    .in('user_id', [...members.keys()]).eq('status', 'valid');
  if (docError) throw docError;
  return Promise.all((docs || []).filter((d: any) => CLIENT_CERTIFICATE_TYPES.has(d.document_type?.name)).map(async (d: any) => {
    let path = d.document_url;
    if (path.includes('/storage/v1/object/')) {
      const match = decodeURIComponent(new URL(path).pathname).match(/\/storage\/v1\/object\/(?:public|sign)\/compliance-documents\/(.+)/);
      if (!match) throw new Error('Invalid certificate storage reference');
      path = match[1];
    } else path = path.replace(/^compliance-documents\//, '');
    if (!path.startsWith(`${d.user_id}/`)) throw new Error('Certificate owner mismatch');
    const { data: signed, error: signError } = await db.storage.from('compliance-documents').createSignedUrl(path, 3600);
    if (signError) throw signError;
    return { id: d.id, name: d.document_type.name, team_member: members.get(d.user_id), expiry_date: d.expiry_date, url: signed?.signedUrl };
  }));
}