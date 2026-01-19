import { useState } from 'react';
import { Copy, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AVAILABLE_MERGE_FIELDS } from '@/hooks/useContractTemplates';

interface MergeFieldsReferenceProps {
  onInsert?: (field: string) => void;
}

export function MergeFieldsReference({ onInsert }: MergeFieldsReferenceProps) {
  const [search, setSearch] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Client', 'Job']);
  
  // Group fields by category
  const categories = AVAILABLE_MERGE_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MERGE_FIELDS>);
  
  // Filter fields by search
  const filteredCategories = Object.entries(categories).reduce((acc, [category, fields]) => {
    const filtered = fields.filter(f => 
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.field.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MERGE_FIELDS>);
  
  const handleCopy = async (field: string) => {
    await navigator.clipboard.writeText(field);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  const handleInsert = (field: string) => {
    if (onInsert) {
      onInsert(field);
    } else {
      handleCopy(field);
    }
  };
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };
  
  return (
    <div className="border border-border rounded-lg bg-muted/30">
      <div className="p-3 border-b border-border">
        <h4 className="text-sm font-medium mb-2">Available Merge Fields</h4>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>
      
      <div className="max-h-80 overflow-y-auto">
        {Object.entries(filteredCategories).map(([category, fields]) => (
          <Collapsible 
            key={category}
            open={expandedCategories.includes(category) || search.length > 0}
            onOpenChange={() => toggleCategory(category)}
          >
            <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 border-b border-border">
              <span>{category}</span>
              <Badge variant="secondary" className="text-xs">
                {fields.length}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="divide-y divide-border">
                {fields.map((field) => (
                  <div 
                    key={field.field}
                    className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {field.label}
                      </p>
                      <code className="text-xs font-mono text-primary">
                        {field.field}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleInsert(field.field)}
                    >
                      {copiedField === field.field ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
      
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Click to copy a merge field, then paste it into your template.
        </p>
      </div>
    </div>
  );
}
