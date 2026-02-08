import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, Trash2, Layers, Package, X } from 'lucide-react';
import { 
  useEquipmentKits, 
  useEquipmentKit,
  useCreateEquipmentKit, 
  useUpdateEquipmentKit,
  useAddKitItem,
  useRemoveKitItem,
  EquipmentKit
} from '@/hooks/useEquipmentKits';
import { useEquipmentItems } from '@/hooks/useEquipment';

export function EquipmentKitManager() {
  const { data: kits, isLoading } = useEquipmentKits();
  const { data: allItems } = useEquipmentItems();
  const createKit = useCreateEquipmentKit();
  const updateKit = useUpdateEquipmentKit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<EquipmentKit | null>(null);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    other_items: [] as string[],
    is_active: true,
  });
  const [newOtherItem, setNewOtherItem] = useState('');
  const [pendingInventoryItems, setPendingInventoryItems] = useState<string[]>([]);

  const resetForm = () => {
    setFormData({ name: '', description: '', other_items: [], is_active: true });
    setEditingKit(null);
    setNewOtherItem('');
    setPendingInventoryItems([]);
  };

  const addOtherItem = () => {
    if (newOtherItem.trim()) {
      setFormData(prev => ({
        ...prev,
        other_items: [...prev.other_items, newOtherItem.trim()]
      }));
      setNewOtherItem('');
    }
  };

  const removeOtherItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      other_items: prev.other_items.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kitData = {
      name: formData.name,
      description: formData.description || null,
      other_items: formData.other_items.length > 0 ? formData.other_items : null,
      is_active: formData.is_active,
    };

    if (editingKit) {
      await updateKit.mutateAsync({ id: editingKit.id, ...kitData });
    } else {
      const newKit = await createKit.mutateAsync(kitData);
      // Add any pending inventory items to the new kit
      if (newKit?.id) {
        for (const itemId of pendingInventoryItems) {
          await addKitItem.mutateAsync({ kitId: newKit.id, equipmentItemId: itemId });
        }
        setSelectedKitId(newKit.id);
      }
    }

    setDialogOpen(false);
    resetForm();
  };

  const addPendingItem = (itemId: string) => {
    if (!pendingInventoryItems.includes(itemId)) {
      setPendingInventoryItems(prev => [...prev, itemId]);
    }
  };

  const removePendingItem = (itemId: string) => {
    setPendingInventoryItems(prev => prev.filter(id => id !== itemId));
  };

  const handleEdit = (kit: EquipmentKit) => {
    setEditingKit(kit);
    setSelectedKitId(kit.id);
    setFormData({
      name: kit.name,
      description: kit.description || '',
      other_items: kit.other_items || [],
      is_active: kit.is_active,
    });
    setPendingInventoryItems([]);
    setDialogOpen(true);
  };

  const addKitItem = useAddKitItem();

  if (isLoading) {
    return <div className="text-muted-foreground">Loading kits...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Equipment Kits
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Kit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingKit ? 'Edit' : 'Create'} Equipment Kit</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Corporate Kit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What's included and when to use..."
                  />
                </div>
                
                {/* Equipment Inventory Items */}
                {editingKit ? (
                  <div className="border-t pt-4 mt-4">
                    <InlineKitItemsEditor kitId={editingKit.id} allItems={allItems || []} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Equipment from Inventory
                    </Label>
                    {allItems && allItems.length > 0 ? (
                      <>
                        <Select onValueChange={addPendingItem} value="">
                          <SelectTrigger>
                            <SelectValue placeholder="Select equipment to add..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allItems.filter(item => !pendingInventoryItems.includes(item.id)).map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {pendingInventoryItems.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pendingInventoryItems.map(itemId => {
                              const item = allItems.find(i => i.id === itemId);
                              return (
                                <Badge key={itemId} variant="secondary" className="gap-1">
                                  {item?.name}
                                  <button type="button" onClick={() => removePendingItem(itemId)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No equipment items available. Add items to Equipment Inventory first.
                      </p>
                    )}
                  </div>
                )}

                {/* Other Items (non-inventory) */}
                <div className="space-y-3">
                  <Label>Other Items (cables, power leads, etc.)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOtherItem}
                      onChange={(e) => setNewOtherItem(e.target.value)}
                      placeholder="e.g., Power extension lead"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOtherItem();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={addOtherItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.other_items.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.other_items.map((item, index) => (
                        <Badge key={index} variant="outline" className="gap-1">
                          {item}
                          <button type="button" onClick={() => removeOtherItem(index)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createKit.isPending || updateKit.isPending}>
                    {editingKit ? 'Update' : 'Create'} Kit
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kits?.map((kit) => (
              <Card 
                key={kit.id} 
                className={`cursor-pointer transition-colors ${selectedKitId === kit.id ? 'border-primary' : ''}`}
                onClick={() => setSelectedKitId(kit.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{kit.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {!kit.is_active && <Badge variant="secondary">Inactive</Badge>}
                      <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(kit); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{kit.description || 'No description'}</p>
                  {kit.other_items && kit.other_items.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {kit.other_items.slice(0, 3).map((item, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{item}</Badge>
                      ))}
                      {kit.other_items.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{kit.other_items.length - 3} more</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {(!kits || kits.length === 0) && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                No kits created yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedKitId && (
        <KitItemsEditor kitId={selectedKitId} allItems={allItems || []} />
      )}
    </div>
  );
}

// Inline version for use within the dialog
function InlineKitItemsEditor({ kitId, allItems }: { kitId: string; allItems: { id: string; name: string; category: string }[] }) {
  const { data: kit, isLoading } = useEquipmentKit(kitId);
  const addItem = useAddKitItem();
  const removeItem = useRemoveKitItem();
  const [selectedItemId, setSelectedItemId] = useState('');

  const handleAddItem = async () => {
    if (!selectedItemId) return;
    await addItem.mutateAsync({ kitId, equipmentItemId: selectedItemId });
    setSelectedItemId('');
  };

  const handleRemoveItem = async (id: string) => {
    await removeItem.mutateAsync({ id, kitId });
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading kit items...</div>;
  }

  const availableItems = allItems.filter(
    (item) => !kit?.items.some((ki) => ki.equipment_item_id === item.id)
  );

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Package className="h-4 w-4" />
        Equipment Items in Kit
      </Label>
      
      {availableItems.length > 0 ? (
        <div className="flex gap-2">
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select equipment to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={handleAddItem} disabled={!selectedItemId || addItem.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {allItems.length === 0 
            ? 'No equipment items available. Add items to Equipment Inventory first.' 
            : 'All equipment items have been added to this kit.'}
        </p>
      )}

      {kit?.items && kit.items.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kit.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.equipment_item?.name}</TableCell>
                  <TableCell className="capitalize">{item.equipment_item?.category}</TableCell>
                  <TableCell>
                    <Button 
                      type="button"
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={removeItem.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No items in this kit yet</p>
      )}
    </div>
  );
}

function KitItemsEditor({ kitId, allItems }: { kitId: string; allItems: { id: string; name: string; category: string }[] }) {
  const { data: kit, isLoading } = useEquipmentKit(kitId);
  const addItem = useAddKitItem();
  const removeItem = useRemoveKitItem();
  const [selectedItemId, setSelectedItemId] = useState('');

  const handleAddItem = async () => {
    if (!selectedItemId) return;
    await addItem.mutateAsync({ kitId, equipmentItemId: selectedItemId });
    setSelectedItemId('');
  };

  const handleRemoveItem = async (id: string) => {
    await removeItem.mutateAsync({ id, kitId });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading kit items...</div>;
  }

  const availableItems = allItems.filter(
    (item) => !kit?.items.some((ki) => ki.equipment_item_id === item.id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Items in "{kit?.name}"
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select item to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({item.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddItem} disabled={!selectedItemId || addItem.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kit?.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.equipment_item?.name}</TableCell>
                <TableCell className="capitalize">{item.equipment_item?.category}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={removeItem.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!kit?.items || kit.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No inventory items in this kit
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Display Other Items */}
        {kit?.other_items && kit.other_items.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Other Items</Label>
            <div className="flex flex-wrap gap-2">
              {kit.other_items.map((item, index) => (
                <Badge key={index} variant="secondary">{item}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
