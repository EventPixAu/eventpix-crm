import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const SUPABASE_URL = "https://kweiptzbmsbifplynnpb.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWlwdHpibXNiaWZwbHlubnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjU4NDYsImV4cCI6MjA4NDAwMTg0Nn0.FgMM4mifqHZAiNbEObCXUSJjHnlvoxrMvrc0tvz-DDE";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
