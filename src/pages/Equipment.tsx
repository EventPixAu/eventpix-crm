import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Layers, CalendarDays } from 'lucide-react';
import { EquipmentInventory } from '@/components/EquipmentInventory';
import { EquipmentKitManager } from '@/components/EquipmentKitManager';
import { EquipmentAvailabilityCalendar } from '@/components/EquipmentAvailabilityCalendar';

export default function Equipment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'inventory';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Equipment"
        description="Manage equipment inventory and kits"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="kits" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Kits
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Availability
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <EquipmentInventory />
        </TabsContent>

        <TabsContent value="kits">
          <EquipmentKitManager />
        </TabsContent>

        <TabsContent value="availability">
          <EquipmentAvailabilityCalendar />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
