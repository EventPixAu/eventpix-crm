import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Mail,
  FileText,
  FileSignature,
  Receipt,
  Bell,
  Eye,
  MousePointer,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useEventEmailLogs,
  useLeadEmailLogs,
  useClientEmailLogs,
  useRecipientEmailLogs,
  EmailLog,
  getEmailStatusInfo,
} from '@/hooks/useEmailLogs';

interface MailHistoryPanelProps {
  eventId?: string;
  leadId?: string;
  clientId?: string;
  contactEmail?: string | null;
  maxItems?: number;
  showViewAll?: boolean;
}

function getEmailTypeIcon(type: string) {
  switch (type) {
    case 'quote':
      return FileText;
    case 'contract':
      return FileSignature;
    case 'invoice':
      return Receipt;
    case 'reminder':
      return Bell;
    case 'general':
    default:
      return Mail;
  }
}

function getStatusIcon(status: EmailLog['status']) {
  switch (status) {
    case 'opened':
      return Eye;
    case 'clicked':
      return MousePointer;
    case 'bounced':
    case 'failed':
      return AlertCircle;
    case 'sent':
    case 'delivered':
      return CheckCircle;
    case 'pending':
    default:
      return Clock;
  }
}

function EmailLogItem({ log }: { log: EmailLog }) {
  const TypeIcon = getEmailTypeIcon(log.email_type);
  const StatusIcon = getStatusIcon(log.status);
  const statusInfo = getEmailStatusInfo(log.status);
  const isInbound = log.direction === 'inbound';
  const DirectionIcon = isInbound ? ArrowDownLeft : ArrowUpRight;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors",
        isInbound && "bg-primary/5"
      )}
    >
      {/* Type Icon with Direction Indicator */}
      <div className={cn(
        "p-2 rounded-lg shrink-0 relative",
        isInbound ? "bg-primary/20" : "bg-primary/10"
      )}>
        <TypeIcon className="h-4 w-4 text-primary" />
        <DirectionIcon className={cn(
          "h-3 w-3 absolute -bottom-1 -right-1 rounded-full p-0.5",
          isInbound ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isInbound && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                  Reply
                </Badge>
              )}
              <p className="text-sm font-medium truncate">{log.subject}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {isInbound 
                ? `From: ${log.from_name ? `${log.from_name} <${log.from_email}>` : log.from_email}`
                : `To: ${log.recipient_name ? `${log.recipient_name} <${log.recipient_email}>` : log.recipient_email}`
              }
            </p>
          </div>
          
          {/* Status Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={cn('shrink-0', statusInfo.bgColor, statusInfo.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  {log.sent_at && (
                    <p>Sent: {format(parseISO(log.sent_at), 'MMM d, h:mm a')}</p>
                  )}
                  {log.opened_at && (
                    <p>Opened: {format(parseISO(log.opened_at), 'MMM d, h:mm a')} ({log.open_count}x)</p>
                  )}
                  {log.clicked_at && (
                    <p>Clicked: {format(parseISO(log.clicked_at), 'MMM d, h:mm a')} ({log.click_count}x)</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Preview */}
        {log.body_preview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {log.body_preview}
          </p>
        )}
        
        {/* Meta */}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {log.sent_at && (
            <span>{format(parseISO(log.sent_at), 'MMM d, yyyy h:mm a')}</span>
          )}
          {log.sent_by_profile && (
            <>
              <span>•</span>
              <span>by {log.sent_by_profile.full_name || log.sent_by_profile.email}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MailHistoryPanel({
  eventId,
  leadId,
  clientId,
  contactEmail,
  maxItems = 10,
  showViewAll = false,
}: MailHistoryPanelProps) {
  // Use the appropriate hook based on context
  const { data: eventLogs = [] } = useEventEmailLogs(eventId);
  const { data: leadLogs = [] } = useLeadEmailLogs(leadId);
  const { data: clientLogs = [] } = useClientEmailLogs(clientId);
  const { data: recipientLogs = [] } = useRecipientEmailLogs(contactEmail);
  
  // Combine and dedupe logs if multiple contexts provided
  const allLogs = [...eventLogs, ...leadLogs, ...clientLogs, ...recipientLogs];
  const uniqueLogs = allLogs.filter((log, index, self) => 
    index === self.findIndex(l => l.id === log.id)
  ).sort((a, b) => {
    const aDate = a.sent_at ? new Date(a.sent_at).getTime() : 0;
    const bDate = b.sent_at ? new Date(b.sent_at).getTime() : 0;
    return bDate - aDate;
  });
  
  const displayLogs = maxItems ? uniqueLogs.slice(0, maxItems) : uniqueLogs;
  const hasMore = uniqueLogs.length > displayLogs.length;
  
  if (displayLogs.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-display font-semibold">Mail History</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No emails sent yet
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-display font-semibold">Mail History</h3>
          <Badge variant="secondary" className="text-xs">
            {uniqueLogs.length}
          </Badge>
        </div>
        {showViewAll && hasMore && (
          <button className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      
      <div className="space-y-1 -mx-3">
        {displayLogs.map((log) => (
          <EmailLogItem key={log.id} log={log} />
        ))}
      </div>
      
      {hasMore && !showViewAll && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          + {uniqueLogs.length - displayLogs.length} more emails
        </p>
      )}
    </div>
  );
}
