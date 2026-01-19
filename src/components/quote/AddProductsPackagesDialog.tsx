/**
 * ADD PRODUCTS & PACKAGES DIALOG
 * 
 * Modal for selecting products and packages to add to a quote.
 * Studio Ninja style - tabbed interface for Products vs Packages.
 */
import { useState, useMemo } from 'react';
import { Search, Package, ShoppingBag, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useActiveProducts, type Product } from '@/hooks/useProducts';
import { useActivePackages, usePackageItems } from '@/hooks/usePackages';

interface SelectedItem {
  type: 'product' | 'package';
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  tax_rate: number;
  quantity: number;
}

interface AddProductsPackagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (items: SelectedItem[]) => void;
}

function PackageCard({ 
  pkg, 
  selected, 
  onSelect,
  onQuantityChange,
}: { 
  pkg: Product; 
  selected: SelectedItem | undefined;
  onSelect: () => void;
  onQuantityChange: (qty: number) => void;
}) {
  const { data: items } = usePackageItems(pkg.id);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  return (
    <div 
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{pkg.name}</span>
          </div>
          {pkg.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {pkg.description}
            </p>
          )}
          {items && items.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                Includes: {items.map(i => i.product?.name).filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-semibold">{formatCurrency(pkg.unit_price)}</div>
          <Badge variant="secondary" className="mt-1">Package</Badge>
        </div>
      </div>
      {selected && (
        <div className="mt-3 pt-3 border-t flex items-center justify-end gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(Math.max(1, selected.quantity - 1));
            }}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-medium">{selected.quantity}</span>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(selected.quantity + 1);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function AddProductsPackagesDialog({
  open,
  onOpenChange,
  onAdd,
}: AddProductsPackagesDialogProps) {
  const { data: products } = useActiveProducts();
  const { data: packages } = useActivePackages();
  
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());

  // Filter out packages from products list (packages have is_package = true)
  const atomicProducts = useMemo(() => {
    return products?.filter(p => !p.is_package) || [];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return atomicProducts;
    const lower = search.toLowerCase();
    return atomicProducts.filter(p => 
      p.name.toLowerCase().includes(lower) ||
      p.description?.toLowerCase().includes(lower)
    );
  }, [atomicProducts, search]);

  const filteredPackages = useMemo(() => {
    if (!search.trim()) return packages || [];
    const lower = search.toLowerCase();
    return packages?.filter(p => 
      p.name.toLowerCase().includes(lower) ||
      p.description?.toLowerCase().includes(lower)
    ) || [];
  }, [packages, search]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const toggleProduct = (product: Product) => {
    const key = `product-${product.id}`;
    const newSelected = new Map(selectedItems);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.set(key, {
        type: 'product',
        id: product.id,
        name: product.name,
        description: product.description,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
        quantity: 1,
      });
    }
    setSelectedItems(newSelected);
  };

  const togglePackage = (pkg: Product) => {
    const key = `package-${pkg.id}`;
    const newSelected = new Map(selectedItems);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.set(key, {
        type: 'package',
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        unit_price: pkg.unit_price,
        tax_rate: pkg.tax_rate,
        quantity: 1,
      });
    }
    setSelectedItems(newSelected);
  };

  const updateQuantity = (key: string, quantity: number) => {
    const newSelected = new Map(selectedItems);
    const item = newSelected.get(key);
    if (item) {
      newSelected.set(key, { ...item, quantity });
      setSelectedItems(newSelected);
    }
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedItems.values()));
    setSelectedItems(new Map());
    setSearch('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelectedItems(new Map());
    setSearch('');
    onOpenChange(false);
  };

  const totalSelected = selectedItems.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Products & Packages</DialogTitle>
          <DialogDescription>
            Select items to add to your quote. You can add both individual products and pre-configured packages.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products and packages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="products" className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Products ({filteredProducts.length})
            </TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Packages ({filteredPackages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <ScrollArea className="h-[350px]">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'No products match your search' : 'No products available'}
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredProducts.map((product) => {
                    const key = `product-${product.id}`;
                    const selected = selectedItems.get(key);
                    
                    return (
                      <div 
                        key={product.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/50'
                        }`}
                        onClick={() => toggleProduct(product)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(product.unit_price)}</div>
                            <div className="text-xs text-muted-foreground">
                              {(product.tax_rate * 100).toFixed(0)}% Tax
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <div className="mt-2 pt-2 border-t flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(key, Math.max(1, selected.quantity - 1));
                              }}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{selected.quantity}</span>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(key, selected.quantity + 1);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="packages" className="mt-4">
            <ScrollArea className="h-[350px]">
              {filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'No packages match your search' : 'No packages available'}
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {filteredPackages.map((pkg) => {
                    const key = `package-${pkg.id}`;
                    const selected = selectedItems.get(key);
                    
                    return (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        selected={selected}
                        onSelect={() => togglePackage(pkg)}
                        onQuantityChange={(qty) => updateQuantity(key, qty)}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {totalSelected > 0 ? `${totalSelected} item${totalSelected > 1 ? 's' : ''} selected` : 'No items selected'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={totalSelected === 0}>
              Add to Quote
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
