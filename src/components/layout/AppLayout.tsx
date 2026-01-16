/**
 * EVENTPIX PLATFORM - Main Layout
 * 
 * UNIFIED SYSTEM supporting:
 * - Sales: Clients, Leads, Quotes (replaces Studio Ninja CRM)
 * - Operations: Events, Staffing, Equipment, Delivery (replaces ClickUp)
 * - Xero integration for accounting (external)
 * 
 * ROLE SEPARATION:
 * - Admin: Full access to all modules (grouped navigation)
 * - Sales: Clients, Leads, Quotes, Pipeline
 * - Executive: Dashboard only
 * - Photographer: Job-focused access only
 */
import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Target,
  Building2,
  DollarSign,
  ShoppingBag,
  Kanban,
  FileSignature,
  ListChecks,
  TrendingUp,
  Layers,
  Cog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import eventpixLogo from '@/assets/eventpix-logo.png';
import { NotificationBell } from '@/components/NotificationBell';
import { SidebarNavGroup, SidebarNavItem, NavItem } from './SidebarNavGroup';

interface AppLayoutProps {
  children: ReactNode;
}

// ===== ADMIN NAVIGATION STRUCTURE =====

const adminDashboardItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/executive/dashboard', label: 'Executive', icon: BarChart3 },
];

const salesItems: NavItem[] = [
  { href: '/sales/clients', label: 'Clients', icon: Building2 },
  { href: '/sales/leads', label: 'Leads', icon: Target },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/sales/quotes', label: 'Quotes', icon: DollarSign },
  { href: '/sales/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/admin/invoices', label: 'Invoices', icon: DollarSign },
  { href: '/admin/margins', label: 'Margins', icon: TrendingUp },
];

const salesSetupItems: NavItem[] = [
  { href: '/sales/products', label: 'Products', icon: ShoppingBag },
  { href: '/sales/templates', label: 'Quote Templates', icon: FileText },
  { href: '/admin/contract-templates', label: 'Contract Templates', icon: FileSignature },
  { href: '/sales/workflow-templates', label: 'Workflow Templates', icon: ListChecks },
];

const operationsItems: NavItem[] = [
  { href: '/events', label: 'Events', icon: Calendar },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/day-load', label: 'Day Load', icon: CalendarCheck },
  { href: '/admin/series', label: 'Series', icon: FileCheck },
  { href: '/staff', label: 'Staff', icon: Users },
  { href: '/equipment', label: 'Equipment', icon: Wrench },
  { href: '/delivery', label: 'Delivery', icon: Package },
];

const operationsSetupItems: NavItem[] = [
  { href: '/admin/event-types', label: 'Event Types', icon: Layers },
  { href: '/admin/lookups', label: 'Lookups', icon: Settings },
  { href: '/admin/workflows', label: 'Workflows', icon: ClipboardList },
];

const knowledgeItem: NavItem = { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen };

// ===== EXECUTIVE NAVIGATION =====
const executiveNavItems: NavItem[] = [
  { href: '/executive/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/staff/me', label: 'My Profile', icon: User },
];

// ===== SALES NAVIGATION =====
const salesUserItems: NavItem[] = [
  { href: '/sales/clients', label: 'Clients', icon: Building2 },
  { href: '/sales/leads', label: 'Leads', icon: Target },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/sales/quotes', label: 'Quotes', icon: DollarSign },
  { href: '/sales/contracts', label: 'Contracts', icon: FileSignature },
];

const salesUserSetupItems: NavItem[] = [
  { href: '/sales/products', label: 'Products', icon: ShoppingBag },
  { href: '/sales/templates', label: 'Templates', icon: FileText },
];

// ===== PHOTOGRAPHER NAVIGATION =====
const photographerNavItems: NavItem[] = [
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
}

