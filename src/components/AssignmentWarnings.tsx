import { AlertTriangle, XCircle, Clock, CalendarX, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { AssignmentWarning } from '@/hooks/useStaffAvailability';

interface AssignmentWarningsProps {
  warnings: AssignmentWarning[];
  className?: string;
}

export function AssignmentWarnings({ warnings, className }: AssignmentWarningsProps) {
  if (warnings.length === 0) return null;
  
  const errors = warnings.filter(w => w.severity === 'error');
  const warningsOnly = warnings.filter(w => w.severity === 'warning');
  
  const getIcon = (type: AssignmentWarning['type']) => {
    switch (type) {
      case 'unavailable':
        return <CalendarX className="h-4 w-4" />;
      case 'time_conflict':
        return <XCircle className="h-4 w-4" />;
      case 'tight_changeover':
        return <Clock className="h-4 w-4" />;
      case 'limited_assigned':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };
  
  return (
    <div className={cn('space-y-2', className)}>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Assignment Conflicts</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {errors.map((warning, i) => (
                <li key={i} className="flex items-start gap-2">
                  {getIcon(warning.type)}
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {warningsOnly.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-600">Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {warningsOnly.map((warning, i) => (
                <li key={i} className="flex items-start gap-2">
                  {getIcon(warning.type)}
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
