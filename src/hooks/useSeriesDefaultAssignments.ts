 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 
 export interface SeriesDefaultAssignment {
   id: string;
   series_id: string;
   user_id: string;
   staff_role_id: string | null;
   assignment_notes: string | null;
   sort_order: number;
   created_at: string;
   created_by: string | null;
   // Joined data
   user?: {
     id: string;
     full_name: string | null;
     email: string | null;
     avatar_url: string | null;
   };
   staff_role?: {
     id: string;
     name: string;
   } | null;
 }
 
 export function useSeriesDefaultAssignments(seriesId: string | undefined) {
   return useQuery({
     queryKey: ['series-default-assignments', seriesId],
     queryFn: async () => {
       if (!seriesId) return [];
       
       const { data, error } = await supabase
         .from('series_default_assignments')
         .select(`
           *,
           user:profiles!series_default_assignments_user_id_fkey(id, full_name, email, avatar_url),
           staff_role:staff_roles(id, name)
         `)
         .eq('series_id', seriesId)
         .order('sort_order');
       
       if (error) throw error;
       return data as SeriesDefaultAssignment[];
     },
     enabled: !!seriesId,
   });
 }
 
 export function useAddSeriesDefaultAssignment() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async ({
       series_id,
       user_id,
       staff_role_id,
       assignment_notes,
     }: {
       series_id: string;
       user_id: string;
       staff_role_id?: string | null;
       assignment_notes?: string | null;
     }) => {
       // Get current max sort_order
       const { data: existing } = await supabase
         .from('series_default_assignments')
         .select('sort_order')
         .eq('series_id', series_id)
         .order('sort_order', { ascending: false })
         .limit(1);
       
       const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
       
       const { data, error } = await supabase
         .from('series_default_assignments')
         .insert({
           series_id,
           user_id,
           staff_role_id: staff_role_id || null,
           assignment_notes: assignment_notes || null,
           sort_order: nextOrder,
         })
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['series-default-assignments', variables.series_id] });
       toast.success('Default assignment added');
     },
     onError: (error: any) => {
       if (error.code === '23505') {
         toast.error('Staff member is already assigned as a default');
       } else {
         toast.error('Failed to add assignment: ' + error.message);
       }
     },
   });
 }
 
 export function useUpdateSeriesDefaultAssignment() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async ({
       id,
       series_id,
       staff_role_id,
       assignment_notes,
     }: {
       id: string;
       series_id: string;
       staff_role_id?: string | null;
       assignment_notes?: string | null;
     }) => {
       const { error } = await supabase
         .from('series_default_assignments')
         .update({
           staff_role_id: staff_role_id || null,
           assignment_notes: assignment_notes || null,
         })
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['series-default-assignments', variables.series_id] });
       toast.success('Assignment updated');
     },
     onError: (error) => {
       toast.error('Failed to update: ' + error.message);
     },
   });
 }
 
 export function useRemoveSeriesDefaultAssignment() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async ({ id, series_id }: { id: string; series_id: string }) => {
       const { error } = await supabase
         .from('series_default_assignments')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['series-default-assignments', variables.series_id] });
       toast.success('Default assignment removed');
     },
     onError: (error) => {
       toast.error('Failed to remove: ' + error.message);
     },
   });
 }
 
 // Sync default assignments to events in the series
 export function useSyncDefaultAssignmentsToEvents() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async ({
       series_id,
       event_ids,
       default_assignments,
     }: {
       series_id: string;
       event_ids: string[];
       default_assignments: SeriesDefaultAssignment[];
     }) => {
       const results = {
         added: 0,
         skipped: 0,
         errors: [] as string[],
       };
       
       for (const eventId of event_ids) {
         for (const assignment of default_assignments) {
           // Check if already assigned
           const { data: existing } = await supabase
             .from('event_assignments')
             .select('id')
             .eq('event_id', eventId)
             .eq('user_id', assignment.user_id)
             .maybeSingle();
           
           if (existing) {
             results.skipped++;
             continue;
           }
           
           // Create assignment
           const { error } = await supabase
             .from('event_assignments')
             .insert({
               event_id: eventId,
               user_id: assignment.user_id,
               staff_role_id: assignment.staff_role_id,
               assignment_notes: assignment.assignment_notes,
             });
           
           if (error) {
             results.errors.push(`Event ${eventId}: ${error.message}`);
           } else {
             results.added++;
           }
         }
       }
       
       return results;
     },
     onSuccess: (results, variables) => {
       queryClient.invalidateQueries({ queryKey: ['series-events', variables.series_id] });
       queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
       
       if (results.added > 0) {
         toast.success(`Added ${results.added} assignment(s) across events`);
       }
       if (results.skipped > 0) {
         toast.info(`${results.skipped} already assigned (skipped)`);
       }
       if (results.errors.length > 0) {
         toast.error(`${results.errors.length} error(s) occurred`);
       }
     },
     onError: (error) => {
       toast.error('Sync failed: ' + error.message);
     },
   });
 }