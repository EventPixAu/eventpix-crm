import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Bell, Check, CheckCheck, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from '@/hooks/useInAppNotifications';
import { cn } from '@/lib/utils';

const severityConfig = {
  info: {
    icon: Info,
    className: 'text-blue-500',
    bgClassName: 'bg-blue-500/10',
  },
  warning: {
    icon: AlertTriangle,
    className: 'text-amber-500',
    bgClassName: 'bg-amber-500/10',
  },
  critical: {
    icon: AlertCircle,
    className: 'text-destructive',
    bgClassName: 'bg-destructive/10',
  },
};

function NotificationItem({ notification, onMarkRead }: { notification: Notification; onMarkRead: (id: string) => void }) {
  const config = severityConfig[notification.severity];
  const Icon = config.icon;
  
  const getEntityLink = () => {
    if (!notification.entity_type || !notification.entity_id) return null;
    
    switch (notification.entity_type) {
      case 'event':
        return `/events/${notification.entity_id}`;
      case 'lead':
        return `/sales/leads/${notification.entity_id}`;
      default:
        return null;
    }
  };
  
  const entityLink = getEntityLink();
  
  return (
    <div
      className={cn(
        'p-3 border-b border-border last:border-0 transition-colors',
        !notification.is_read && 'bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-full shrink-0', config.bgClassName)}>
          <Icon className={cn('h-4 w-4', config.className)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-sm font-medium',
              notification.is_read && 'text-muted-foreground'
            )}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
            </span>
            {entityLink && (
              <Link
                to={entityLink}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  
  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };
  
  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs font-bold flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
              />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
