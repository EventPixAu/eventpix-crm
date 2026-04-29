/**
 * SITE SETTINGS HOOK
 * 
 * Provides access to configurable site settings (ABN, business name, default terms, etc.)
 * Access: All authenticated users can read; Admin only can update
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SiteSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .order('key');
      
      if (error) throw error;
      return data as SiteSetting[];
    },
  });
}

export function useSiteSetting(key: string) {
  return useQuery({
    queryKey: ['site-settings', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      
      if (error) throw error;
      return data as SiteSetting | null;
    },
  });
}

export function useSiteSettingsMap() {
  const { data: settings, ...rest } = useSiteSettings();
  
  const settingsMap = settings?.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string | null>) || {};
  
  return { settings: settingsMap, ...rest };
}

export function useUpdateSiteSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data, error } = await supabase
        .from('site_settings')
        .update({ value })
        .eq('key', key)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings', variables.key] });
      toast.success('Setting updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update setting', { description: error.message });
    },
  });
}
