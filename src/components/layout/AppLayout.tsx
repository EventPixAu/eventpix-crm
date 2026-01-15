/**
 * OPERATIONS PLATFORM - Main Layout
 * 
 * SYSTEM BOUNDARIES:
 * - This is an OPERATIONS-ONLY platform
 * - NO CRM features (Sales CRM is external - Studio Ninja)
 * - NO accounting logic (Accounting is external - Xero)
 * - NO client communications or quoting
 * 
 * ROLE SEPARATION:
 * - Admin: Full operations access (staffing, equipment, compliance, delivery, executive)
 * - Photographer: Job-focused access only (my jobs, availability, equipment, KB)
 * 
 * Photographers should feel like: "This is my work app, not the company system."
 */
import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ClipboardList,
  FileCheck,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  User,
  Users,
  X,
  FileText,
  BookOpen,
  CalendarCheck,
  Wrench,
  FolderOpen,
  BarChart3,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import eventpixLogo from '@/assets/eventpix-logo.png';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * ADMIN NAVIGATION - Operations Scope Only
 * 
 * Grouped by function:
 * - Operations: Events, Job Intake, Series, Calendar, Delivery
 * - Staffing: Staff, Workflows
 * - Equipment: Equipment management
 * - Admin: Event Types, Executive Dashboard
 * 
 * EXCLUDED (handled by external systems):
 * - Leads, Quotes, Clients (Sales CRM - Studio Ninja)
 * - Invoicing, Payments (Accounting - Xero)
 */
const adminNavItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/admin/executive', label: 'Executive', icon: BarChart3 },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/job-intake', label: 'Job Intake', icon: FileText },
  { href: '/admin/series', label: 'Series', icon: FileCheck },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
  { href: '/admin/workflows', label: 'Workflows', icon: ClipboardList },
  { href: '/admin/event-types', label: 'Event Types', icon: Settings },
  { href: '/delivery', label: 'Delivery', icon: Package },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
];

/**
 * PHOTOGRAPHER NAVIGATION - Personal Work Scope Only
 * 
 * Photographers can ONLY access:
 * - My Jobs (their assigned events/job sheets)
 * - My Calendar (their schedule)
 * - My Availability (set availability)
 * - My Documents (compliance uploads)
 * - Help & Guides (knowledge base)
 * - My Profile (personal settings)
 * 
 * Photographers CANNOT see:
 * - All events list
 * - Other staff details
 * - Rates, costs, invoices
 * - Executive dashboards
 * - Series management
 * - Equipment admin
 * - Job intake queue
 */
const photographerNavItems = [
  { href: '/', label: 'My Jobs', icon: Briefcase },
  { href: '/my-job-sheets', label: 'Job Sheets', icon: FileText },
  { href: '/my-calendar', label: 'My Calendar', icon: Calendar },
  { href: '/my-availability', label: 'My Availability', icon: CalendarCheck },
  { href: '/my-documents', label: 'My Documents', icon: FolderOpen },
  { href: '/knowledge-base', label: 'Help & Guides', icon: BookOpen },
  { href: '/staff/me', label: 'My Profile', icon: User },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, isAdmin, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = isAdmin ? adminNavItems : photographerNavItems;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={eventpixLogo} alt="Eventpix" className="h-6" />
          </div>
          <div className="w-9" />
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-[280px] bg-sidebar border-r border-sidebar-border lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <img src={eventpixLogo} alt="Eventpix" className="h-7" />
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:flex lg:h-screen lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2 p-6 border-b border-sidebar-border">
          <img src={eventpixLogo} alt="Eventpix" className="h-8" />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{role || 'No role'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
