/**
 * PLAIN TEXT TEMPLATE EDITOR
 * 
 * A user-friendly template editor with:
 * - Plain text textarea (no monospace/code feel)
 * - Merge field picker with insert at cursor
 * - Live preview with sample data
 * - Support for both text and HTML format templates
 */
import { useState, useRef, useCallback } from 'react';
import { Search, Copy, Check, Plus, Eye } from 'lucide-react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { AVAILABLE_MERGE_FIELDS, renderMergeFields as renderMergeFieldsFromHook, MergeFieldContext } from '@/hooks/useContractTemplates';

export type TemplateFormat = 'text' | 'html';

// Re-export for use by other components
export { AVAILABLE_MERGE_FIELDS };
export type { MergeFieldContext };
export const renderMergeFields = renderMergeFieldsFromHook;

interface PlainTextTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  format?: TemplateFormat;
  placeholder?: string;
  label?: string;
  minHeight?: string;
  showPreview?: boolean;
  previewContext?: MergeFieldContext;
  className?: string;
}

// Sample context for preview when no real data available
export const SAMPLE_CONTEXT: MergeFieldContext = {
  client: {
    business_name: 'Acme Corporation',
    primary_contact_name: 'Jane Smith',
    primary_contact_email: 'jane@acme.com',
    primary_contact_phone: '0412 345 678',
    billing_address: '123 Business St, Sydney NSW 2000',
    abn: '12 345 678 901',
  },
  event: {
    event_name: 'Annual Corporate Gala',
    event_date: '2025-06-15',
    main_shoot_date: '2025-06-15',
    start_time: '18:00',
    end_time: '23:00',
    venue_name: 'Grand Ballroom',
    venue_address: '456 Event Ave, Sydney NSW 2000',
    event_type: 'Corporate',
    coverage_details: '5 hours photography coverage',
  },
  sessions: [
    {
      session_date: '2025-06-15',
      start_time: '18:00',
      end_time: '23:00',
      venue_name: 'Grand Ballroom',
      venue_address: '456 Event Ave, Sydney NSW 2000',
      label: 'Main Event',
    },
  ],
  quote: {
    quote_number: 'Q-2025-0042',
    subtotal: 2500,
    tax_total: 250,
    total_estimate: 2750,
    valid_until: '2025-05-01',
  },
  lead: {
    lead_name: 'Corporate Gala Enquiry',
    contact_name: 'Jane Smith',
    contact_email: 'jane@acme.com',
    contact_phone: '0412 345 678',
  },
  today: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
  company_name: 'Eventpix',
};

