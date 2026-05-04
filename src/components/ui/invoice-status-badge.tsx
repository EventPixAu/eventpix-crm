import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceStatusBadgeProps {
  status: 'not_invoiced' | 'invoiced' | 'paid' | null;
  reference?: string | null;
  className?: string;
}

export function InvoiceStatusBadge({ status, reference, className }: InvoiceStatusBadgeProps) {
  const config = {
    not_invoiced: {
      label: 'Not Invoiced',
      icon: Clock,
      variant: 'outline' as const,
      className: 'border-muted-foreground/50 text-muted-foreground',
    },
    invoiced: {
      label: 'Invoiced',
      icon: DollarSign,
      variant: 'secondary' as const,
      className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    paid: {
      label: 'Paid',
      icon: CheckCircle,
      variant: 'secondary' as const,
      className: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
    },
  };

  const currentStatus = status || 'not_invoiced';
  const { label, icon: Icon, className: statusClassName } = config[currentStatus];

  return (
    <Badge variant="outline" className={cn('gap-1', statusClassName, className)}>
      <Icon className="h-3 w-3" />
      {label}
      {reference && <span className="ml-1 opacity-70">({reference})</span>}
    </Badge>
  );
}
