import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export const SUPABASE_URL = "https://kweiptzbmsbifplynnpb.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAiOiJrd2VpcHR6Ym1zYmlmcGx5bm5wYiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY4NDI1ODQ2LCJleHAiOjIwODQwMDE4NDZ9.INVALID";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