export function PlainTextTemplateEditor({
  value,
  onChange,
  format = 'text',
  placeholder = 'Start typing your template...\n\nUse merge fields like {{client.business_name}} to personalize.',
  label = 'Template Body',
  minHeight = '300px',
  showPreview = true,
  previewContext,
  className,
}: PlainTextTemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [mergeFieldSearch, setMergeFieldSearch] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Client', 'Job', 'Quote']);

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
      f.label.toLowerCase().includes(mergeFieldSearch.toLowerCase()) ||
      f.field.toLowerCase().includes(mergeFieldSearch.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MERGE_FIELDS>);

  // Insert merge field at cursor position
  const insertAtCursor = useCallback((field: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + field);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + field + value.substring(end);
    
    onChange(newValue);
    
    // Restore focus and set cursor position after the inserted field
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + field.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  }, [value, onChange]);

  // Copy field to clipboard
  const handleCopy = async (field: string) => {
    await navigator.clipboard.writeText(field);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Convert basic markdown to HTML for preview
  const convertMarkdownToHtml = (text: string): string => {
    let html = text;
    
    // Escape HTML entities first
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Underline: ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<u>$1</u>');
    
    // Convert newlines to <br>
    html = html.replace(/\n/g, '<br>');
    
    return html;
  };

  // Render preview content
  const renderPreview = () => {
    const context = previewContext || SAMPLE_CONTEXT;
    const rendered = renderMergeFields(value, context);
    
    if (format === 'html') {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rendered) }}
        />
      );
    }
    
    // For text format, convert markdown and newlines for display
    const htmlContent = convertMarkdownToHtml(rendered);
    return (
      <div 
        className="prose prose-sm max-w-none text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
      />
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {showPreview ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
          <div className="flex items-center justify-between">
            <Label>{label}</Label>
            <TabsList className="h-8 bg-muted">
              <TabsTrigger value="edit" className="text-xs px-3 data-[state=active]:bg-background data-[state=active]:text-foreground">Edit</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs px-3 data-[state=active]:bg-background data-[state=active]:text-foreground">
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="edit" className="mt-2 space-y-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Template textarea */}
              <div className="lg:col-span-2">
                <Textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  className="resize-none text-sm border-2 border-input focus:border-primary"
                  style={{ minHeight }}
                />
              </div>
              
              {/* Merge field picker */}
              <div className="border border-border rounded-lg bg-muted/30 h-fit max-h-[400px] overflow-hidden flex flex-col">
                <div className="p-3 border-b border-border shrink-0">
                  <h4 className="text-sm font-medium mb-2">Merge Fields</h4>
                  {format === 'text' && (
                    <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted rounded border">
                      <p className="font-medium mb-1">Formatting:</p>
                      <p><code className="bg-background px-1 rounded">**bold**</code> <code className="bg-background px-1 rounded">*italic*</code> <code className="bg-background px-1 rounded">~~underline~~</code></p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mb-2">
                    Click to insert at cursor
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      placeholder="Search fields..."
                      value={mergeFieldSearch}
                      onChange={(e) => setMergeFieldSearch(e.target.value)}
                      className="pl-7 h-8 text-sm"
                    />
                  </div>
                </div>
                
                <div className="overflow-y-auto flex-1">
                  {Object.entries(filteredCategories).map(([category, fields]) => (
                    <Collapsible
                      key={category}
                      open={expandedCategories.includes(category) || mergeFieldSearch.length > 0}
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
                              className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/50 group"
                            >
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => insertAtCursor(field.field)}
                              >
                                <p className="text-xs text-muted-foreground truncate">
                                  {field.label}
                                </p>
                                <code className="text-xs font-mono text-primary">
                                  {field.field}
                                </code>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    insertAtCursor(field.field);
                                  }}
                                  title="Insert at cursor"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(field.field);
                                  }}
                                  title="Copy to clipboard"
                                >
                                  {copiedField === field.field ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="mt-2">
            <div className="border rounded-lg p-6 bg-white min-h-[300px]">
              {value ? (
                renderPreview()
              ) : (
                <p className="text-muted-foreground text-sm italic">
                  Enter template content to see preview
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Preview uses sample data. Actual values will be filled when generating documents.
            </p>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <Label>{label}</Label>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="resize-none text-sm"
                style={{ minHeight }}
              />
            </div>
            {/* Merge field picker - same as above */}
            <div className="border border-border rounded-lg bg-muted/30 h-fit max-h-[400px] overflow-hidden flex flex-col">
              <div className="p-3 border-b border-border shrink-0">
                <h4 className="text-sm font-medium mb-2">Merge Fields</h4>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={mergeFieldSearch}
                    onChange={(e) => setMergeFieldSearch(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 max-h-[280px]">
                {Object.entries(filteredCategories).map(([category, fields]) => (
                  <Collapsible
                    key={category}
                    open={expandedCategories.includes(category) || mergeFieldSearch.length > 0}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium hover:bg-muted/50 border-b border-border">
                      <span>{category}</span>
                      <Badge variant="secondary" className="text-xs">{fields.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="divide-y divide-border">
                        {fields.map((field) => (
                          <button
                            key={field.field}
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-muted/50"
                            onClick={() => insertAtCursor(field.field)}
                          >
                            <p className="text-xs text-muted-foreground truncate">{field.label}</p>
                            <code className="text-xs font-mono text-primary">{field.field}</code>
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Convert HTML template content to plain text
 */
export function convertHtmlToText(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // Convert common HTML elements to text equivalents
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, '\t');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  text = textarea.value;
  
  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
}

/**
 * Render text template as HTML for display
 * Converts newlines to <br> and wraps in a clean container
 */
export function renderTextTemplateAsHtml(text: string, context: MergeFieldContext): string {
  const rendered = renderMergeFields(text, context);
  
  // Escape HTML characters
  const escaped = rendered
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Convert newlines to <br>
  const withBreaks = escaped.replace(/\n/g, '<br>');
  
  // Wrap in a container with basic styling
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a;">
      ${withBreaks}
    </div>
  `;
}
