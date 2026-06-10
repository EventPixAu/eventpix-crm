import { useMemo } from 'react';
import { markdownToHtml } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  proseClassName?: string;
}

/**
 * Shared Markdown renderer component.
 * Converts Markdown → HTML via marked, sanitizes with DOMPurify,
 * and renders with Tailwind typography (prose) styling.
 */
export function MarkdownRenderer({
  content,
  className,
  proseClassName,
}: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return '';
    return markdownToHtml(content);
  }, [content]);

  return (
    <div className={className}>
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          // Tight spacing for mobile-friendly reading
          'prose-headings:mb-2 prose-headings:mt-4',
          'prose-p:mb-2 prose-p:leading-relaxed',
          'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
          'prose-a:text-primary',
          proseClassName
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * Compact variant for mobile/embedded views (e.g., PhotographerGuides).
 * Smaller text, tighter spacing.
 */
export function MarkdownRendererCompact({
  content,
  className,
}: Omit<MarkdownRendererProps, 'proseClassName'>) {
  const html = useMemo(() => {
    if (!content) return '';
    return markdownToHtml(content);
  }, [content]);

  return (
    <div className={className}>
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          // Very compact for mobile crew views
          'prose-headings:text-sm prose-headings:font-semibold prose-headings:mb-1 prose-headings:mt-2',
          'prose-p:text-sm prose-p:text-muted-foreground prose-p:mb-1 prose-p:leading-relaxed',
          'prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-sm prose-li:text-muted-foreground',
          'prose-strong:text-foreground',
          'prose-a:text-primary'
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
