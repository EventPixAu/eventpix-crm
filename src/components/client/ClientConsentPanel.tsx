/**
 * CLIENT CONSENT PANEL
 * 
 * Studio Ninja-style collapsible consent management panel
 */
import { useState } from 'react';
import { CheckCircle, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ClientConsentPanelProps {
  clientId: string;
}

export function ClientConsentPanel({ clientId }: ClientConsentPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Consent</CardTitle>
              </button>
            </CollapsibleTrigger>
            <Button 
              size="icon" 
              className="h-7 w-7 rounded-full bg-primary"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              No consent records
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
