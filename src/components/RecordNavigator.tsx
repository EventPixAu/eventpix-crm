/**
 * RECORD NAVIGATOR
 * 
 * Provides previous/next navigation arrows for scrolling through records.
 * Used on Company and Contact detail pages for quick review/cull workflows.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface RecordNavigatorProps {
  currentId: string;
  recordType: 'company' | 'contact';
}

export function RecordNavigator({ currentId, recordType }: RecordNavigatorProps) {
  const navigate = useNavigate();

  // Fetch all record IDs sorted alphabetically by name
  const { data: recordIds = [] } = useQuery({
    queryKey: [recordType === 'company' ? 'company-navigation-ids' : 'contact-navigation-ids'],
    queryFn: async () => {
      if (recordType === 'company') {
        const { data, error } = await supabase
          .from('clients')
          .select('id, business_name')
          .order('business_name', { ascending: true });
        
        if (error) throw error;
        return data?.map(c => c.id) || [];
      } else {
        const { data, error } = await supabase
          .from('client_contacts')
          .select('id, contact_name')
          .order('contact_name', { ascending: true });
        
        if (error) throw error;
        return data?.map(c => c.id) || [];
      }
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  const currentIndex = recordIds.indexOf(currentId);
  const prevId = currentIndex > 0 ? recordIds[currentIndex - 1] : null;
  const nextId = currentIndex < recordIds.length - 1 ? recordIds[currentIndex + 1] : null;

  const basePath = recordType === 'company' ? '/crm/companies' : '/crm/contacts';

  const handlePrev = () => {
    if (prevId) navigate(`${basePath}/${prevId}`);
  };

  const handleNext = () => {
    if (nextId) navigate(`${basePath}/${nextId}`);
  };

  // Only show if we have records to navigate
  if (recordIds.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrev}
            disabled={!prevId}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {prevId ? 'Previous record' : 'No previous record'}
        </TooltipContent>
      </Tooltip>
      
      <span className="text-xs text-muted-foreground px-2 min-w-[60px] text-center">
        {currentIndex + 1} / {recordIds.length}
      </span>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            disabled={!nextId}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {nextId ? 'Next record' : 'No next record'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
