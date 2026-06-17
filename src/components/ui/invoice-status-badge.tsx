import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, CheckCircle, Gift, Wallet, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceStatusBadgeProps {
  status: 'not_invoiced' | 'invoiced_deposit' | 'deposit_paid' | 'invoiced_full' | 'paid_in_full' | 'sponsored' | null;
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
    invoiced_deposit: {
      label: 'Invoiced - Deposit',
      icon: FileText,
      variant: 'secondary' as const,
      className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    },
    deposit_paid: {
      label: 'Deposit Paid',
      icon: Wallet,
      variant: 'secondary' as const,
      className: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
    },
    invoiced_full: {
      label: 'Invoiced - Full',
      icon: FileText,
      variant: 'secondary' as const,
      className: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400',
    },
    paid_in_full: {
      label: 'Paid in Full',
      icon: CheckCircle,
      variant: 'secondary' as const,
      className: 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
    },
    sponsored: {
      label: 'Sponsored',
      icon: Gift,
      variant: 'secondary' as const,
      className: 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400',
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