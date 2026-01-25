import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'sales' | 'operations' | 'crew';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSales: boolean;
  isOperations: boolean;
  isCrew: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  const loading = useMemo(() => authLoading || roleLoading, [authLoading, roleLoading]);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      }),
    ]);
  };

  const resolveRoleFromRows = (rows: Array<{ role: string }> | null | undefined): AppRole | null => {
    const roles = new Set((rows ?? []).map(r => r.role));
    if (roles.has('admin')) return 'admin';
    if (roles.has('operations')) return 'operations';
    if (roles.has('sales')) return 'sales';
    if (roles.has('crew')) return 'crew';
    return null;
  };

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    try {
      // NOTE: A user can technically have multiple roles; we pick the highest priority.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching role:', error);
        return null;
      }

      return resolveRoleFromRows(data as Array<{ role: string }> | null);
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    setAuthLoading(true);

    // IMPORTANT: subscribe first, then fetch initial session (prevents missed events).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      })
      .catch((error) => {
        console.error('Error initializing auth:', error);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // No user => no role.
    if (!user?.id) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);

    void (async () => {
      try {
        const nextRole = await withTimeout(fetchUserRole(user.id), 8000);
        if (!cancelled) setRole(nextRole);
      } catch (error) {
        // If role fetch fails, we still need to stop loading to avoid infinite spinners.
        console.error('Error resolving role:', error);
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin: role === 'admin',
        isSales: role === 'sales',
        isOperations: role === 'operations',
        isCrew: role === 'crew',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
