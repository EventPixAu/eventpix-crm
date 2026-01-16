import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, ChevronRight, Users, Calendar, Truck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscalations, type EscalationItem } from '@/hooks/useEscalations';
import { cn } from '@/lib/utils';

const typeIcons = {
  staffing: Users,
  readiness: Calendar,
  delivery: Truck,
  conflict: Clock,
};

function EscalationBanner({ item }: { item: EscalationItem }) {
  const Icon = typeIcons[item.type] || AlertTriangle;
  const SeverityIcon = item.severity === 'critical' ? AlertCircle : AlertTriangle;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Link
        to={item.filterUrl}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors',
          item.severity === 'critical'
            ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20'
            : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
        )}
      >
        <div className={cn(
          'p-1.5 rounded-full shrink-0',
          item.severity === 'critical' ? 'bg-destructive/20' : 'bg-amber-500/20'
        )}>
          <SeverityIcon className={cn(
            'h-4 w-4',
            item.severity === 'critical' ? 'text-destructive' : 'text-amber-600'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn(
              'text-sm font-medium',
              item.severity === 'critical' ? 'text-destructive' : 'text-amber-700'
            )}>
              {item.title}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </motion.div>
  );
}

export function EscalationBanners({ maxItems = 3 }: { maxItems?: number }) {
  const { data: escalations = [], isLoading } = useEscalations();
  
  if (isLoading || escalations.length === 0) return null;
  
  const displayedItems = escalations.slice(0, maxItems);
  const remainingCount = escalations.length - maxItems;
  
  return (
    <div className="space-y-2 mb-6">
      <AnimatePresence>
        {displayedItems.map((item, index) => (
          <EscalationBanner key={`${item.type}-${index}`} item={item} />
        ))}
      </AnimatePresence>
      
      {remainingCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          +{remainingCount} more escalation{remainingCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

// Compact version for Day Load View header
export function EscalationBannersCompact() {
  const { data: escalations = [] } = useEscalations();
  
  const criticalCount = escalations.filter(e => e.severity === 'critical').length;
  const warningCount = escalations.filter(e => e.severity === 'warning').length;
  
  if (criticalCount === 0 && warningCount === 0) return null;
  
  return (
    <div className="flex items-center gap-3">
      {criticalCount > 0 && (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{criticalCount} critical</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">{warningCount} warning{warningCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
