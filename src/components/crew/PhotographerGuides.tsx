import { useState, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useKnowledgeArticles, type KnowledgeArticle } from '@/hooks/useKnowledgeBase';
import { MarkdownRendererCompact } from '@/components/MarkdownRenderer';
import { cn } from '@/lib/utils';

function ArticleCard({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <span className="text-sm font-medium">{title}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="px-3 pb-3 border-t border-border/60"
        >
          <div className="pt-2">
            <MarkdownRendererCompact content={content} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function PhotographerGuides() {
  const { data: allArticles = [], isLoading } = useKnowledgeArticles();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const active = allArticles.filter((a) => a.is_active);
    const byCat: Record<string, KnowledgeArticle[]> = {};
    for (const a of active) {
      (byCat[a.category] ||= []).push(a);
    }
    return Object.entries(byCat).sort(([a], [b]) => a.localeCompare(b));
  }, [allArticles]);

  if (isLoading) return null;
  if (grouped.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="mx-4 mb-4"
    >
      <button
        onClick={() => setSectionOpen(!sectionOpen)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Photographer Guides</h3>
        </div>
        {sectionOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className={cn('space-y-3', sectionOpen ? 'block' : 'hidden')}>
        {grouped.map(([category, articles]) => {
          const open = openCategories[category] ?? true;
          return (
            <div key={category}>
              <button
                onClick={() =>
                  setOpenCategories((prev) => ({ ...prev, [category]: !open }))
                }
                className="w-full flex items-center justify-between mb-1.5 px-1"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </span>
                {open ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
              {open && (
                <div className="space-y-2">
                  {articles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      title={article.title}
                      content={article.content}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
