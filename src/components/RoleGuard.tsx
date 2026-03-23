/**
 * ROLE-BASED ROUTE GUARD COMPONENT
 * 
 * Protects routes based on user roles.
 * If user doesn't have required role, redirects to appropriate page.
 * 
 * Security: DB-level RLS is the source of truth.
 * This is a UX enhancement to prevent users from seeing pages they can't access.
 */
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

type AppRole = 'admin' | 'sales' | 'operations' | 'crew';

interface RoleGuardProps {
  children: ReactNode;
  /** Roles allowed to access this route */
  allowedRoles: AppRole[];
  /** Fallback route if access denied (default: /) */
  fallback?: string;
}

/**
 * Wraps protected routes to enforce role-based access.
 * 
 * Usage:
 * <RoleGuard allowedRoles={['admin', 'sales']}>
 *   <SalesPage />
 * </RoleGuard>
 */
export function RoleGuard({ children, allowedRoles, fallback = '/' }: RoleGuardProps) {
  const { role, loading } = useAuth();
  
  // Still loading auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  // No role assigned - redirect to fallback
  if (!role) {
    return <Navigate to={fallback} replace />;
  }
  
  // Check if user's role is in allowed roles
  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallback} replace />;
  }
  
  return <>{children}</>;
}

/**
 * Pre-configured guards for common access patterns
 */

/** Admin-only routes */
export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin']}>
      {children}
    </RoleGuard>
  );
}

/** Admin + Sales + Operations routes */
export function SalesGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin', 'sales', 'operations']}>
      {children}
    </RoleGuard>
  );
}

/** Operations routes (Admin + Operations + Sales) */
export function OpsGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin', 'operations', 'sales']}>
      {children}
    </RoleGuard>
  );
}

/** Crew routes (Admin + Operations + Crew for assigned events) */
export function CrewGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin', 'operations', 'crew']}>
      {children}
    </RoleGuard>
  );
}
