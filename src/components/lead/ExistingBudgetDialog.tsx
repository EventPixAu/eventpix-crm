import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface ExistingBudget {
  id: string;
  quote_name?: string | null;
  quote_number?: string | null;
  status: string;
}

interface ExistingBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgets: ExistingBudget[];
  onCreate: () => void;
  isCreating: boolean;
}

export function ExistingBudgetDialog({ open, onOpenChange, budgets, onCreate, isCreating }: ExistingBudgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open an existing budget</DialogTitle>
          <DialogDescription>This lead already has {budgets.length === 1 ? 'a budget' : 'budgets'}.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {budgets.map((budget) => (
            <Button key={budget.id} asChild variant="outline" className="w-full h-auto min-h-10 justify-start whitespace-normal">
              <Link to={`/sales/quotes/${budget.id}`} onClick={() => onOpenChange(false)}>
                <FileText className="h-4 w-4 shrink-0 mr-2" />
                <span className="min-w-0 flex-1 text-left break-words">{budget.quote_name || budget.quote_number || 'Budget'}</span>
                <Badge variant="secondary" className="ml-2 shrink-0 capitalize">{budget.status}</Badge>
              </Link>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCreate} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            {isCreating ? 'Creating...' : 'Create another budget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}