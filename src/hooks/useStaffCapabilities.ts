import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Skill {
  id: string;
  name: string;
}

export interface StaffSkill {
  id: string;
  user_id: string;
  skill_id: string;
  skill?: Skill;
}

export interface StaffCapabilities {
  home_city: string | null;
  home_state: string | null;
  travel_ready: boolean;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes_internal: string | null;
  seniority: 'lead' | 'mid' | 'junior';
}

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Skill[];
    },
  });
}

export function useStaffSkills(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-skills', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('staff_skills')
        .select(`
          id,
          user_id,
          skill_id,
          skill:skills(id, name)
        `)
        .eq('user_id', userId);
      
      if (error) throw error;
      return data as unknown as StaffSkill[];
    },
    enabled: !!userId,
  });
}

export function useAllStaffWithSkills() {
  return useQuery({
    queryKey: ['all-staff-with-skills'],
    queryFn: async () => {
      // Get all profiles with photographer role
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          status,
          home_city,
          home_state,
          travel_ready,
          preferred_start_time,
          preferred_end_time,
          seniority,
          default_role_id,
          staff_role:staff_roles(id, name)
        `)
        .eq('status', 'active');
      
      if (profilesError) throw profilesError;
      
      // Get all staff skills
      const { data: skills, error: skillsError } = await supabase
        .from('staff_skills')
        .select(`
          user_id,
          skill:skills(id, name)
        `);
      
      if (skillsError) throw skillsError;
      
      // Group skills by user
      const skillsByUser = (skills || []).reduce((acc, item) => {
        if (!acc[item.user_id]) acc[item.user_id] = [];
        if (item.skill) acc[item.user_id].push(item.skill);
        return acc;
      }, {} as Record<string, Skill[]>);
      
      return (profiles || []).map(profile => ({
        ...profile,
        skills: skillsByUser[profile.id] || [],
      }));
    },
  });
}

export function useUpdateStaffSkills() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, skillIds }: { userId: string; skillIds: string[] }) => {
      // Delete existing skills
      const { error: deleteError } = await supabase
        .from('staff_skills')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;
      
      // Insert new skills
      if (skillIds.length > 0) {
        const { error: insertError } = await supabase
          .from('staff_skills')
          .insert(skillIds.map(skill_id => ({ user_id: userId, skill_id })));
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff-skills', userId] });
      queryClient.invalidateQueries({ queryKey: ['all-staff-with-skills'] });
    },
  });
}

export function useUpdateStaffCapabilities() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, capabilities }: { userId: string; capabilities: Partial<StaffCapabilities> }) => {
      const { error } = await supabase
        .from('profiles')
        .update(capabilities)
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['all-staff-with-skills'] });
    },
  });
}
