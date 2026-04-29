/**
 * CLIENT JOBS LIST
 * 
 * Studio Ninja-style jobs list showing:
 * - Job name with status indicator
 * - Type, Main Shoot date, Next Task, Lead Source
 * - Actions: View, Edit, Send Email, Delete
 */
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  Briefcase, 
  Eye, 
  Pencil, 
  Send, 
  Trash2,
  Plus,
  Circle,
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClientEvents } from '@/hooks/useSales';
import { useDeleteEvent } from '@/hooks/useEvents';
import { toast } from 'sonner';

interface JobWithType {
  id: string;
  event_name: string;
  ops_status?: string | null;
  event_date: string;
  main_shoot_date?: string | null;
  enquiry_source?: string | null;
  event_type?: { id: string; name: string } | null;
}

interface JobItemProps {
  job: JobWithType;
  onSendEmail?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function JobItem({ job, onSendEmail, onDelete, isDeleting = false }: JobItemProps) {
  // Status color based on ops_status
  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'confirmed': return 'text-green-500';
      case 'in_progress': return 'text-blue-500';
      case 'completed': return 'text-emerald-500';
      case 'delivered': return 'text-purple-500';
      case 'cancelled': return 'text-red-500';
      default: return 'text-orange-500';
    }
  };

  const shootDate = job.main_shoot_date || job.event_date;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Job Name with Status */}
      <div className="flex items-center gap-2">
        <Circle className={`h-3 w-3 fill-current ${getStatusColor(job.ops_status)}`} />
        <span className="font-medium">{job.event_name}</span>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Type</span>
        <span>{job.event_type?.name || '-'}</span>
        
        <span className="text-muted-foreground">Main Shoot</span>
        <span className="text-primary underline">
          {shootDate ? format(parseISO(shootDate), 'EEE, d MMM yyyy') : '-'}
        </span>
        
        <span className="text-muted-foreground">Lead Source</span>
        <span>{job.enquiry_source || '-'}</span>
      </div>
      
      {/* Actions - No Archive for jobs */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/events/${job.id}`}>
            <Eye className="h-4 w-4 mr-1.5" />
            View
          </Link>
        </Button>
        
        <Button variant="outline" size="sm" asChild>
          <Link to={`/events/${job.id}/edit`}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Link>
        </Button>
        
        <Button variant="outline" size="sm" onClick={onSendEmail}>
          <Send className="h-4 w-4 mr-1.5" />
          Send email
        </Button>
        
        <Button variant="outline" size="sm" onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}

interface ClientJobsListProps {
  clientId: string;
  onAddJob?: () => void;
  onSendEmail?: (eventId: string) => void;
}

export function ClientJobsList({ clientId, onAddJob, onSendEmail }: ClientJobsListProps) {
  const { data: events = [], isLoading } = useClientEvents(clientId);
  const deleteEvent = useDeleteEvent();
  
  const handleDelete = async (eventId: string) => {
    if (deleteEvent.isPending) return;
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
      await deleteEvent.mutateAsync(eventId);
      toast.success('Job deleted');
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Jobs</CardTitle>
          </div>
          <Button 
            size="icon" 
            className="h-7 w-7 rounded-full bg-primary"
            onClick={onAddJob}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading jobs...
          </div>
        ) : events.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No jobs yet
          </div>
        ) : (
          events.map((event) => (
            <JobItem 
              key={event.id} 
              job={event as JobWithType}
              onSendEmail={() => onSendEmail?.(event.id)}
              onDelete={() => handleDelete(event.id)}
              isDeleting={deleteEvent.isPending}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