function AdminSidebarContent({ onItemClick }: SidebarContentProps) {
  return (
    <>
      {/* Dashboard Section */}
      <div className="mb-2">
        {adminDashboardItems.map(item => (
          <SidebarNavItem key={item.href} item={item} onItemClick={onItemClick} />
        ))}
      </div>
      
      <div className="h-px bg-sidebar-border my-3" />
      
      {/* Sales Group */}
      <SidebarNavGroup 
        label="Sales" 
        icon={TrendingUp} 
        items={salesItems}
        defaultOpen={false}
        onItemClick={onItemClick}
      />
      
      {/* Sales Setup Group */}
      <SidebarNavGroup 
        label="Sales Setup" 
        icon={Cog} 
        items={salesSetupItems}
        defaultOpen={false}
        onItemClick={onItemClick}
      />
      
      <div className="h-px bg-sidebar-border my-3" />
      
      {/* Operations Group */}
      <SidebarNavGroup 
        label="Operations" 
        icon={Briefcase} 
        items={operationsItems}
        defaultOpen={true}
        onItemClick={onItemClick}
      />
      
      {/* Operations Setup Group */}
      <SidebarNavGroup 
        label="Ops Setup" 
        icon={Settings} 
        items={operationsSetupItems}
        defaultOpen={false}
        onItemClick={onItemClick}
      />
      
      <div className="h-px bg-sidebar-border my-3" />
      
      {/* Knowledge Base */}
      <SidebarNavItem item={knowledgeItem} onItemClick={onItemClick} />
    </>
  );
}

function SalesSidebarContent({ onItemClick }: SidebarContentProps) {
  return (
    <>
      {/* Dashboard */}
      <SidebarNavItem item={{ href: '/', label: 'Dashboard', icon: Home }} onItemClick={onItemClick} />
      
      <div className="h-px bg-sidebar-border my-3" />
      
      {/* Sales Group - Default expanded for Sales users */}
      <SidebarNavGroup 
        label="Sales" 
        icon={TrendingUp} 
        items={salesUserItems}
        defaultOpen={true}
        onItemClick={onItemClick}
      />
      
      {/* Sales Setup Group */}
      <SidebarNavGroup 
        label="Sales Setup" 
        icon={Cog} 
        items={salesUserSetupItems}
        defaultOpen={false}
        onItemClick={onItemClick}
      />
      
      <div className="h-px bg-sidebar-border my-3" />
      
      {/* Knowledge Base & Profile */}
      <SidebarNavItem item={knowledgeItem} onItemClick={onItemClick} />
      <SidebarNavItem item={{ href: '/staff/me', label: 'My Profile', icon: User }} onItemClick={onItemClick} />
    </>
  );
}

function ExecutiveSidebarContent({ onItemClick }: SidebarContentProps) {
  return (
    <>
      {executiveNavItems.map(item => (
        <SidebarNavItem key={item.href} item={item} onItemClick={onItemClick} />
      ))}
    </>
  );
}

function PhotographerSidebarContent({ onItemClick }: SidebarContentProps) {
  return (
    <>
      {photographerNavItems.map(item => (
        <SidebarNavItem key={item.href} item={item} onItemClick={onItemClick} />
      ))}
    </>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, isAdmin, isSales, isExecutive, role } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const closeSidebar = () => setSidebarOpen(false);

  // Render appropriate sidebar content based on role
  const renderSidebarContent = (onItemClick?: () => void) => {
    if (isAdmin) return <AdminSidebarContent onItemClick={onItemClick} />;
    if (isExecutive) return <ExecutiveSidebarContent onItemClick={onItemClick} />;
    if (isSales) return <SalesSidebarContent onItemClick={onItemClick} />;
    return <PhotographerSidebarContent onItemClick={onItemClick} />;
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
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-[280px] bg-sidebar border-r border-sidebar-border lg:hidden flex flex-col"
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
                {renderSidebarContent(closeSidebar)}
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

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:flex lg:h-screen lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
          <img src={eventpixLogo} alt="Eventpix" className="h-8" />
          <NotificationBell />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          {renderSidebarContent()}
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
