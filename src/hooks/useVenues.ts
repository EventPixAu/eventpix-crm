import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const VENUE_TYPES = ['Hotel', 'Convention Centre', 'Function Centre', 'Stadium', 'Outdoor', 'Other'] as const;
export const SIGNAL_QUALITIES = ['Excellent', 'Good', 'Fair', 'Poor', 'No Signal', 'Not Tested'] as const;

export interface Venue {
  id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  parking_notes: string | null;
  access_notes: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Extended venue library fields
  full_address: string | null;
  website: string | null;
  venue_type: string | null;
  parking_access: string | null;
  parking_cost: string | null;
  public_wifi_ssid: string | null;
  public_wifi_password: string | null;
  event_wifi_ssid: string | null;
  event_wifi_password: string | null;
  internet_notes: string | null;
  telstra_signal: string;
  optus_signal: string;
  signal_notes: string | null;
  events_dept_phone: string | null;
  events_dept_email: string | null;
  events_contact_name: string | null;
  events_contact_phone: string | null;
  events_contact_email: string | null;
  last_visited: string | null;
  is_confirmed: boolean;
  ai_filled_fields: string[];
  needs_crew_review: boolean;
  crew_updated_at: string | null;
  crew_updated_by: string | null;
  crew_updated_by_name: string | null;
}

export type VenueInsert = Partial<Omit<Venue, 'id' | 'created_at' | 'updated_at'>> & { name: string };
export type VenueUpdate = Partial<VenueInsert>;

const asVenue = (row: any): Venue => ({
  ...row,
  ai_filled_fields: Array.isArray(row?.ai_filled_fields) ? row.ai_filled_fields : [],
});

export function useVenues() {
  return useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('*').order('name');
      if (error) throw error;
      return (data ?? []).map(asVenue);
    },
  });
}

export function useActiveVenues() {
  return useQuery({
    queryKey: ['venues', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(asVenue);
    },
  });
}

export function useVenue(id: string | undefined) {
  return useQuery({
    queryKey: ['venues', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('venues').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? asVenue(data) : null;
    },
    enabled: !!id,
  });
}

/** Number of events linked to each venue (by venue_id or matching venue name). */
export function useVenueEventCounts() {
  return useQuery({
    queryKey: ['venues', 'event-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('venue_id, venue_name');
      if (error) throw error;
      const byId: Record<string, number> = {};
      const byName: Record<string, number> = {};
      for (const ev of data ?? []) {
        if (ev.venue_id) byId[ev.venue_id] = (byId[ev.venue_id] ?? 0) + 1;
        else if (ev.venue_name) {
          const key = ev.venue_name.trim().toLowerCase();
          byName[key] = (byName[key] ?? 0) + 1;
        }
      }
      return { byId, byName };
    },
  });
}

export function useVenueEvents(venueId: string | undefined, venueName?: string | null) {
  return useQuery({
    queryKey: ['venues', venueId, 'events', venueName],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, venue_id, venue_name, ops_status')
        .or(
          venueName
            ? `venue_id.eq.${venueId},venue_name.ilike.${venueName.replace(/[%,]/g, ' ')}`
            : `venue_id.eq.${venueId}`,
        )
        .order('event_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!venueId,
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venue: VenueInsert) => {
      const { data, error } = await supabase.from('venues').insert(venue as any).select().single();
      if (error) throw error;
      return asVenue(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue created');
    },
    onError: (error: any) => {
      toast.error('Error creating venue', { description: error.message });
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: VenueUpdate & { id: string }) => {
      const { data, error } = await supabase.from('venues').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return asVenue(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['venues', data.id] });
      toast.success('Venue updated');
    },
    onError: (error: any) => {
      toast.error('Error updating venue', { description: error.message });
    },
  });
}

/** Crew-facing update from the Day-Of View — writes live, flags for admin review. */
export function useCrewUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, updates, note }: { venueId: string; updates: Record<string, string>; note?: string }) => {
      const { data, error } = await supabase.rpc('crew_update_venue', {
        _venue_id: venueId,
        _updates: updates as any,
        _note: note?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      queryClient.invalidateQueries({ queryKey: ['venue-notes', vars.venueId] });
      toast.success('Venue updated — admin has been notified to review');
    },
    onError: (error: any) => toast.error('Could not update venue', { description: error.message }),
  });
}

export function useDeleteVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue deleted');
    },
    onError: (error: any) => {
      toast.error('Error deleting venue', { description: error.message });
    },
  });
}

// ===== Venue notes =====
export interface VenueNote {
  id: string;
  venue_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useVenueNotes(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-notes', venueId],
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('venue_notes')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VenueNote[];
    },
    enabled: !!venueId,
  });
}

export function useAddVenueNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, note }: { venueId: string; note: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('venue_notes')
        .insert({ venue_id: venueId, note, created_by: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['venue-notes', vars.venueId] });
      toast.success('Note added');
    },
    onError: (error: any) => toast.error('Could not add note', { description: error.message }),
  });
}

export function useDeleteVenueNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; venueId: string }) => {
      const { error } = await supabase.from('venue_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['venue-notes', vars.venueId] });
    },
    onError: (error: any) => toast.error('Could not delete note', { description: error.message }),
  });
}

// ===== AI lookup =====
export interface VenueAiLookupResult {
  fields: Record<string, string>;
  aiFilled: string[];
  priorEventCount: number;
}

export function useVenueAiLookup() {
  return useMutation({
    mutationFn: async ({ name, address }: { name: string; address?: string }) => {
      const { data, error } = await supabase.functions.invoke('venue-ai-lookup', {
        body: { name, address },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as VenueAiLookupResult;
    },
    onError: (error: any) => {
      toast.error('AI lookup failed', { description: error.message });
    },
  });
}
