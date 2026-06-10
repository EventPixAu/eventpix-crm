import { useState, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useKnowledgeArticles, type KnowledgeArticle } from '@/hooks/useKnowledgeBase';
import { cn } from '@/lib/utils';

function ArticleCard({ title, content }: { title: string; content: string }) {
  const [expanded, setExpanded] = useState(false);

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return <h2 key={i} className="text-lg font-bold mt-3 mb-1">{trimmed.slice(2)}</h2>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith('### ')) {
        return <h4 key={i} className="text-sm font-medium mt-2 mb-0.5">{trimmed.slice(4)}</h4>;
      }
      if (trimmed.startsWith('- ')) {
        return (
          <li key={i} className="ml-4 text-sm text-muted-foreground leading-relaxed">
            {trimmed.slice(2)}
          </li>
        );
      }
      if (/^\d+\. /.test(trimmed)) {
        return (
          <li key={i} className="ml-4 text-sm text-muted-foreground leading-relaxed list-decimal">
            {trimmed.replace(/^\d+\. /, '')}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={i} className="h-1" />;
      }
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return <p key={i} className="text-sm font-semibold mt-1">{trimmed.replace(/\*\*/g, '')}</p>;
      }
      return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{trimmed}</p>;
    });
  };

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
          <div className="pt-2 space-y-0.5">{renderContent(content)}</div>
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
