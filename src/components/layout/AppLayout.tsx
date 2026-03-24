/**
 * EVENTPIXII PLATFORM - Main Layout
 * 
 * FOUR SECTION NAVIGATION + CROSS-FUNCTIONAL:
 * - CRM: Promotions, Companies, Contacts, Emails
 * - Sales: Leads, Pipeline, Quotes, Contracts, Products
 * - Operations: Events, Calendar, Staff, Equipment, Delivery
 * - Administration: Admin-only system configuration
 * - Knowledge Base: Cross-functional, available to all roles
 * 
 * ROLE SEPARATION:
 * - Admin: Full access to all sections including Administration
 * - Operations: CRM, Sales, Operations (no Administration)
 * - Sales: CRM + Sales sections only (no Operations or Administration)
 * - Crew: Simplified job-focused navigation
 */
import { ReactNode, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ClipboardList,
  FileCheck,
  Home,
  LogOut,
  Mail,
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
  Briefcase,
  Target,
  Building2,
  DollarSign,
  ShoppingBag,
  Kanban,
  FileSignature,
  TrendingUp,
  Layers,
  UserCircle,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import eventpixLogo from '@/assets/eventpix-logo.png';
import { NotificationBell } from '@/components/NotificationBell';
import { SidebarNavGroup, SidebarNavItem, NavItem } from './SidebarNavGroup';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

// ===== CRM SECTION =====
const crmItems: NavItem[] = [
  { href: '/crm/promotions', label: 'Dashboard', icon: Home },
  { href: '/crm/companies', label: 'Companies', icon: Building2 },
  { href: '/crm/contacts', label: 'Contacts', icon: User },
  { href: '/crm/emails', label: 'Emails', icon: Mail },
  { href: '/crm/lookups', label: 'Lookups', icon: Settings },
];

// ===== KNOWLEDGE BASE (Cross-functional) =====
const knowledgeBaseItem: NavItem = { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen };

// ===== SALES SECTION (Admin sees this, cleaned of templates) =====
const salesItems: NavItem[] = [
  { href: '/sales/dashboard', label: 'Dashboard', icon: Home },
  { href: '/sales/leads', label: 'Leads', icon: Target },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/sales/quotes', label: 'Budgets', icon: DollarSign },
  { href: '/sales/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/sales/products', label: 'Products', icon: ShoppingBag },
];

// ===== OPERATIONS SECTION (Cleaned of admin settings) =====
const operationsItems: NavItem[] = [
  { href: '/operations', label: 'Dashboard', icon: Home },
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/day-load', label: 'Day Load', icon: CalendarCheck },
  { href: '/admin/series', label: 'Event Series', icon: FileCheck },
  { href: '/staff', label: 'Team', icon: Users },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
];

// ===== ADMINISTRATION SECTION (Admin-only) =====
const administrationItems: NavItem[] = [
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/insurance', label: 'Company Insurance', icon: Shield },
  { href: '/admin/role-visibility', label: 'Page Visibility', icon: Layers },
  { href: '/sales/templates', label: 'Budget Templates', icon: FileText },
  { href: '/admin/contract-templates', label: 'Contract Templates', icon: FileSignature },
  { href: '/admin/email-templates', label: 'Email Templates', icon: Mail },
  { href: '/admin/workflows', label: 'Workflows', icon: ClipboardList },
  { href: '/admin/lookups', label: 'Lookups', icon: Settings },
  { href: '/admin/pay-rates', label: 'Pay Rates', icon: DollarSign },
  { href: '/admin/invoices', label: 'Xero Sync', icon: DollarSign },
  { href: '/admin/margins', label: 'Margin Report', icon: TrendingUp },
];

// ===== CREW (Photographer) NAVIGATION =====
const crewNavItems: NavItem[] = [
  { href: '/', label: 'My Jobs', icon: Briefcase },
  { href: '/my-job-sheets', label: 'Job Sheets', icon: FileText },
  { href: '/my-calendar', label: 'My Calendar', icon: Calendar },
  { href: '/my-availability', label: 'My Availability', icon: CalendarCheck },
  { href: '/my-documents', label: 'My Documents', icon: FolderOpen },
  { href: '/knowledge-base', label: 'Help & Guides', icon: BookOpen },
  { href: '/staff/me', label: 'My Profile', icon: User },
];

// ===== SIDEBAR CONTENT BY ROLE =====

interface SidebarContentProps {
  onItemClick?: () => void;
  collapsed?: boolean;
}

function AdminSidebarContent({ onItemClick, collapsed }: SidebarContentProps) {
  return (
    <>
      {/* CRM Section */}
      <SidebarNavGroup 
        label="CRM" 
        icon={UserCircle} 
        items={crmItems}
        defaultOpen={true}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {/* Sales Section */}
      <SidebarNavGroup 
        label="Sales" 
        icon={TrendingUp} 
        items={salesItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {/* Operations Section */}
      <SidebarNavGroup 
        label="Operations" 
        icon={Briefcase} 
        items={operationsItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />

      {/* Administration Section - Admin Only */}
      <SidebarNavGroup 
        label="Administration" 
        icon={Shield} 
        items={administrationItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />

      {!collapsed && <div className="h-px bg-sidebar-border my-3" />}
      
      {/* Knowledge Base - Cross-functional */}
      <SidebarNavItem item={knowledgeBaseItem} onItemClick={onItemClick} collapsed={collapsed} />
    </>
  );
}

function OperationsSidebarContent({ onItemClick, collapsed }: SidebarContentProps) {
  // Operations users see CRM, Sales, and Operations - but NOT Administration
  return (
    <>
      {/* CRM Section */}
      <SidebarNavGroup 
        label="CRM" 
        icon={UserCircle} 
        items={crmItems}
        defaultOpen={true}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {/* Sales Section */}
      <SidebarNavGroup 
        label="Sales" 
        icon={TrendingUp} 
        items={salesItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {/* Operations Section */}
      <SidebarNavGroup 
        label="Operations" 
        icon={Briefcase} 
        items={operationsItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />

      {!collapsed && <div className="h-px bg-sidebar-border my-3" />}
      
      {/* Knowledge Base - Cross-functional */}
      <SidebarNavItem item={knowledgeBaseItem} onItemClick={onItemClick} collapsed={collapsed} />
    </>
  );
}

function SalesSidebarContent({ onItemClick, collapsed }: SidebarContentProps) {
  // Sales users see CRM and Sales only - no templates (moved to Admin)
  return (
    <>
      {/* CRM Section */}
      <SidebarNavGroup 
        label="CRM" 
        icon={UserCircle} 
        items={crmItems}
        defaultOpen={true}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {/* Sales Section */}
      <SidebarNavGroup 
        label="Sales" 
        icon={TrendingUp} 
        items={salesItems}
        defaultOpen={false}
        onItemClick={onItemClick}
        collapsed={collapsed}
      />
      
      {!collapsed && <div className="h-px bg-sidebar-border my-3" />}
      
      {/* Knowledge Base - Cross-functional */}
      <SidebarNavItem item={knowledgeBaseItem} onItemClick={onItemClick} collapsed={collapsed} />
      
      {/* Profile */}
      <SidebarNavItem item={{ href: '/staff/me', label: 'My Profile', icon: User }} onItemClick={onItemClick} collapsed={collapsed} />
    </>
  );
}

function CrewSidebarContent({ onItemClick, collapsed }: SidebarContentProps) {
  return (
    <>
      {crewNavItems.map(item => (
        <SidebarNavItem key={item.href} item={item} onItemClick={onItemClick} collapsed={collapsed} />
      ))}
    </>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'eventpixii-sidebar-collapsed';

export function AppLayout({ children }: AppLayoutProps): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return saved === 'true';
    }
    return false;
  });
  const { user, signOut, isAdmin, isSales, isOperations, isCrew, role } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleCollapsed = () => setSidebarCollapsed(prev => !prev);

  // Render appropriate sidebar content based on role
  const renderSidebarContent = (onItemClick?: () => void, collapsed?: boolean) => {
    if (isAdmin) return <AdminSidebarContent onItemClick={onItemClick} collapsed={collapsed} />;
    if (isOperations) return <OperationsSidebarContent onItemClick={onItemClick} collapsed={collapsed} />;
    if (isSales) return <SalesSidebarContent onItemClick={onItemClick} collapsed={collapsed} />;
    if (isCrew) return <CrewSidebarContent onItemClick={onItemClick} collapsed={collapsed} />;
    return <CrewSidebarContent onItemClick={onItemClick} collapsed={collapsed} />;
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const mainPadding = sidebarCollapsed ? 'md:pl-16' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header with Hamburger Menu - Always visible */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {/* Hamburger Button - Always visible on all screen sizes */}
            <button
              onClick={() => {
                // On mobile, open the overlay sidebar
                // On desktop/tablet, toggle collapsed state
                if (window.innerWidth < 768) {
                  setSidebarOpen(true);
                } else {
                  toggleCollapsed();
                }
              }}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src={eventpixLogo} alt="Eventpix" className="h-6" />
          </div>
          <NotificationBell />
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
              onClick={closeSidebar}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-[300px] bg-sidebar border-r border-sidebar-border md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <img src={eventpixLogo} alt="Eventpix" className="h-7" />
                <button
                  onClick={closeSidebar}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 overflow-y-auto">
                {renderSidebarContent(closeSidebar, false)}
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
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop/Tablet Sidebar - Collapsible via hamburger */}
      <aside 
        className={cn(
          "fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          "hidden md:flex",
          sidebarWidth
        )}
      >
        <nav className={cn(
          "flex-1 overflow-y-auto transition-all duration-300",
          sidebarCollapsed ? "p-2" : "p-4"
        )}>
          {renderSidebarContent(undefined, sidebarCollapsed)}
        </nav>

        <div className={cn(
          "border-t border-sidebar-border transition-all duration-300",
          sidebarCollapsed ? "p-2" : "p-4"
        )}>
          {sidebarCollapsed ? (
            <div className="space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10 mx-auto rounded-full bg-primary/20 flex items-center justify-center cursor-pointer">
                    <span className="text-sm font-medium text-primary">
                      {user?.email?.[0].toUpperCase()}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{role || 'No role'}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Collapse Toggle Button - Hidden since we now have global hamburger */}
      </aside>

      {/* Main Content */}
      <main
        ref={mainRef}
        className={cn(
          "pt-14 min-h-screen transition-all duration-300",
          mainPadding
        )}
      >
        <div className="p-3 sm:p-4 md:p-6 xl:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}