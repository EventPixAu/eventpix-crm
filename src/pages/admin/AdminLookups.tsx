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
  Beaker,
  Users,
  Target,
  Briefcase,
  XCircle,
  Heart,
  ShoppingBag,
  Package,
  FolderOpen,
  MapPin,
  FileCheck,
  Building2,
  CircleDot,
  ClipboardList,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import SiteSettingsPanel from '@/components/admin/SiteSettingsPanel';
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
  useAllLocations,
  useCreateLocation,
  useUpdateLocation,
  type LookupItem,
} from '@/hooks/useAdminLookups';
import {
  useAllLeadSources,
  useCreateLeadSource,
  useUpdateLeadSource,
} from '@/hooks/useLeadSources';
import {
  useAllStaffRoles,
  useCreateStaffRole,
  useUpdateStaffRole,
} from '@/hooks/useAdminStaffRoles';
import {
  useAllLostReasons,
  useCreateLostReason,
  useUpdateLostReason,
} from '@/hooks/useAdminLostReasons';
import {
  useAllRelationshipTypes,
  useCreateRelationshipType,
  useUpdateRelationshipType,
} from '@/hooks/useAdminRelationshipTypes';
import {
  useCoveragePackages,
  useCreateCoveragePackage,
  useUpdateCoveragePackage,
} from '@/hooks/useCoveragePackages';
import {
  useComplianceDocumentTypes,
  useCreateComplianceDocumentType,
  useUpdateComplianceDocumentType,
} from '@/hooks/useCompliance';
import {
  useAllProductCategories,
  useCreateProductCategory,
  useUpdateProductCategory,
} from '@/hooks/useAdminProductCategories';
import {
  useAllOpsStatuses,
  useCreateOpsStatus,
  useUpdateOpsStatus,
} from '@/hooks/useOpsStatuses';
import {
  useAllLeadStatuses,
  useCreateLeadStatus,
  useUpdateLeadStatus,
} from '@/hooks/useLeadStatuses';
import { AdminTrainingTools } from '@/components/AdminTrainingTools';

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


  // Lead Sources
  const { data: leadSources = [], isLoading: leadSourcesLoading } = useAllLeadSources();
  const createLeadSource = useCreateLeadSource();
  const updateLeadSource = useUpdateLeadSource();

  // Staff Roles
  const { data: staffRoles = [], isLoading: staffRolesLoading } = useAllStaffRoles();
  const createStaffRole = useCreateStaffRole();
  const updateStaffRole = useUpdateStaffRole();

  // Lost Reasons
  const { data: lostReasons = [], isLoading: lostReasonsLoading } = useAllLostReasons();
  const createLostReason = useCreateLostReason();
  const updateLostReason = useUpdateLostReason();

  // Relationship Types
  const { data: relationshipTypes = [], isLoading: relationshipTypesLoading } = useAllRelationshipTypes();
  const createRelationshipType = useCreateRelationshipType();
  const updateRelationshipType = useUpdateRelationshipType();

  // Coverage Packages
  const { data: coveragePackages = [], isLoading: coveragePackagesLoading } = useCoveragePackages();
  const createCoveragePackage = useCreateCoveragePackage();
  const updateCoveragePackage = useUpdateCoveragePackage();

  // Compliance Document Types
  const { data: complianceDocTypes = [], isLoading: complianceDocTypesLoading } = useComplianceDocumentTypes();
  const createComplianceDocType = useCreateComplianceDocumentType();
  const updateComplianceDocType = useUpdateComplianceDocumentType();

  // Locations
  const { data: locations = [], isLoading: locationsLoading } = useAllLocations();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();

  // Product Categories
  const { data: productCategories = [], isLoading: productCategoriesLoading } = useAllProductCategories();
  const createProductCategory = useCreateProductCategory();
  const updateProductCategory = useUpdateProductCategory();


  // Lead Statuses
  const { data: leadStatuses = [], isLoading: leadStatusesLoading } = useAllLeadStatuses();
  const createLeadStatus = useCreateLeadStatus();
  const updateLeadStatus = useUpdateLeadStatus();

  // Ops Statuses
  const { data: opsStatuses = [], isLoading: opsStatusesLoading } = useAllOpsStatuses();
  const createOpsStatus = useCreateOpsStatus();
  const updateOpsStatus = useUpdateOpsStatus();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Manage Lookups"
        description="Configure dropdown values used across the system"
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Tabs defaultValue="event-types">
          <div className="border-b border-border bg-muted/30 overflow-x-auto">
            <TabsList className="w-full justify-start rounded-none border-0 h-auto p-0 flex-wrap">
              <TabsTrigger 
                value="event-types" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Event Types
              </TabsTrigger>
              <TabsTrigger 
                value="delivery-methods"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Truck className="h-4 w-4 mr-2" />
                Delivery
              </TabsTrigger>
              <TabsTrigger 
                value="equipment-categories"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Box className="h-4 w-4 mr-2" />
                Equipment
              </TabsTrigger>
              <TabsTrigger 
                value="staff-roles"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Staff Roles
              </TabsTrigger>
              <TabsTrigger 
                value="relationship-types"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Heart className="h-4 w-4 mr-2" />
                Relationships
              </TabsTrigger>
              <TabsTrigger 
                value="lead-sources"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Target className="h-4 w-4 mr-2" />
                Lead Sources
              </TabsTrigger>
              <TabsTrigger 
                value="lead-statuses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <CircleDot className="h-4 w-4 mr-2" />
                Lead Statuses
              </TabsTrigger>
              <TabsTrigger 
                value="ops-statuses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Ops Status
              </TabsTrigger>
              <TabsTrigger 
                value="lost-reasons"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Lost Reasons
              </TabsTrigger>
              <TabsTrigger 
                value="coverage-packages"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Package className="h-4 w-4 mr-2" />
                Coverage
              </TabsTrigger>
              <TabsTrigger 
                value="compliance-docs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger 
                value="locations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Locations
              </TabsTrigger>
              <TabsTrigger 
                value="product-categories"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Product Categories
              </TabsTrigger>
              <TabsTrigger
                value="training-tools"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Beaker className="h-4 w-4 mr-2" />
                Training
              </TabsTrigger>
              <TabsTrigger 
                value="site-settings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Business
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

            <TabsContent value="staff-roles" className="m-0">
              <LookupTable
                items={staffRoles}
                isLoading={staffRolesLoading}
                onCreate={async (name) => { await createStaffRole.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateStaffRole.mutateAsync({ id, ...updates }); }}
                createPending={createStaffRole.isPending}
                updatePending={updateStaffRole.isPending}
                itemLabel="Staff Role"
              />
            </TabsContent>


            <TabsContent value="relationship-types" className="m-0">
              <LookupTable
                items={relationshipTypes}
                isLoading={relationshipTypesLoading}
                onCreate={async (name) => { await createRelationshipType.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateRelationshipType.mutateAsync({ id, ...updates }); }}
                createPending={createRelationshipType.isPending}
                updatePending={updateRelationshipType.isPending}
                itemLabel="Relationship Type"
              />
            </TabsContent>

            <TabsContent value="lead-sources" className="m-0">
              <LookupTable
                items={leadSources}
                isLoading={leadSourcesLoading}
                onCreate={async (name) => { await createLeadSource.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateLeadSource.mutateAsync({ id, ...updates }); }}
                createPending={createLeadSource.isPending}
                updatePending={updateLeadSource.isPending}
                itemLabel="Lead Source"
              />
            </TabsContent>

            <TabsContent value="lost-reasons" className="m-0">
              <LookupTable
                items={lostReasons}
                isLoading={lostReasonsLoading}
                onCreate={async (name) => { await createLostReason.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateLostReason.mutateAsync({ id, ...updates }); }}
                createPending={createLostReason.isPending}
                updatePending={updateLostReason.isPending}
                itemLabel="Lost Reason"
              />
            </TabsContent>

            <TabsContent value="lead-statuses" className="m-0">
              <LookupTable
                items={leadStatuses.map(s => ({ 
                  id: s.id, 
                  name: s.label, 
                  is_active: s.is_active, 
                  sort_order: s.sort_order 
                }))}
                isLoading={leadStatusesLoading}
                onCreate={async (name) => { await createLeadStatus.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateLeadStatus.mutateAsync({ id, ...updates }); }}
                createPending={createLeadStatus.isPending}
                updatePending={updateLeadStatus.isPending}
                itemLabel="Lead Status"
              />
            </TabsContent>

            <TabsContent value="ops-statuses" className="m-0">
              <LookupTable
                items={opsStatuses.map(s => ({ 
                  id: s.id, 
                  name: s.label, 
                  is_active: s.is_active, 
                  sort_order: s.sort_order 
                }))}
                isLoading={opsStatusesLoading}
                onCreate={async (name) => { await createOpsStatus.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateOpsStatus.mutateAsync({ id, ...updates }); }}
                createPending={createOpsStatus.isPending}
                updatePending={updateOpsStatus.isPending}
                itemLabel="Operations Status"
              />
            </TabsContent>

            <TabsContent value="coverage-packages" className="m-0">
              <LookupTable
                items={coveragePackages.map(p => ({ 
                  id: p.id, 
                  name: p.name, 
                  is_active: p.is_active, 
                  sort_order: p.sort_order 
                }))}
                isLoading={coveragePackagesLoading}
                onCreate={async (name) => { await createCoveragePackage.mutateAsync({ name }); }}
                onUpdate={async (id, updates) => { await updateCoveragePackage.mutateAsync({ id, ...updates }); }}
                createPending={createCoveragePackage.isPending}
                updatePending={updateCoveragePackage.isPending}
                itemLabel="Coverage Package"
              />
            </TabsContent>

            <TabsContent value="compliance-docs" className="m-0">
              <LookupTable
                items={complianceDocTypes.map(d => ({ 
                  id: d.id, 
                  name: d.name, 
                  is_active: d.is_active, 
                  sort_order: d.sort_order 
                }))}
                isLoading={complianceDocTypesLoading}
                onCreate={async (name) => { 
                  await createComplianceDocType.mutateAsync({ 
                    name, 
                    required: false, 
                    has_expiry: false, 
                    is_active: true, 
                    sort_order: complianceDocTypes.length,
                    applies_to_roles: null,
                    description: null
                  }); 
                }}
                onUpdate={async (id, updates) => { await updateComplianceDocType.mutateAsync({ id, ...updates }); }}
                createPending={createComplianceDocType.isPending}
                updatePending={updateComplianceDocType.isPending}
                itemLabel="Compliance Document Type"
              />
            </TabsContent>

            <TabsContent value="locations" className="m-0">
              <LookupTable
                items={locations}
                isLoading={locationsLoading}
                onCreate={async (name) => { await createLocation.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateLocation.mutateAsync({ id, ...updates }); }}
                createPending={createLocation.isPending}
                updatePending={updateLocation.isPending}
                itemLabel="Location"
              />
            </TabsContent>

            <TabsContent value="product-categories" className="m-0">
              <LookupTable
                items={productCategories}
                isLoading={productCategoriesLoading}
                onCreate={async (name) => { await createProductCategory.mutateAsync(name); }}
                onUpdate={async (id, updates) => { await updateProductCategory.mutateAsync({ id, ...updates }); }}
                createPending={createProductCategory.isPending}
                updatePending={updateProductCategory.isPending}
                itemLabel="Product Category"
              />
            </TabsContent>


            <TabsContent value="training-tools" className="m-0">
              <AdminTrainingTools />
            </TabsContent>

            <TabsContent value="site-settings" className="m-0">
              <SiteSettingsPanel />
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
