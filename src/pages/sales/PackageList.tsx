/**
 * PACKAGE LIST PAGE
 * 
 * Displays and manages product packages (bundles).
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Plus, Search, Package, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  usePackages, 
  usePackageItems,
  useCreatePackage, 
  useAddPackageItem,
  useRemovePackageItem,
  type PackageItem,
} from '@/hooks/usePackages';
import { useAtomicProducts, useUpdateProduct, useDeleteProduct, type Product } from '@/hooks/useProducts';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface PackageFormData {
  name: string;
  description: string;
  unit_price: number;
  tax_rate: number;
  is_active: boolean;
}

function PackageItemsEditor({ 
  packageId, 
  isLocked 
}: { 
  packageId: string; 
  isLocked: boolean;
}) {
  const { data: items, isLoading } = usePackageItems(packageId);
  const { data: products } = useAtomicProducts();
  const addItem = useAddPackageItem();
  const removeItem = useRemovePackageItem();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const handleAddItem = async () => {
    if (!selectedProductId) return;
    await addItem.mutateAsync({
      package_id: packageId,
      product_id: selectedProductId,
      quantity,
    });
    setSelectedProductId('');
    setQuantity(1);
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem.mutateAsync({ id: itemId, package_id: packageId });
  };

  const availableProducts = products?.filter(
    p => !items?.some(i => i.product_id === p.id)
  );

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground">Loading items...</div>;
  }

  return (
    <div className="space-y-4">
      {items && items.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right w-20">Qty</TableHead>
                <TableHead className="text-right w-28">Unit Price</TableHead>
                {!isLocked && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.product?.name || 'Unknown Product'}</div>
                    {item.product?.description && (
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {item.product.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {item.product ? formatCurrency(item.product.unit_price) : '—'}
                  </TableCell>
                  {!isLocked && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={removeItem.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground border rounded-lg">
          No products added to this package yet.
        </div>
      )}

      {!isLocked && availableProducts && availableProducts.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Add Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(product.unit_price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
          <Button 
            onClick={handleAddItem} 
            disabled={!selectedProductId || addItem.isPending}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PackageList() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: packages, isLoading } = usePackages();
  const createPackage = useCreatePackage();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Product | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    description: '',
    unit_price: 0,
    tax_rate: 0.1,
    is_active: true,
  });

  const filteredPackages = packages?.filter(pkg => {
    const matchesSearch = 
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.description?.toLowerCase().includes(search.toLowerCase());
    const matchesActive = showInactive || pkg.is_active;
    return matchesSearch && matchesActive;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit_price: 0,
      tax_rate: 0.1,
      is_active: true,
    });
    setEditingPackage(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (pkg: Product) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      unit_price: pkg.unit_price,
      tax_rate: pkg.tax_rate,
      is_active: pkg.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Package name is required', variant: 'destructive' });
      return;
    }
    
    if (editingPackage) {
      await updateProduct.mutateAsync({ 
        id: editingPackage.id, 
        name: formData.name,
        description: formData.description || null,
        unit_price: formData.unit_price,
        tax_rate: formData.tax_rate,
        is_active: formData.is_active,
      });
    } else {
      await createPackage.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        unit_price: formData.unit_price,
        tax_rate: formData.tax_rate,
      });
    }
    setIsFormOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this package?')) {
      await deleteProduct.mutateAsync(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Packages"
        description="Manage bundled product packages"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Package
          </Button>
        }
      />

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="show-inactive" 
                checked={showInactive} 
                onCheckedChange={setShowInactive} 
              />
              <Label htmlFor="show-inactive" className="text-sm">Show inactive</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !filteredPackages?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No packages found matching your search' : 'No packages yet. Create your first package!'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPackages.map((pkg) => (
                <Collapsible 
                  key={pkg.id} 
                  open={expandedId === pkg.id}
                  onOpenChange={(open) => setExpandedId(open ? pkg.id : null)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          {expandedId === pkg.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Package className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{pkg.name}</div>
                            {pkg.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                                {pkg.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(pkg.unit_price)}</div>
                            <div className="text-xs text-muted-foreground">
                              {(pkg.tax_rate * 100).toFixed(0)}% Tax
                            </div>
                          </div>
                          <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                            {pkg.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(pkg);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(pkg.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t px-4 py-4 bg-muted/30">
                        <h4 className="text-sm font-medium mb-3">Included Products</h4>
                        <PackageItemsEditor packageId={pkg.id} isLocked={!isAdmin} />
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Package Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Edit Package' : 'New Package'}</DialogTitle>
            <DialogDescription>
              {editingPackage ? 'Update package details.' : 'Create a new product package.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Wedding Photography Package"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's included in this package..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_price">Package Price ($)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                  placeholder="2500.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.01"
                  value={(formData.tax_rate || 0) * 100}
                  onChange={(e) => setFormData({ ...formData, tax_rate: (parseFloat(e.target.value) || 0) / 100 })}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="is_active" 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name.trim() || createPackage.isPending || updateProduct.isPending}
            >
              {(createPackage.isPending || updateProduct.isPending) ? 'Saving...' : (editingPackage ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
