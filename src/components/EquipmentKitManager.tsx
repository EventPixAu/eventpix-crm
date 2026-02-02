import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, Trash2, Layers, Package } from 'lucide-react';
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
    is_active: true,
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', is_active: true });
    setEditingKit(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kitData = {
      ...formData,
      description: formData.description || null,
    };

    if (editingKit) {
      await updateKit.mutateAsync({ id: editingKit.id, ...kitData });
    } else {
      const newKit = await createKit.mutateAsync(kitData);
      // Auto-select the new kit to allow adding items immediately
      if (newKit?.id) {
        setSelectedKitId(newKit.id);
      }
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (kit: EquipmentKit) => {
    setEditingKit(kit);
    setSelectedKitId(kit.id); // Also select the kit to show items editor
    setFormData({
      name: kit.name,
      description: kit.description || '',
      is_active: kit.is_active,
    });
    setDialogOpen(true);
  };

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
                
                {/* Show items editor inline when editing an existing kit */}
                {editingKit && (
                  <div className="border-t pt-4 mt-4">
                    <InlineKitItemsEditor kitId={editingKit.id} allItems={allItems || []} />
                  </div>
                )}
                
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
                <CardContent>
                  <p className="text-sm text-muted-foreground">{kit.description || 'No description'}</p>
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
                  No items in this kit
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
