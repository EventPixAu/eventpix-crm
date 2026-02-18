import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, Play, Truck, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpsStatusBadgeProps {
  status: 'awaiting_details' | 'confirmed' | 'ready' | 'in_progress' | 'delivered' | 'completed' | 'archived' | null;
  className?: string;
}

export function OpsStatusBadge({ status, className }: OpsStatusBadgeProps) {
  const config = {
    awaiting_details: {
      label: 'Awaiting Details',
      icon: Clock,
      className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    confirmed: {
      label: 'Confirmed',
      icon: CheckCircle,
      className: 'border-teal-500/50 bg-teal-500/10 text-teal-700 dark:text-teal-400',
    },
    ready: {
      label: 'Ready',
      icon: CheckCircle,
      className: 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400',
    },
    in_progress: {
      label: 'In Progress',
      icon: Play,
      className: 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400',
    },
    delivered: {
      label: 'Delivered',
      icon: Truck,
      className: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
    },
    completed: {
      label: 'Completed',
      icon: Archive,
      className: 'border-muted-foreground/50 bg-muted text-muted-foreground',
    },
    archived: {
      label: 'Archived',
      icon: Archive,
      className: 'border-gray-500/50 bg-gray-500/10 text-gray-500 dark:text-gray-400',
    },
  };

  const currentStatus = status || 'awaiting_details';
  const { label, icon: Icon, className: statusClassName } = config[currentStatus];

  return (
    <Badge variant="outline" className={cn('gap-1', statusClassName, className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
