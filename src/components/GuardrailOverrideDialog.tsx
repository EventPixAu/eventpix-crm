import { useState } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GuardrailCheck, useLogGuardrailOverride } from '@/hooks/useGuardrails';
import { cn } from '@/lib/utils';

interface GuardrailOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hardBlocks: GuardrailCheck[];
  softBlocks: GuardrailCheck[];
  eventId: string;
  userId: string;
  onOverrideConfirmed: () => void;
  overrideType?: string;
}

export function GuardrailOverrideDialog({
  open,
  onOpenChange,
  hardBlocks,
  softBlocks,
  eventId,
  userId,
  onOverrideConfirmed,
  overrideType = 'assignment',
}: GuardrailOverrideDialogProps) {
  const [acknowledgedRules, setAcknowledgedRules] = useState<Set<string>>(new Set());
  const [justification, setJustification] = useState('');
  
  const logOverride = useLogGuardrailOverride();
  
  const allBlocks = [...hardBlocks, ...softBlocks];
  const allAcknowledged = allBlocks.every(block => acknowledgedRules.has(block.rule));
  const canConfirm = allAcknowledged && justification.trim().length >= 10;
  
  const handleToggleRule = (rule: string) => {
    const newSet = new Set(acknowledgedRules);
    if (newSet.has(rule)) {
      newSet.delete(rule);
    } else {
      newSet.add(rule);
    }
    setAcknowledgedRules(newSet);
  };
  
  const handleConfirmOverride = async () => {
    await logOverride.mutateAsync({
      eventId,
      userId,
      overrideType,
      rulesBreached: Array.from(acknowledgedRules),
      justification: justification.trim(),
    });
    
    setAcknowledgedRules(new Set());
    setJustification('');
    onOpenChange(false);
    onOverrideConfirmed();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
            Override Required
          </DialogTitle>
          <DialogDescription>
            This action requires manual override due to safety guardrails. 
            Please review and acknowledge each issue below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Hard Blocks */}
          {hardBlocks.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Critical Issues (Hard Blocks)</AlertTitle>
              <AlertDescription>
                <p className="text-sm mb-2">
                  These issues normally prevent this action. You must acknowledge each one.
                </p>
                <div className="space-y-2 mt-3">
                  {hardBlocks.map((block) => (
                    <div key={block.rule} className="flex items-start gap-2">
                      <Checkbox
                        id={block.rule}
                        checked={acknowledgedRules.has(block.rule)}
                        onCheckedChange={() => handleToggleRule(block.rule)}
                      />
                      <Label htmlFor={block.rule} className="text-sm font-normal cursor-pointer">
                        <span className="font-medium">{block.message}</span>
                        {block.details && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {block.details}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Soft Blocks */}
          {softBlocks.length > 0 && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700">Warnings (Soft Blocks)</AlertTitle>
              <AlertDescription>
                <p className="text-sm mb-2">
                  These issues are warnings. Please acknowledge you've reviewed them.
                </p>
                <div className="space-y-2 mt-3">
                  {softBlocks.map((block) => (
                    <div key={block.rule} className="flex items-start gap-2">
                      <Checkbox
                        id={block.rule}
                        checked={acknowledgedRules.has(block.rule)}
                        onCheckedChange={() => handleToggleRule(block.rule)}
                      />
                      <Label htmlFor={block.rule} className="text-sm font-normal cursor-pointer">
                        <span className="font-medium">{block.message}</span>
                        {block.details && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            {block.details}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Justification */}
          <div className="space-y-2">
            <Label htmlFor="justification" className="text-sm font-medium">
              Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why this override is necessary..."
              rows={3}
              className={cn(
                justification.length > 0 && justification.length < 10 && 'border-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters. This will be logged for audit purposes.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmOverride}
            disabled={!canConfirm || logOverride.isPending}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {logOverride.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Confirm Override
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
