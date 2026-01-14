import { cn } from '@/lib/utils';

type StatusType = 'pending' | 'in_progress' | 'completed' | 'active' | 'inactive' | 'upcoming' | 'today' | 'past';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-info/10 text-info',
  },
  completed: {
    label: 'Completed',
    className: 'bg-success/10 text-success',
  },
  active: {
    label: 'Active',
    className: 'bg-success/10 text-success',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-muted text-muted-foreground',
  },
  upcoming: {
    label: 'Upcoming',
    className: 'bg-info/10 text-info',
  },
  today: {
    label: 'Today',
    className: 'bg-primary/10 text-primary',
  },
  past: {
    label: 'Past',
    className: 'bg-muted text-muted-foreground',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
