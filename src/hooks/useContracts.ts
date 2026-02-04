/**
 * CONTRACTS HOOKS
 * 
 * Provides data access for Contracts.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled';

export interface Contract {
  id: string;
  client_id: string;
  lead_id: string | null;
  event_id: string | null;
  quote_id: string | null;
  title: string;
  file_url: string | null;
  template_id: string | null;
  rendered_html: string | null;
  status: ContractStatus;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  public_token: string | null;
  created_at: string;
  updated_at: string;
  client?: any;
  lead?: any;
  event?: any;
  quote?: any;
}

export interface ContractInsert {
  client_id: string;
  lead_id?: string | null;
  event_id?: string | null;
  quote_id?: string | null;
  title: string;
  file_url?: string | null;
  status?: ContractStatus;
  sent_at?: string | null;
  signed_at?: string | null;
  rendered_html?: string | null;
}

export interface ContractUpdate extends Partial<ContractInsert> {
  id: string;
}

// =============================================================
// CONTRACT HOOKS
// =============================================================

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          client:clients(id, business_name),
          lead:leads(id, lead_name),
          quote:quotes(id, quote_number)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contract[];
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          client:clients(*),
          lead:leads(*),
          quote:quotes(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Contract;
    },
    enabled: !!id,
  });
}

export function useClientContracts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          lead:leads(id, lead_name),
          quote:quotes(id, quote_number)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!clientId,
  });
}

export function useLeadContracts(leadId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          client:clients(id, business_name),
          quote:quotes(id, quote_number)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!leadId,
  });
}

// Fetch contracts for an event (Job)
export function useEventContracts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['contracts', 'event', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          client:clients(id, business_name),
          quote:quotes(id, quote_number)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!eventId,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contract: ContractInsert) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert(contract)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create contract', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ContractUpdate) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts', variables.id] });
      toast({ title: 'Contract updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update contract', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete contract', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUploadContractFile() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ file, contractId }: { file: File; contractId: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${contractId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('contracts')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('contracts')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to upload file', description: error.message, variant: 'destructive' });
    },
  });
}

export function useMarkContractAsSent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.rpc('mark_contract_as_sent', {
        p_contract_id: contractId,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; public_token?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to mark contract as sent');
      }
      
      return result;
    },
    onSuccess: (_, contractId) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts', contractId] });
      toast({ title: 'Contract marked as sent' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update contract', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRegenerateContractToken() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.rpc('regenerate_contract_token', {
        p_contract_id: contractId,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; new_token?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to regenerate token');
      }
      
      return result;
    },
    onSuccess: (_, contractId) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts', contractId] });
      toast({ title: 'Signing link regenerated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to regenerate link', description: error.message, variant: 'destructive' });
    },
  });
}

// Sign a contract internally (simulate signing)
export function useSignContractInternal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      contractId,
      signedByName,
      signedByEmail,
    }: {
      contractId: string;
      signedByName?: string;
      signedByEmail?: string;
    }) => {
      const { data, error } = await supabase.rpc('sign_contract_internal', {
        p_contract_id: contractId,
        p_signed_by_name: signedByName || null,
        p_signed_by_email: signedByEmail || null,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; contract_id?: string; signed_at?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to sign contract');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract signed successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to sign contract', description: error.message, variant: 'destructive' });
    },
  });
}
