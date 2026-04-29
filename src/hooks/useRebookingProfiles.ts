import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RebookingProfile {
  id: string;
  client_id: string;
  typical_event_month: number | null;
  typical_lead_time_days: number | null;
  rebook_contact_id: string | null;
  rebook_notes: string | null;
  last_event_at: string | null;
  next_expected_event_at: string | null;
  auto_remind: boolean;
  created_at: string;
  updated_at: string;
}

export interface RebookingProfileWithClient extends RebookingProfile {
  client?: {
    id: string;
    business_name: string;
  } | null;
  rebook_contact?: {
    id: string;
    contact_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export type RebookingProfileInsert = Pick<RebookingProfile, 'client_id'> & 
  Partial<Pick<RebookingProfile, 'typical_event_month' | 'typical_lead_time_days' | 'rebook_contact_id' | 'rebook_notes' | 'auto_remind'>>;

export type RebookingProfileUpdate = Partial<Omit<RebookingProfile, 'id' | 'client_id' | 'created_at' | 'updated_at'>>;

export function useRebookingProfiles() {
  return useQuery({
    queryKey: ['rebooking-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .select(`
          *,
          client:clients(id, business_name),
          rebook_contact:client_contacts(id, contact_name, email, phone)
        `)
        .order('next_expected_event_at', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as RebookingProfileWithClient[];
    },
  });
}

export function useUpcomingRebookings(daysAhead: number = 90) {
  return useQuery({
    queryKey: ['rebooking-profiles', 'upcoming', daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .select(`
          *,
          client:clients(id, business_name),
          rebook_contact:client_contacts(id, contact_name, email, phone)
        `)
        .eq('auto_remind', true)
        .not('next_expected_event_at', 'is', null)
        .lte('next_expected_event_at', futureDate.toISOString())
        .order('next_expected_event_at', { ascending: true });
      
      if (error) throw error;
      return data as RebookingProfileWithClient[];
    },
  });
}

export function useRebookingProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: ['rebooking-profiles', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .select(`
          *,
          client:clients(id, business_name),
          rebook_contact:client_contacts(id, contact_name, email, phone)
        `)
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data as RebookingProfileWithClient | null;
    },
    enabled: !!clientId,
  });
}

export function useCreateRebookingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: RebookingProfileInsert) => {
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .insert(profile)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebooking-profiles'] });
      toast.success('Rebooking profile created successfully');
    },
    onError: (error) => {
      toast.error('Error creating rebooking profile', { description: error.message });
    },
  });
}

export function useUpdateRebookingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: RebookingProfileUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rebooking-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['rebooking-profiles', data.client_id] });
      toast.success('Rebooking profile updated successfully');
    },
    onError: (error) => {
      toast.error('Error updating rebooking profile', { description: error.message });
    },
  });
}

export function useUpsertRebookingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: RebookingProfileInsert) => {
      const { data, error } = await supabase
        .from('rebooking_profiles')
        .upsert(profile, { onConflict: 'client_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebooking-profiles'] });
      toast.success('Rebooking profile saved successfully');
    },
    onError: (error) => {
      toast.error('Error saving rebooking profile', { description: error.message });
    },
  });
}

export function useDeleteRebookingProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rebooking_profiles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rebooking-profiles'] });
      toast.success('Rebooking profile deleted successfully');
    },
    onError: (error) => {
      toast.error('Error deleting rebooking profile', { description: error.message });
    },
  });
}

// Helper function to calculate next expected event date
export function calculateNextExpectedEvent(
  typicalMonth: number | null, 
  leadTimeDays: number = 60
): Date | null {
  if (!typicalMonth) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  
  // If typical month has passed this year, target next year
  let targetYear = currentYear;
  if (typicalMonth < currentMonth) {
    targetYear = currentYear + 1;
  }
  
  // Create date for the 15th of the typical month (middle of month)
  const expectedDate = new Date(targetYear, typicalMonth - 1, 15);
  
  return expectedDate;
}
