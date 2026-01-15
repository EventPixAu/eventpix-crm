import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Layers } from 'lucide-react';
import { EquipmentInventory } from '@/components/EquipmentInventory';
import { EquipmentKitManager } from '@/components/EquipmentKitManager';

export default function Equipment() {
  return (
    <AppLayout>
      <PageHeader
        title="Equipment"
        description="Manage equipment inventory and kits"
      />

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="kits" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Kits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <EquipmentInventory />
        </TabsContent>

        <TabsContent value="kits">
          <EquipmentKitManager />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
