import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Plus,
  Pencil,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Calendar,
  Truck,
  Box,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import {
  useAllEventTypes,
  useCreateEventType,
  useUpdateEventType,
  useAllDeliveryMethods,
  useCreateDeliveryMethod,
  useUpdateDeliveryMethod,
  useAllEquipmentCategories,
  useCreateEquipmentCategory,
  useUpdateEquipmentCategory,
  type LookupItem,
} from '@/hooks/useAdminLookups';

interface LookupTableProps {
  items: LookupItem[];
  isLoading: boolean;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<LookupItem>) => Promise<void>;
  createPending: boolean;
  updatePending: boolean;
  itemLabel: string;
}

function LookupTable({
  items,
  isLoading,
  onCreate,
  onUpdate,
  createPending,
  updatePending,
  itemLabel,
}: LookupTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleStartEdit = (item: LookupItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdate(editingId, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName('');
    setShowAddForm(false);
  };

  const handleToggleActive = async (item: LookupItem) => {
    await onUpdate(item.id, { is_active: !item.is_active });
  };

  const handleMoveUp = async (item: LookupItem, index: number) => {
    if (index === 0) return;
    const prevItem = items[index - 1];
    await onUpdate(item.id, { sort_order: prevItem.sort_order });
    await onUpdate(prevItem.id, { sort_order: item.sort_order });
  };

  const handleMoveDown = async (item: LookupItem, index: number) => {
    if (index === items.length - 1) return;
    const nextItem = items[index + 1];
    await onUpdate(item.id, { sort_order: nextItem.sort_order });
    await onUpdate(nextItem.id, { sort_order: item.sort_order });
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Button */}
      {!showAddForm ? (
        <Button onClick={() => setShowAddForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add {itemLabel}
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg border border-border"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${itemLabel.toLowerCase()} name...`}
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setShowAddForm(false);
                setNewName('');
              }
            }}
          />
          <Button 
            size="sm" 
            onClick={handleCreate} 
            disabled={createPending || !newName.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setShowAddForm(false);
              setNewName('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {/* Items List */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Name</th>
              <th className="text-center p-3 text-sm font-medium w-24">Active</th>
              <th className="text-center p-3 text-sm font-medium w-24">Order</th>
              <th className="text-right p-3 text-sm font-medium w-20">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No {itemLabel.toLowerCase()}s yet. Add one above.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr 
                  key={item.id}
                  className={`transition-colors ${!item.is_active ? 'bg-muted/30 opacity-60' : 'hover:bg-muted/20'}`}
                >
                  <td className="p-3">
                    {editingId === item.id ? (
                      <div className="flex gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleSaveEdit}
                          disabled={updatePending}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleCancelEdit}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={!item.is_active ? 'line-through' : ''}>
                          {item.name}
                        </span>
                        {!item.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item)}
                      disabled={updatePending}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={index === 0 || updatePending}
                        onClick={() => handleMoveUp(item, index)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        disabled={index === items.length - 1 || updatePending}
                        onClick={() => handleMoveDown(item, index)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    {editingId !== item.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleStartEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminLookups() {
  const { isAdmin } = useAuth();

  // Event Types
  const { data: eventTypes = [], isLoading: eventTypesLoading } = useAllEventTypes();
  const createEventType = useCreateEventType();
  const updateEventType = useUpdateEventType();

  // Delivery Methods
  const { data: deliveryMethods = [], isLoading: deliveryMethodsLoading } = useAllDeliveryMethods();
  const createDeliveryMethod = useCreateDeliveryMethod();
  const updateDeliveryMethod = useUpdateDeliveryMethod();

  // Equipment Categories
  const { data: equipmentCategories = [], isLoading: categoriesLoading } = useAllEquipmentCategories();
  const createCategory = useCreateEquipmentCategory();
  const updateCategory = useUpdateEquipmentCategory();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Manage Lookups"
        description="Configure dropdown values for Event Types, Delivery Methods, and Equipment Categories"
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Tabs defaultValue="event-types">
          <div className="border-b border-border bg-muted/30">
            <TabsList className="w-full justify-start rounded-none border-0 h-auto p-0">
              <TabsTrigger 
                value="event-types" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Event Types
              </TabsTrigger>
              <TabsTrigger 
                value="delivery-methods"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Truck className="h-4 w-4 mr-2" />
                Delivery Methods
              </TabsTrigger>
              <TabsTrigger 
                value="equipment-categories"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3"
              >
                <Box className="h-4 w-4 mr-2" />
                Equipment Categories
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="event-types" className="m-0">
              <LookupTable
                items={eventTypes}
                isLoading={eventTypesLoading}
                onCreate={async (name) => { await createEventType.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateEventType.mutateAsync({ id, ...updates }); }}
                createPending={createEventType.isPending}
                updatePending={updateEventType.isPending}
                itemLabel="Event Type"
              />
            </TabsContent>

            <TabsContent value="delivery-methods" className="m-0">
              <LookupTable
                items={deliveryMethods}
                isLoading={deliveryMethodsLoading}
                onCreate={async (name) => { await createDeliveryMethod.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateDeliveryMethod.mutateAsync({ id, ...updates }); }}
                createPending={createDeliveryMethod.isPending}
                updatePending={updateDeliveryMethod.isPending}
                itemLabel="Delivery Method"
              />
            </TabsContent>

            <TabsContent value="equipment-categories" className="m-0">
              <LookupTable
                items={equipmentCategories}
                isLoading={categoriesLoading}
                onCreate={async (name) => { await createCategory.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateCategory.mutateAsync({ id, ...updates }); }}
                createPending={createCategory.isPending}
                updatePending={updateCategory.isPending}
                itemLabel="Equipment Category"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-muted/30 border border-border rounded-xl p-4">
        <h3 className="font-medium mb-2">How Lookups Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Active</strong> values appear in dropdown menus when creating or editing records.</li>
          <li>• <strong>Inactive</strong> values are hidden from new selections but remain visible on existing records.</li>
          <li>• <strong>Order</strong> controls the display sequence in dropdowns.</li>
          <li>• Deactivate instead of delete to preserve historical data integrity.</li>
        </ul>
      </div>
    </AppLayout>
  );
}
