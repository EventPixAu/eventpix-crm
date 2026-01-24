import { useState, forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarNavGroupProps {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
  onItemClick?: () => void;
  collapsed?: boolean;
}

export const SidebarNavGroup = forwardRef<HTMLDivElement, SidebarNavGroupProps>(
  function SidebarNavGroup({ label, icon: Icon, items, defaultOpen = false, onItemClick, collapsed = false }, ref) {
    const location = useLocation();
    const hasActiveChild = items.some(item => location.pathname === item.href);
    const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveChild);

    // Collapsed mode: show icons only with tooltips
    if (collapsed) {
      return (
        <div ref={ref} className="mb-1 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.href}
                    onClick={onItemClick}
                    className={cn(
                      'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      );
    }

    return (
      <div ref={ref} className="mb-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            hasActiveChild
              ? 'bg-sidebar-accent/50 text-sidebar-primary'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            {label}
          </div>
          <ChevronDown 
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )} 
          />
        </button>
        
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

interface SidebarNavItemProps {
  item: NavItem;
  onItemClick?: () => void;
  collapsed?: boolean;
}

export const SidebarNavItem = forwardRef<HTMLAnchorElement, SidebarNavItemProps>(
  function SidebarNavItem({ item, onItemClick, collapsed = false }, ref) {
    const location = useLocation();
    const isActive = location.pathname === item.href;

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              ref={ref}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors mb-1',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <Link
        ref={ref}
        to={item.href}
        onClick={onItemClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1',
          isActive
            ? 'bg-sidebar-accent text-sidebar-primary'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  }
);
