import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface CompanyInsurancePolicy {
  id: string;
  insurance_type: string;
  policy_number: string | null;
  insurer_name: string | null;
  renewal_due_date: string | null;
  renewal_paid_date: string | null;
  coc_file_path: string | null;
  coc_file_name: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const QUERY_KEY = ['company-insurance-policies'];

export function useCompanyInsurancePolicies() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_insurance_policies')
        .select('*')
        .order('sort_order')
        .order('insurance_type');
      if (error) throw error;
      return data as CompanyInsurancePolicy[];
    },
  });
}

export function useCreateInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (policy: Partial<CompanyInsurancePolicy>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('company_insurance_policies')
        .insert([{ ...policy, created_by: user?.id } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Insurance policy created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyInsurancePolicy> & { id: string }) => {
      const { data, error } = await supabase
        .from('company_insurance_policies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Insurance policy updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_insurance_policies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Insurance policy deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadCoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ policyId, file }: { policyId: string; file: File }) => {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${policyId}/${timestamp}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('insurance-documents')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('company_insurance_policies')
        .update({
          coc_file_path: filePath,
          coc_file_name: file.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', policyId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Certificate of Currency uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function getCocSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from('insurance-documents')
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
