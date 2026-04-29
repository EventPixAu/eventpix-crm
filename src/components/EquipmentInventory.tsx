import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, Trash2, Package, ArrowUp, ArrowDown, ArrowUpDown, Search, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { 
  useEquipmentItems, 
  useCreateEquipmentItem, 
  useUpdateEquipmentItem, 
  useDeleteEquipmentItem,
  EQUIPMENT_CONDITIONS,
  EquipmentItem,
  EquipmentItemWithOwner,
  EquipmentCondition,
  EquipmentStatus
} from '@/hooks/useEquipment';
import { useEquipmentCategories } from '@/hooks/useLookups';
import { useStaffDirectory } from '@/hooks/useStaff';

function AllocationInfo({ equipmentItemId }: { equipmentItemId: string }) {
  // Fetch ALL allocations (current + history)
  const { data: allocations, isLoading } = useQuery({
    queryKey: ['equipment-item-allocations', equipmentItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_allocations')
        .select(`
          id, status, allocated_at, returned_at,
          event:events(id, event_name, event_date),
          user:profiles!equipment_allocations_user_id_fkey(full_name)
        `)
        .eq('equipment_item_id', equipmentItemId)
        .order('allocated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return null;
  if (!allocations || allocations.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Allocation History</Label>
        <p className="text-sm text-muted-foreground italic">No allocation history</p>
      </div>
    );
  }

  const active = allocations.filter((a: any) => a.status !== 'returned' && !a.returned_at);
  const history = allocations.filter((a: any) => a.status === 'returned' || a.returned_at);

  return (
    <div className="space-y-3">
      {/* Current allocation */}
      {active.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Current Allocation</Label>
          <div className="space-y-1.5">
            {active.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/50 p-2 text-sm">
                <div>
                  <p className="font-medium">{a.event?.event_name || 'Unknown event'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.event?.event_date ? format(new Date(a.event.event_date), 'dd MMM yyyy') : '—'}
                    {a.user?.full_name ? ` · ${a.user.full_name}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Past Allocations</Label>
          <div className="space-y-1">
            {history.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-md bg-muted/30 p-2 text-sm opacity-70">
                <div>
                  <p className="text-sm">{a.event?.event_name || 'Unknown event'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.event?.event_date ? format(new Date(a.event.event_date), 'dd MMM yyyy') : '—'}
                    {a.user?.full_name ? ` · ${a.user.full_name}` : ''}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground">Returned</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function EquipmentInventory() {
  const { data: items, isLoading } = useEquipmentItems();
  const { data: categories = [] } = useEquipmentCategories();
  const { data: staffDirectory = [] } = useStaffDirectory();
  const createItem = useCreateEquipmentItem();
  const updateItem = useUpdateEquipmentItem();
  const deleteItem = useDeleteEquipmentItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItemWithOwner | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    model: '',
    serial_number: '',
    condition: 'good' as EquipmentCondition,
    status: 'available' as EquipmentStatus,
    notes: '',
    owner_user_id: '' as string, // empty = EventPix
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: categories[0]?.name?.toLowerCase() || '',
      brand: '',
      model: '',
      serial_number: '',
      condition: 'good',
      status: 'available',
      notes: '',
      owner_user_id: '',
    });
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemData = {
      ...formData,
      brand: formData.brand || null,
      model: formData.model || null,
      serial_number: formData.serial_number || null,
      notes: formData.notes || null,
      owner_user_id: formData.owner_user_id || null, // empty string -> null (EventPix)
    };

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
    } else {
      await createItem.mutateAsync(itemData);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleEdit = (item: EquipmentItemWithOwner) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      brand: item.brand || '',
      model: item.model || '',
      serial_number: item.serial_number || '',
      condition: item.condition,
      status: item.status,
      notes: item.notes || '',
      owner_user_id: item.owner_user_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteItem.isPending) return;
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem.mutateAsync(id);
    }
  };

  const filteredItems = items?.filter((item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterOwner === 'eventpixii' && item.owner_user_id !== null) return false;
    if (filterOwner === 'photographer' && item.owner_user_id === null) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const haystack = [
        item.name, item.brand, item.model, item.serial_number,
        item.category, item.owner?.full_name, item.notes
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sortedItems = useMemo(() => {
    if (!filteredItems) return [];
    return [...filteredItems].sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortField) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'owner': aVal = (a.owner?.full_name || 'EventPix').toLowerCase(); bVal = (b.owner?.full_name || 'EventPix').toLowerCase(); break;
        case 'category': aVal = (a.category || '').toLowerCase(); bVal = (b.category || '').toLowerCase(); break;
        case 'brand': aVal = `${a.brand || ''} ${a.model || ''}`.trim().toLowerCase(); bVal = `${b.brand || ''} ${b.model || ''}`.trim().toLowerCase(); break;
        case 'condition': aVal = a.condition; bVal = b.condition; break;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const getStatusBadge = (status: EquipmentStatus) => {
    const variants: Record<EquipmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      allocated: 'secondary',
      in_service: 'outline',
      retired: 'destructive',
    };
    return <Badge variant={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  const getConditionBadge = (condition: EquipmentCondition) => {
    const variants: Record<EquipmentCondition, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      excellent: 'default',
      good: 'secondary',
      needs_service: 'outline',
      out_of_service: 'destructive',
    };
    return <Badge variant={variants[condition]}>{condition.replace('_', ' ')}</Badge>;
  };

  // Build category options: active categories + any legacy categories from existing items
  const categoryOptions = (() => {
    const activeNames = categories
      .map(c => c.name?.toLowerCase())
      .filter((name): name is string => !!name && name.trim() !== '');
    const existingCategories = [...new Set(
      (items?.map(item => item.category) || [])
        .filter((cat): cat is string => !!cat && cat.trim() !== '')
    )];
    const allCategories = [...new Set([...activeNames, ...existingCategories])];
    return allCategories.filter(cat => cat.trim() !== '').sort();
  })();

  if (isLoading) {
    return <div className="text-muted-foreground">Loading equipment...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Equipment Inventory
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Equipment Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Canon EOS R5 #1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter(cat => cat.is_active && cat.name?.trim())
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.name.toLowerCase()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(v) => setFormData({ ...formData, condition: v as EquipmentCondition })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_CONDITIONS.map((cond) => (
                        <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Canon, Sony, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="EOS R5, A7IV, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select
                  value={formData.owner_user_id || 'eventpixii'}
                  onValueChange={(v) => setFormData({ ...formData, owner_user_id: v === 'eventpixii' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eventpixii">EventPix (Company)</SelectItem>
                    {staffDirectory
                      .filter(s => s.source === 'profile' && s.full_name?.trim())
                      .map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only photographers with accounts can own equipment. Invite staff to create accounts first.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any notes about this item..."
                />
              </div>
              {editingItem && <AllocationInfo equipmentItemId={editingItem.id} />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="allocated">Allocated</SelectItem>
              <SelectItem value="in_service">In Service</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="eventpixii">EventPix Only</SelectItem>
              <SelectItem value="photographer">Photographer Gear</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                <span className="flex items-center">Name<SortIcon field="name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('owner')}>
                <span className="flex items-center">Owner<SortIcon field="owner" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('category')}>
                <span className="flex items-center">Category<SortIcon field="category" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('brand')}>
                <span className="flex items-center">Brand/Model<SortIcon field="brand" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('condition')}>
                <span className="flex items-center">Condition<SortIcon field="condition" /></span>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {item.owner?.full_name ? (
                    <Badge variant="outline">{item.owner.full_name}</Badge>
                  ) : (
                    <Badge variant="secondary">EventPix</Badge>
                  )}
                </TableCell>
                <TableCell className="capitalize">{item.category}</TableCell>
                <TableCell>
                  {item.brand && item.model ? `${item.brand} ${item.model}` : item.brand || item.model || '—'}
                </TableCell>
                <TableCell>{getConditionBadge(item.condition)}</TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} disabled={deleteItem.isPending}>
                      {deleteItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No equipment items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
