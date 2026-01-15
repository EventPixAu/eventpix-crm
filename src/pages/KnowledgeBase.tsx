import { useState, useMemo } from 'react';
import { Search, Plus, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth';
import {
  useKnowledgeArticles,
  useCreateKnowledgeArticle,
  useUpdateKnowledgeArticle,
  useDeleteKnowledgeArticle,
  KnowledgeArticle,
} from '@/hooks/useKnowledgeBase';

export default function KnowledgeBase() {
  const { isAdmin } = useAuth();
  const { data: articles, isLoading } = useKnowledgeArticles();
  const createArticle = useCreateKnowledgeArticle();
  const updateArticle = useUpdateKnowledgeArticle();
  const deleteArticle = useDeleteKnowledgeArticle();

  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    content: '',
    is_active: true,
    sort_order: 0,
  });

  const categories = useMemo(() => {
    if (!articles) return [];
    return [...new Set(articles.map(a => a.category))].sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    if (!search) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    );
  }, [articles, search]);

  const articlesByCategory = useMemo(() => {
    const grouped: Record<string, KnowledgeArticle[]> = {};
    filteredArticles.forEach(article => {
      if (!grouped[article.category]) {
        grouped[article.category] = [];
      }
      grouped[article.category].push(article);
    });
    return grouped;
  }, [filteredArticles]);

  const handleOpenCreate = () => {
    setFormData({
      title: '',
      category: '',
      content: '',
      is_active: true,
      sort_order: 0,
    });
    setSelectedArticle(null);
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (article: KnowledgeArticle) => {
    setFormData({
      title: article.title,
      category: article.category,
      content: article.content,
      is_active: article.is_active,
      sort_order: article.sort_order,
    });
    setSelectedArticle(article);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (selectedArticle) {
      await updateArticle.mutateAsync({
        id: selectedArticle.id,
        ...formData,
      });
    } else {
      await createArticle.mutateAsync({
        ...formData,
        created_by: null,
      });
    }
    setEditDialogOpen(false);
  };

  const handleDelete = async () => {
    if (selectedArticle) {
      await deleteArticle.mutateAsync(selectedArticle.id);
      setDeleteDialogOpen(false);
      setSelectedArticle(null);
    }
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold mb-4">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ')) {
          return <li key={i} className="ml-4 mb-1">{line.slice(2)}</li>;
        }
        if (line.startsWith('**Q:')) {
          return <p key={i} className="font-semibold mt-4">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.startsWith('A:')) {
          return <p key={i} className="mb-4 text-muted-foreground">{line}</p>;
        }
        if (line.trim() === '') {
          return <br key={i} />;
        }
        return <p key={i} className="mb-2">{line}</p>;
      });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Knowledge Base"
        description="Guides and resources for photographers"
        actions={
          isAdmin && (
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          )
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : selectedArticle && !editDialogOpen ? (
        /* Article Detail View */
        <div>
          <Button variant="ghost" onClick={() => setSelectedArticle(null)} className="mb-4">
            ← Back to articles
          </Button>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {selectedArticle.category}
                  </Badge>
                  <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(selectedArticle)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {renderMarkdown(selectedArticle.content)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Article List View */
        <Tabs defaultValue={categories[0] || 'all'}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-sm">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <div className="space-y-3">
                {articlesByCategory[cat]?.map((article) => (
                  <Card
                    key={article.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{article.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {article.content.slice(0, 100)}...
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedArticle ? 'Edit Article' : 'New Article'}</DialogTitle>
            <DialogDescription>
              {selectedArticle ? 'Update this knowledge base article' : 'Create a new article for photographers'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Article title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Camera settings, Lighting setups"
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content * (Markdown supported)</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="# Heading&#10;&#10;Your content here..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.title || !formData.category || !formData.content}
            >
              {selectedArticle ? 'Save Changes' : 'Create Article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedArticle?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
