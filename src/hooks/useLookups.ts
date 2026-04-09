import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventType {
  id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface DeliveryMethod {
  id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface StaffRole {
  id: string;
  name: string;
}

export interface EquipmentCategory {
  id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}

// Returns ACTIVE event types only, sorted by sort_order
export function useEventTypes() {
  return useQuery({
    queryKey: ['event-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as EventType[];
    },
  });
}

// Returns ACTIVE delivery methods only, sorted by sort_order
export function useDeliveryMethods() {
  return useQuery({
    queryKey: ['delivery-methods', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_methods_lookup')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as DeliveryMethod[];
    },
  });
}

export function useStaffRoles() {
  return useQuery({
    queryKey: ['staff-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_roles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as StaffRole[];
    },
  });
}

// Returns ACTIVE equipment categories only, sorted by sort_order
export function useEquipmentCategories() {
  return useQuery({
    queryKey: ['equipment-categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as EquipmentCategory[];
    },
  });
}

export interface Location {
  id: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}

// Returns ACTIVE locations only, sorted alphabetically
export function useLocations() {
  return useQuery({
    queryKey: ['locations', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Location[];
    },
  });
}
