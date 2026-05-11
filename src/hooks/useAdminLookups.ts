import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Types
export interface LookupItem {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface EquipmentCategory extends LookupItem {}
export interface EventType extends LookupItem {}
export interface DeliveryMethod extends LookupItem {}

// =============================================
// EVENT TYPES
// =============================================

export function useAllEventTypes() {
  return useQuery({
    queryKey: ['event-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as EventType[];
    },
  });
}

export function useCreateEventType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: maxData } = await supabase
        .from('event_types')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('event_types')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-types'] });
      toast.success('Event type created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateEventType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EventType> & { id: string }) => {
      const { data, error } = await supabase
        .from('event_types')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-types'] });
      toast.success('Event type updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

// =============================================
// DELIVERY METHODS
// =============================================

export function useAllDeliveryMethods() {
  return useQuery({
    queryKey: ['delivery-methods', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_methods_lookup')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as DeliveryMethod[];
    },
  });
}

export function useCreateDeliveryMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('delivery_methods_lookup')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('delivery_methods_lookup')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-methods'] });
      toast.success('Delivery method created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateDeliveryMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeliveryMethod> & { id: string }) => {
      const { data, error } = await supabase
        .from('delivery_methods_lookup')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-methods'] });
      toast.success('Delivery method updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

// =============================================
// EQUIPMENT CATEGORIES
// =============================================

export function useAllEquipmentCategories() {
  return useQuery({
    queryKey: ['equipment-categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_categories')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as EquipmentCategory[];
    },
  });
}

export function useActiveEquipmentCategories() {
  return useQuery({
    queryKey: ['equipment-categories', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_categories')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as EquipmentCategory[];
    },
  });
}

export function useCreateEquipmentCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('equipment_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('equipment_categories')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-categories'] });
      toast.success('Equipment category created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateEquipmentCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EquipmentCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('equipment_categories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-categories'] });
      toast.success('Equipment category updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

// =============================================
// CONTACT TYPES (Event Contacts)
// =============================================

export interface ContactTypeLookup extends LookupItem {
  value: string;
}

function slugifyContactType(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || `type_${Date.now()}`;
}

export function useAllContactTypes() {
  return useQuery({
    queryKey: ['contact-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_types_lookup')
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data as ContactTypeLookup[];
    },
  });
}

export function useActiveContactTypes() {
  return useQuery({
    queryKey: ['contact-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_types_lookup')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data as ContactTypeLookup[];
    },
  });
}

export function useCreateContactType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('contact_types_lookup')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxData?.sort_order || 0) + 1;

      let value = slugifyContactType(name);
      // Ensure uniqueness
      const { data: existing } = await supabase
        .from('contact_types_lookup')
        .select('value')
        .like('value', `${value}%`);
      if (existing && existing.some((r) => r.value === value)) {
        value = `${value}_${Date.now().toString(36)}`;
      }

      const { data, error } = await supabase
        .from('contact_types_lookup')
        .insert({ name, value, sort_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Contact type created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateContactType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContactTypeLookup> & { id: string }) => {
      const { data, error } = await supabase
        .from('contact_types_lookup')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Contact type updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}

// =============================================
// LOCATIONS
// =============================================

export interface Location extends LookupItem {}

export function useAllLocations() {
  return useQuery({
    queryKey: ['locations', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as Location[];
    },
  });
}

export function useActiveLocations() {
  return useQuery({
    queryKey: ['locations', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as Location[];
    },
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('locations')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('locations')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Location> & { id: string }) => {
      const { data, error } = await supabase
        .from('locations')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}